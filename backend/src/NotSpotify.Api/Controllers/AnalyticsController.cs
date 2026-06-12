using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;

    public AnalyticsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost("visit")]
    [AllowAnonymous]
    public async Task<IActionResult> RecordVisit([FromBody] RecordVisitRequest req, CancellationToken ct = default)
    {
        var path = string.IsNullOrWhiteSpace(req.Path) ? "/" : req.Path.Trim();
        if (path.Length > 512) path = path[..512];

        _db.SiteVisits.Add(new SiteVisit
        {
            Id = Guid.NewGuid(),
            UserId = CurrentUserId(),
            Path = path,
            Method = HttpContext.Request.Method,
            UserAgent = Request.Headers.UserAgent.ToString() is { Length: > 0 } ua
                ? ua[..Math.Min(ua.Length, 512)]
                : null,
            VisitedAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("playback-heartbeat")]
    [Authorize]
    public async Task<IActionResult> PlaybackHeartbeat([FromBody] PlaybackHeartbeatRequest req, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        if (!await _db.Tracks.AnyAsync(t => t.Id == req.TrackId, ct))
            return NotFound(new { message = "Track not found." });

        var now = DateTime.UtcNow;
        var session = await _db.ActivePlaybackSessions
            .FirstOrDefaultAsync(s => s.UserId == me.Value, ct);

        if (session is null)
        {
            _db.ActivePlaybackSessions.Add(new ActivePlaybackSession
            {
                Id = Guid.NewGuid(),
                UserId = me.Value,
                TrackId = req.TrackId,
                StartedAt = now,
                LastSeenAt = now,
            });
        }
        else
        {
            if (session.TrackId != req.TrackId)
            {
                session.TrackId = req.TrackId;
                session.StartedAt = now;
            }

            session.LastSeenAt = now;
        }

        var user = await _db.Users.FindAsync(new object[] { me.Value }, ct);
        if (user is not null) user.LastSeenAt = now;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }
}
