using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NotSpotify.Api.Data;
using WebPush;

namespace NotSpotify.Api.Services;

public class WebPushOptions
{
    public string? VapidPublic { get; set; }
    public string? VapidPrivate { get; set; }
    /// <summary>VAPID 'sub' contact, must be a mailto: or https: URL.</summary>
    public string VapidSubject { get; set; } = "mailto:admin@notspotify.local";
}

public record WebPushSendFailure(Guid SubscriptionId, string Endpoint, string Reason);

public record WebPushSendReport(
    bool Configured,
    int Subscriptions,
    int Delivered,
    int StaleRemoved,
    IReadOnlyList<WebPushSendFailure> Failures)
{
    public int Failed => Failures.Count;
}

/// <summary>
/// Sends Web Push messages to every PushSubscription a user has registered.
/// Best-effort: a failed delivery (e.g. browser unsubscribed) deletes the
/// stale row so we don't keep retrying it. Never throws to the caller.
/// </summary>
public class WebPushService
{
    private readonly AppDbContext _db;
    private readonly WebPushOptions _opts;
    private readonly ILogger<WebPushService> _logger;
    private readonly WebPushClient _client;

    public WebPushService(AppDbContext db, IOptions<WebPushOptions> opts, ILogger<WebPushService> logger)
    {
        _db = db;
        _opts = opts.Value;
        _logger = logger;
        _client = new WebPushClient();
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_opts.VapidPublic) &&
        !string.IsNullOrWhiteSpace(_opts.VapidPrivate);

    public string? PublicKey => _opts.VapidPublic;

    public async Task<WebPushSendReport> SendToUserAsync(
        Guid userId,
        string title,
        string body,
        string? linkUrl = null,
        string? imageUrl = null,
        string? tag = null,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
            return new WebPushSendReport(false, 0, 0, 0, Array.Empty<WebPushSendFailure>());

        var subs = await _db.PushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync(ct);
        if (subs.Count == 0)
            return new WebPushSendReport(true, 0, 0, 0, Array.Empty<WebPushSendFailure>());

        var payload = JsonSerializer.Serialize(new
        {
            title,
            body,
            url = linkUrl,
            icon = imageUrl,
            tag,
        });

        var vapid = new VapidDetails(_opts.VapidSubject, _opts.VapidPublic, _opts.VapidPrivate);
        var stale = new List<Guid>();
        var failures = new List<WebPushSendFailure>();
        var delivered = 0;

        foreach (var s in subs)
        {
            try
            {
                var ps = new WebPush.PushSubscription(s.Endpoint, s.P256dh, s.AuthSecret);
                await _client.SendNotificationAsync(ps, payload, vapid);
                delivered++;
            }
            catch (WebPushException ex) when (
                ex.StatusCode == System.Net.HttpStatusCode.NotFound ||
                ex.StatusCode == System.Net.HttpStatusCode.Gone)
            {
                stale.Add(s.Id);
            }
            catch (WebPushException ex)
            {
                var reason = $"{(int)ex.StatusCode} {ex.StatusCode}: {ex.Message}";
                failures.Add(new WebPushSendFailure(s.Id, s.Endpoint, reason));
                _logger.LogWarning(ex, "Web push send failed for {SubId}", s.Id);
            }
            catch (Exception ex)
            {
                failures.Add(new WebPushSendFailure(s.Id, s.Endpoint, ex.Message));
                _logger.LogWarning(ex, "Web push send failed for {SubId}", s.Id);
            }
        }

        if (stale.Count > 0)
        {
            await _db.PushSubscriptions
                .Where(s => stale.Contains(s.Id))
                .ExecuteDeleteAsync(ct);
        }

        return new WebPushSendReport(true, subs.Count, delivered, stale.Count, failures);
    }
}
