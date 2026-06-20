using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

/// <summary>
/// RBAC: team roster + admin grant/revoke, and the approval queue. A master
/// admin executes grant/revoke directly; a regular admin's request is enqueued
/// as a <see cref="PendingAction"/> that only a master can approve (which runs
/// it) or reject. The single seeded master keeps this bootstrapped.
/// </summary>
[ApiController]
[Route("admin/team")]
[Authorize(Roles = "Admin")]
public class AdminTeamController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;

    public AdminTeamController(AppDbContext db, UserManager<ApplicationUser> users, MediaMapper mapper, NotificationService notifications)
    {
        _db = db;
        _users = users;
        _mapper = mapper;
        _notifications = notifications;
    }

    private bool IsMaster => User.IsInRole(DbSeeder.MasterRole);

    private (Guid id, string name) Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return (Guid.TryParse(id, out var g) ? g : Guid.Empty, User.Identity?.Name ?? "");
    }

    // ── Roster ──────────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TeamMemberDto>>> Roster(CancellationToken ct = default)
    {
        var admins = await _users.GetUsersInRoleAsync(DbSeeder.AdminRole);
        var masters = await _users.GetUsersInRoleAsync(DbSeeder.MasterRole);
        var masterIds = masters.Select(m => m.Id).ToHashSet();

        var all = admins.Concat(masters)
            .GroupBy(u => u.Id)
            .Select(g => g.First())
            .OrderByDescending(u => masterIds.Contains(u.Id))
            .ThenBy(u => u.Name);

        return Ok(all.Select(u => ToMember(u, masterIds.Contains(u.Id), isAdmin: true)));
    }

    // ── Grant / revoke ────────────────────────────────────────────────────────

    [HttpPost("grant")]
    public async Task<IActionResult> Grant([FromBody] GrantAdminRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Email)) return BadRequest("Email is required.");
        var target = await _users.FindByEmailAsync(req.Email.Trim());
        if (target is null) return NotFound(new { message = "No user with that email." });
        if (await _users.IsInRoleAsync(target, DbSeeder.AdminRole))
            return Conflict(new { message = "That user is already an admin." });

        return await RequestOrExecute("grant-admin", target, ct);
    }

    [HttpPost("{userId:guid}/revoke")]
    public async Task<IActionResult> Revoke(Guid userId, CancellationToken ct = default)
    {
        var target = await _users.FindByIdAsync(userId.ToString());
        if (target is null) return NotFound();
        if (await _users.IsInRoleAsync(target, DbSeeder.MasterRole))
            return BadRequest(new { message = "A master admin cannot be revoked." });
        if (!await _users.IsInRoleAsync(target, DbSeeder.AdminRole))
            return Conflict(new { message = "That user is not an admin." });
        var (meId, _) = Me();
        if (target.Id == meId) return BadRequest(new { message = "You cannot revoke your own admin access." });

        return await RequestOrExecute("revoke-admin", target, ct);
    }

    private async Task<IActionResult> RequestOrExecute(string actionType, ApplicationUser target, CancellationToken ct)
    {
        var (meId, meName) = Me();

        if (IsMaster)
        {
            await ExecuteAsync(actionType, target, ct);
            await _db.SaveChangesAsync(ct);
            var nowMaster = await _users.IsInRoleAsync(target, DbSeeder.MasterRole);
            return Ok(ToMember(target, nowMaster, isAdmin: actionType == "grant-admin"));
        }

        // Regular admin → enqueue for a master to approve.
        var pending = new PendingAction
        {
            ActionType = actionType,
            TargetUserId = target.Id,
            TargetEmail = target.Email ?? string.Empty,
            RequestedByUserId = meId,
            RequestedByName = meName,
        };
        _db.PendingActions.Add(pending);
        await _db.SaveChangesAsync(ct);
        return Accepted(ToDto(pending));
    }

    // ── Approvals ─────────────────────────────────────────────────────────────

    [HttpGet("/admin/approvals")]
    public async Task<ActionResult<IEnumerable<PendingActionDto>>> Approvals([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var (meId, _) = Me();
        var q = _db.PendingActions.AsQueryable();
        // Masters see everything; regular admins only see their own requests.
        if (!IsMaster) q = q.Where(a => a.RequestedByUserId == meId);
        if (!string.IsNullOrEmpty(status)) q = q.Where(a => a.Status == status);

        var list = await q
            .OrderBy(a => a.Status == "pending" ? 0 : 1)
            .ThenByDescending(a => a.RequestedAt)
            .ToListAsync(ct);
        return Ok(list.Select(ToDto));
    }

    [HttpPost("/admin/approvals/{id:guid}/approve")]
    public async Task<ActionResult<PendingActionDto>> Approve(Guid id, [FromBody] ReviewActionRequest? req, CancellationToken ct = default)
    {
        if (!IsMaster) return Forbid();
        var action = await _db.PendingActions.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (action is null) return NotFound();
        if (action.Status != "pending") return Conflict(new { message = $"Already {action.Status}." });

        var target = await _users.FindByIdAsync(action.TargetUserId.ToString());
        if (target is not null) await ExecuteAsync(action.ActionType, target, ct);

        Stamp(action, "approved", req?.Note);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(action));
    }

    [HttpPost("/admin/approvals/{id:guid}/reject")]
    public async Task<ActionResult<PendingActionDto>> Reject(Guid id, [FromBody] ReviewActionRequest? req, CancellationToken ct = default)
    {
        if (!IsMaster) return Forbid();
        var action = await _db.PendingActions.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (action is null) return NotFound();
        if (action.Status != "pending") return Conflict(new { message = $"Already {action.Status}." });

        Stamp(action, "rejected", req?.Note);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(action));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task ExecuteAsync(string actionType, ApplicationUser target, CancellationToken ct)
    {
        if (actionType == "grant-admin")
        {
            if (!await _users.IsInRoleAsync(target, DbSeeder.AdminRole))
                await _users.AddToRoleAsync(target, DbSeeder.AdminRole);
            await _notifications.NotifyAsync(target.Id, "admin",
                "You're now an admin", body: "You have been granted admin access.", ct: ct);
        }
        else if (actionType == "revoke-admin")
        {
            if (await _users.IsInRoleAsync(target, DbSeeder.AdminRole))
                await _users.RemoveFromRoleAsync(target, DbSeeder.AdminRole);
            await _notifications.NotifyAsync(target.Id, "admin",
                "Admin access removed", body: "Your admin access has been revoked.", ct: ct);
        }
    }

    private void Stamp(PendingAction a, string status, string? note)
    {
        var (meId, meName) = Me();
        a.Status = status;
        a.ReviewedByUserId = meId;
        a.ReviewedByName = meName;
        a.ReviewedAt = DateTime.UtcNow;
        a.ReviewNote = note;
    }

    private TeamMemberDto ToMember(ApplicationUser u, bool isMaster, bool isAdmin)
    {
        var avatar = _mapper.ToRef(u).AvatarUrl;
        return new TeamMemberDto(u.Id, u.Name, u.Email ?? string.Empty, avatar, isMaster, isAdmin, u.CreatedAt);
    }

    private static PendingActionDto ToDto(PendingAction a) => new(
        a.Id, a.ActionType, a.TargetUserId, a.TargetEmail, a.Status,
        a.RequestedByUserId, a.RequestedByName, a.RequestedAt,
        a.ReviewedByName, a.ReviewedAt, a.ReviewNote
    );
}
