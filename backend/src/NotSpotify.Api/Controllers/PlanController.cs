using System.Net.Mail;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

/// <summary>
/// Multi-account plan membership (Duo / Family). The owner holds the Stripe
/// subscription; accepted members get Premium for free via a synced
/// <c>ApplicationUser.Plan = "premium"</c> + <c>PlanOwnerId</c> (so every
/// existing premium check keeps working without consulting this table).
/// </summary>
[ApiController]
[Route("me/plan")]
[Authorize]
public class PlanController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly UserManager<ApplicationUser> _users;
    private readonly NotificationService _notify;

    public PlanController(AppDbContext db, MediaMapper mapper, UserManager<ApplicationUser> users, NotificationService notify)
    {
        _db = db;
        _mapper = mapper;
        _users = users;
        _notify = notify;
    }

    private Guid? Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    private static string Normalize(string email) => email.Trim().ToLowerInvariant();

    // A user can share seats only when they own (not ride) an active sharable tier.
    private static bool IsSharableOwner(ApplicationUser u)
        => string.Equals(u.Plan, "premium", StringComparison.OrdinalIgnoreCase)
           && u.PlanOwnerId is null
           && StripeBillingService.MaxMembersForTier(u.PlanTier) > 1;

    [HttpGet]
    public async Task<ActionResult<PlanOverviewDto>> Overview(CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();
        var me = await _db.Users.FirstOrDefaultAsync(u => u.Id == uid, ct);
        if (me is null) return NotFound();

        var isOwner = IsSharableOwner(me);
        var maxMembers = isOwner ? StripeBillingService.MaxMembersForTier(me.PlanTier) : 1;

        // Seats I own.
        var seats = await _db.PlanMemberships
            .Where(m => m.OwnerId == uid)
            .Include(m => m.Member)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

        var members = seats.Select(s => new PlanMemberDto(
            s.Id,
            s.Status,
            s.InvitedEmail,
            s.Member is null ? null : _mapper.ToRef(s.Member)
        )).ToList();

        // If I'm a member, who owns my seat — and which seat is mine (to leave).
        UserRefDto? planOwner = null;
        Guid? mySeatId = null;
        if (me.PlanOwnerId is Guid ownerId)
        {
            var owner = await _db.Users.FirstOrDefaultAsync(u => u.Id == ownerId, ct);
            if (owner is not null) planOwner = _mapper.ToRef(owner);
            mySeatId = await _db.PlanMemberships
                .Where(m => m.MemberId == uid && m.OwnerId == ownerId)
                .Select(m => (Guid?)m.Id)
                .FirstOrDefaultAsync(ct);
        }

        // Invites addressed to my email that I can accept.
        var myEmail = Normalize(me.Email ?? string.Empty);
        var incoming = await _db.PlanMemberships
            .Where(m => m.InvitedEmail == myEmail && m.Status == "invited" && m.MemberId == null && m.OwnerId != uid)
            .Include(m => m.Owner)
            .ToListAsync(ct);

        var incomingDtos = incoming.Select(m => new PlanInviteDto(
            m.Id,
            _mapper.ToRef(m.Owner),
            m.Owner.PlanTier
        )).ToList();

        return Ok(new PlanOverviewDto(
            me.PlanTier,
            maxMembers,
            isOwner,
            me.PlanOwnerId is not null,
            planOwner,
            mySeatId,
            1 + seats.Count,
            maxMembers,
            members,
            incomingDtos
        ));
    }

    [HttpPost("invite")]
    public async Task<ActionResult<PlanOverviewDto>> Invite([FromBody] InvitePlanMemberRequest req, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();
        var me = await _db.Users.FirstOrDefaultAsync(u => u.Id == uid, ct);
        if (me is null) return NotFound();

        if (!IsSharableOwner(me))
            return BadRequest(new { message = "Your plan doesn't include extra members. Switch to Duo or Family to invite people." });

        var email = Normalize(req.Email ?? string.Empty);
        if (string.IsNullOrWhiteSpace(email)
            || !MailAddress.TryCreate(email, out var parsedEmail)
            || !string.Equals(parsedEmail.Address, email, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Enter a valid email address." });
        if (email == Normalize(me.Email ?? string.Empty))
            return BadRequest(new { message = "You can't invite yourself." });

        var maxMembers = StripeBillingService.MaxMembersForTier(me.PlanTier);
        var existing = await _db.PlanMemberships.Where(m => m.OwnerId == uid).ToListAsync(ct);
        if (1 + existing.Count >= maxMembers)
            return BadRequest(new { message = "Your plan is full. Remove a member before inviting another." });
        if (existing.Any(m => m.InvitedEmail == email))
            return BadRequest(new { message = "That person is already invited or a member." });

        var membership = new PlanMembership { OwnerId = uid, InvitedEmail = email, Status = "invited" };
        _db.PlanMemberships.Add(membership);
        await _db.SaveChangesAsync(ct);

        // If they already have an account, nudge them in-app.
        var target = await _users.FindByEmailAsync(email);
        if (target is not null)
        {
            await _notify.NotifyAsync(
                target.Id,
                "plan-invite",
                "Premium plan invite",
                $"{me.Name} invited you to join their Premium plan.",
                "/account",
                ct: ct);
        }

        return await Overview(ct);
    }

    [HttpPost("invites/{id:guid}/accept")]
    public async Task<ActionResult<PlanOverviewDto>> Accept(Guid id, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();
        var me = await _db.Users.FirstOrDefaultAsync(u => u.Id == uid, ct);
        if (me is null) return NotFound();

        if (string.Equals(me.Plan, "premium", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = me.PlanOwnerId is null
                ? "You already have your own Premium subscription."
                : "You're already a member of a Premium plan." });

        var myEmail = Normalize(me.Email ?? string.Empty);
        var membership = await _db.PlanMemberships
            .Include(m => m.Owner)
            .FirstOrDefaultAsync(m => m.Id == id && m.InvitedEmail == myEmail && m.Status == "invited" && m.MemberId == null, ct);
        if (membership is null) return NotFound();

        if (!IsSharableOwner(membership.Owner))
            return BadRequest(new { message = "This plan is no longer active." });

        membership.MemberId = uid;
        membership.Status = "active";
        membership.AcceptedAt = DateTime.UtcNow;

        me.Plan = "premium";
        me.PlanOwnerId = membership.OwnerId;
        await _db.SaveChangesAsync(ct);

        await _notify.NotifyAsync(
            membership.OwnerId,
            "plan-invite",
            "Plan member joined",
            $"{me.Name} accepted your Premium plan invite.",
            "/account",
            ct: ct);

        return await Overview(ct);
    }

    [HttpPost("invites/{id:guid}/decline")]
    public async Task<IActionResult> Decline(Guid id, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();
        var me = await _db.Users.FirstOrDefaultAsync(u => u.Id == uid, ct);
        if (me is null) return NotFound();

        var myEmail = Normalize(me.Email ?? string.Empty);
        var membership = await _db.PlanMemberships
            .FirstOrDefaultAsync(m => m.Id == id && m.InvitedEmail == myEmail && m.Status == "invited", ct);
        if (membership is null) return NotFound();

        _db.PlanMemberships.Remove(membership);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // Owner removes a seat, or a member leaves their plan — same endpoint.
    [HttpDelete("members/{id:guid}")]
    public async Task<IActionResult> RemoveOrLeave(Guid id, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();

        var membership = await _db.PlanMemberships
            .FirstOrDefaultAsync(m => m.Id == id && (m.OwnerId == uid || m.MemberId == uid), ct);
        if (membership is null) return NotFound();

        // Drop the seated member back to free.
        if (membership.MemberId is Guid memberId)
        {
            var member = await _db.Users.FirstOrDefaultAsync(u => u.Id == memberId, ct);
            if (member is not null)
            {
                member.Plan = "free";
                member.PlanOwnerId = null;
                member.PlanTier = "individual";

                // Tell whichever side didn't click the button.
                var actorIsOwner = membership.OwnerId == uid;
                if (actorIsOwner)
                    await _notify.NotifyAsync(memberId, "plan-invite", "Removed from plan",
                        "You were removed from a Premium plan.", "/premium", ct: ct);
                else
                    await _notify.NotifyAsync(membership.OwnerId, "plan-invite", "Member left",
                        $"{member.Name} left your Premium plan.", "/account", ct: ct);
            }
        }

        _db.PlanMemberships.Remove(membership);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
