using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/dashboard")]
[Authorize(Roles = "Admin")]
public class AdminDashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public AdminDashboardController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<AdminDashboardStatsDto>> Get(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var today = now.Date;
        var trendStart = today.AddDays(-6);
        var activeSince = now.AddSeconds(-90);
        var topWindowStart = today.AddDays(-29);

        var visitsInWindow = await _db.SiteVisits
            .Where(v => v.VisitedAt >= trendStart)
            .Select(v => v.VisitedAt)
            .ToListAsync(ct);

        var playsInWindow = await _db.PlayHistories
            .Where(p => p.PlayedAt >= trendStart)
            .Select(p => p.PlayedAt)
            .ToListAsync(ct);

        var visitsTrend = BuildTrend(trendStart, visitsInWindow);
        var playsTrend = BuildTrend(trendStart, playsInWindow);

        var topTrackCounts = await _db.PlayHistories
            .Where(p => p.PlayedAt >= topWindowStart)
            .GroupBy(p => p.TrackId)
            .Select(g => new
            {
                TrackId = g.Key,
                Plays = g.Count(),
                UniqueListeners = g.Select(x => x.UserId).Distinct().Count(),
            })
            .OrderByDescending(x => x.Plays)
            .ThenBy(x => x.TrackId)
            .Take(8)
            .ToListAsync(ct);

        var topTrackIds = topTrackCounts.Select(x => x.TrackId).ToList();
        var topTrackRows = await _db.Tracks
            .Where(t => topTrackIds.Contains(t.Id))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .ToListAsync(ct);
        var topTrackById = topTrackRows.ToDictionary(t => t.Id);

        var topTracks = topTrackCounts
            .Where(x => topTrackById.ContainsKey(x.TrackId))
            .Select(x =>
            {
                var track = topTrackById[x.TrackId];
                var album = _mapper.ToRef(track.Album);
                return new AdminTopTrackDto(
                    track.Id,
                    track.Title,
                    track.Artist.Name,
                    track.Album.Title,
                    album.CoverUrl,
                    track.PlayCount,
                    x.Plays,
                    x.UniqueListeners
                );
            })
            .ToList();

        var activeCounts = await _db.ActivePlaybackSessions
            .Where(s => s.LastSeenAt >= activeSince)
            .GroupBy(s => s.TrackId)
            .Select(g => new { TrackId = g.Key, ActiveListeners = g.Count() })
            .OrderByDescending(x => x.ActiveListeners)
            .ThenBy(x => x.TrackId)
            .Take(6)
            .ToListAsync(ct);

        var activeTrackIds = activeCounts.Select(x => x.TrackId).ToList();
        var activeTrackRows = await _db.Tracks
            .Where(t => activeTrackIds.Contains(t.Id))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .ToListAsync(ct);
        var activeTrackById = activeTrackRows.ToDictionary(t => t.Id);

        var activeTracks = activeCounts
            .Where(x => activeTrackById.ContainsKey(x.TrackId))
            .Select(x =>
            {
                var track = activeTrackById[x.TrackId];
                return new AdminActiveTrackDto(
                    track.Id,
                    track.Title,
                    track.Artist.Name,
                    _mapper.ToRef(track.Album).CoverUrl,
                    x.ActiveListeners
                );
            })
            .ToList();

        var recentVisits = await _db.SiteVisits
            .OrderByDescending(v => v.VisitedAt)
            .Take(8)
            .Include(v => v.User)
            .Select(v => new AdminRecentVisitDto(
                v.Path,
                v.User == null ? null : v.User.Name,
                v.VisitedAt
            ))
            .ToListAsync(ct);

        var stats = new AdminDashboardStatsDto(
            TotalVisits: await _db.SiteVisits.LongCountAsync(ct),
            VisitsToday: visitsInWindow.Count(v => v >= today),
            ActiveListeners: await _db.ActivePlaybackSessions.CountAsync(s => s.LastSeenAt >= activeSince, ct),
            TotalUsers: await _db.Users.CountAsync(ct),
            PremiumUsers: await _db.Users.CountAsync(u => u.Plan == "premium", ct),
            TotalTracks: await _db.Tracks.CountAsync(ct),
            TotalArtists: await _db.Artists.CountAsync(ct),
            TotalAlbums: await _db.Albums.CountAsync(ct),
            PendingApplications: await _db.ArtistApplications.CountAsync(a => a.Status == "pending", ct),
            PendingAlbums: await _db.Albums.CountAsync(a => a.Status == "pending", ct),
            PendingTracks: await _db.Tracks.CountAsync(t => t.Status == "pending", ct),
            PlaysToday: playsInWindow.Count(p => p >= today),
            PlaysLast7Days: playsInWindow.Count,
            VisitsTrend: visitsTrend,
            PlaysTrend: playsTrend,
            TopTracks: topTracks,
            ActiveTracks: activeTracks,
            RecentVisits: recentVisits
        );

        return Ok(stats);
    }

    private static IEnumerable<AdminTrendPointDto> BuildTrend(DateTime start, IEnumerable<DateTime> timestamps)
    {
        var grouped = timestamps
            .GroupBy(x => x.Date)
            .ToDictionary(g => g.Key, g => g.Count());

        return Enumerable.Range(0, 7)
            .Select(i => start.AddDays(i))
            .Select(day => new AdminTrendPointDto(day.ToString("MMM d"), grouped.GetValueOrDefault(day, 0)))
            .ToList();
    }
}
