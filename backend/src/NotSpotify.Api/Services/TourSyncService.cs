using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

/// <summary>
/// Keeps each artist's cached Ticketmaster tour dates fresh in the database, so the
/// read path (<c>GET /artists/{id}/tour</c>) never has to call the external API.
/// Refresh is gated by a per-artist TTL and throttled between artists so we stay
/// well under Ticketmaster's rate limit and never over-refresh slow-moving concert
/// data. Artist-authored rows (<see cref="TourDate.Source"/> == "artist") are never
/// touched — only "ticketmaster" rows are upserted/pruned.
/// </summary>
public class TourSyncService
{
    /// <summary>Don't re-hit the API for an artist refreshed more recently than this.</summary>
    public static readonly TimeSpan Ttl = TimeSpan.FromHours(12);
    /// <summary>Pause between artists during a sweep to respect the API rate limit.</summary>
    private static readonly TimeSpan PerArtistDelay = TimeSpan.FromMilliseconds(250);

    private const string TmSource = "ticketmaster";

    private readonly AppDbContext _db;
    private readonly TicketmasterService _ticketmaster;
    private readonly ILogger<TourSyncService> _logger;

    public TourSyncService(AppDbContext db, TicketmasterService ticketmaster, ILogger<TourSyncService> logger)
    {
        _db = db;
        _ticketmaster = ticketmaster;
        _logger = logger;
    }

    /// <summary>
    /// Refreshes every artist whose cache is older than the TTL (or never synced).
    /// <paramref name="force"/> ignores the TTL (used by the manual admin refresh).
    /// </summary>
    public async Task<int> SyncAllAsync(bool force = false, CancellationToken ct = default)
    {
        if (!_ticketmaster.IsConfigured)
        {
            _logger.LogDebug("Tour sync skipped: Ticketmaster not configured.");
            return 0;
        }

        var cutoff = DateTime.UtcNow - Ttl;
        var due = await _db.Artists
            .Where(a => !a.IsRevoked && (force || a.TourSyncedAt == null || a.TourSyncedAt < cutoff))
            .Select(a => a.Id)
            .ToListAsync(ct);

        var synced = 0;
        foreach (var id in due)
        {
            if (ct.IsCancellationRequested) break;
            if (await SyncArtistAsync(id, force: true, ct)) synced++;
            await Task.Delay(PerArtistDelay, ct);
        }

        if (synced > 0) _logger.LogInformation("Tour sync refreshed {Count} artist(s).", synced);
        return synced;
    }

    /// <summary>
    /// Refreshes one artist's cached events. Respects the TTL unless <paramref name="force"/>.
    /// Returns true if an API call was made (whether or not it found events). On API
    /// failure the existing cached rows are left untouched (serve-stale).
    /// </summary>
    public async Task<bool> SyncArtistAsync(Guid artistId, bool force = false, CancellationToken ct = default)
    {
        if (!_ticketmaster.IsConfigured) return false;

        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == artistId, ct);
        if (artist is null) return false;
        if (!force && artist.TourSyncedAt is { } last && DateTime.UtcNow - last < Ttl) return false;

        var live = await _ticketmaster.SearchEventsAsync(artist.Name, 20, ct);

        // Replace this artist's cached TM rows with the fresh set. Artist-authored
        // rows are excluded by the Source filter, so they're never disturbed.
        var existing = await _db.TourDates
            .Where(t => t.ArtistId == artistId && t.Source == TmSource)
            .ToListAsync(ct);
        if (existing.Count > 0) _db.TourDates.RemoveRange(existing);

        foreach (var ev in live)
        {
            _db.TourDates.Add(new TourDate
            {
                ArtistId = artistId,
                Source = TmSource,
                ExternalId = ev.Id,
                EventDate = ev.EventDate,
                City = ev.City,
                Venue = ev.Venue,
                Country = ev.Country,
                TicketUrl = ev.TicketUrl,
            });
        }

        artist.TourSyncedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
