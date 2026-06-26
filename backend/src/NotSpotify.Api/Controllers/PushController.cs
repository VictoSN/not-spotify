using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("push")]
public class PushController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly WebPushService _push;

    public PushController(AppDbContext db, WebPushService push)
    {
        _db = db;
        _push = push;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    /// <summary>Returns the VAPID public key the browser needs to subscribe.</summary>
    [HttpGet("vapid-public-key")]
    public IActionResult VapidPublicKey()
    {
        var key = _push.PublicKey;
        if (string.IsNullOrEmpty(key))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Web Push is not configured on this server." });
        return Ok(new { publicKey = key });
    }

    public record PushSubscribeDto(string Endpoint, string P256dh, string AuthSecret);

    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscribeDto dto, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        if (string.IsNullOrWhiteSpace(dto.Endpoint) ||
            string.IsNullOrWhiteSpace(dto.P256dh) ||
            string.IsNullOrWhiteSpace(dto.AuthSecret))
            return BadRequest(new { message = "endpoint, p256dh and authSecret are required." });

        // Endpoint is globally unique — upsert to whoever owns this browser now.
        var existing = await _db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == dto.Endpoint, ct);
        if (existing is not null)
        {
            existing.UserId = me.Value;
            existing.P256dh = dto.P256dh;
            existing.AuthSecret = dto.AuthSecret;
        }
        else
        {
            _db.PushSubscriptions.Add(new PushSubscriptionRow
            {
                UserId = me.Value,
                Endpoint = dto.Endpoint,
                P256dh = dto.P256dh,
                AuthSecret = dto.AuthSecret,
            });
        }
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record PushUnsubscribeDto(string Endpoint);

    [HttpPost("unsubscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe([FromBody] PushUnsubscribeDto dto, CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();

        await _db.PushSubscriptions
            .Where(s => s.UserId == me.Value && s.Endpoint == dto.Endpoint)
            .ExecuteDeleteAsync(ct);
        return NoContent();
    }

    /// <summary>POST /push/test — send a self-test notification to all the caller's devices.</summary>
    [HttpPost("test")]
    [Authorize]
    public async Task<IActionResult> Test(CancellationToken ct = default)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        // Unique tag per call so Windows doesn't collapse repeat tests into a
        // silent Action Center update — every Send-test click should pop a
        // fresh bottom-right banner.
        var report = await _push.SendToUserAsync(me.Value,
            "NotSpotify push works",
            $"If you see this, Web Push is wired up end-to-end. ({DateTime.UtcNow:HH:mm:ss})",
            linkUrl: "/settings",
            tag: $"push_test_{Guid.NewGuid():N}",
            ct: ct);

        if (!report.Configured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Web Push is not configured on this server.", report });

        if (report.Subscriptions == 0)
            return Conflict(new { message = "This account has no browser push subscriptions. Turn Push notifications off and on again.", report });

        if (report.Delivered == 0 && report.Failed > 0)
            return StatusCode(StatusCodes.Status502BadGateway,
                new { message = "The browser push service rejected the test push.", report });

        return Ok(report);
    }
}
