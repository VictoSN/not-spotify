using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private const int MaxItems = 50;
    private readonly AppDbContext _db;

    public NotificationsController(AppDbContext db) => _db = db;

    private Guid CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : throw new UnauthorizedAccessException();
    }

    /// <summary>GET /notifications — newest first, with the unread count for the badge.</summary>
    [HttpGet]
    public async Task<ActionResult<NotificationListDto>> List(CancellationToken ct = default)
    {
        var me = CurrentUserId();

        var items = await _db.Notifications
            .Where(n => n.UserId == me)
            .OrderByDescending(n => n.CreatedAt)
            .Take(MaxItems)
            .Select(n => new NotificationDto(
                n.Id.ToString(), n.Type, n.Title, n.Body, n.LinkUrl, n.ImageUrl, n.IsRead, n.CreatedAt))
            .ToListAsync(ct);

        var unread = await _db.Notifications.CountAsync(n => n.UserId == me && !n.IsRead, ct);
        return Ok(new NotificationListDto(unread, items));
    }

    /// <summary>POST /notifications/{id}/read — mark one as read.</summary>
    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == me, ct);
        if (n is null) return NotFound();
        if (!n.IsRead)
        {
            n.IsRead = true;
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    /// <summary>POST /notifications/read-all — mark all of the caller's as read.</summary>
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        await _db.Notifications
            .Where(n => n.UserId == me && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
        return NoContent();
    }

    /// <summary>DELETE /notifications — clear all of the caller's notifications.</summary>
    [HttpDelete]
    public async Task<IActionResult> ClearAll(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        await _db.Notifications.Where(n => n.UserId == me).ExecuteDeleteAsync(ct);
        return NoContent();
    }
}
