using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/podcasts")]
[Authorize(Roles = "Admin")]
public class AdminPodcastsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;
    private readonly IStorageService _storage;
    private readonly ILogger<AdminPodcastsController> _logger;

    public AdminPodcastsController(
        AppDbContext db,
        MediaMapper mapper,
        NotificationService notifications,
        IStorageService storage,
        ILogger<AdminPodcastsController> logger)
    {
        _db = db;
        _mapper = mapper;
        _notifications = notifications;
        _storage = storage;
        _logger = logger;
    }

    private IQueryable<Podcast> BaseQuery() => _db.Podcasts.Include(p => p.Episodes).Include(p => p.Artist);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PodcastSummaryDto>>> List([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = BaseQuery().AsQueryable();
        if (status == "rejected")
        {
            var resubmittedIds = await _db.ReviewHistories
                .Where(h => h.EntityType == "podcast" && h.Action == "rejected")
                .Select(h => h.EntityId)
                .Distinct()
                .ToListAsync(ct);
            q = q.Where(p => p.Status == "rejected" || (p.Status == "pending" && resubmittedIds.Contains(p.Id)));
        }
        else if (!string.IsNullOrEmpty(status))
        {
            q = q.Where(p => p.Status == status);
        }
        var podcasts = await q.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        return Ok(podcasts.Select(p => _mapper.ToSummary(p)));
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<PodcastSummaryDto>>> Pending(CancellationToken ct = default)
    {
        var podcasts = await BaseQuery()
            .Where(p => p.Status == "pending")
            .OrderBy(p => p.CreatedAt)
            .ToListAsync(ct);
        return Ok(podcasts.Select(p => _mapper.ToSummary(p)));
    }

    /// <summary>Full show with ALL episodes (any status) — used by the admin drill-down.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PodcastDto>> Get(Guid id, CancellationToken ct = default)
    {
        var p = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        return p is null ? NotFound() : Ok(await _mapper.ToDtoAsync(p, ct));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<PodcastDto>> Update(Guid id, [FromBody] ArtistPodcastUpsertRequest req, CancellationToken ct = default)
    {
        var p = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();

        p.Title = req.Title.Trim();
        p.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        p.Category = string.IsNullOrWhiteSpace(req.Category) ? null : req.Category.Trim();
        await _db.SaveChangesAsync(ct);
        return Ok(await _mapper.ToDtoAsync(p, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var p = await _db.Podcasts.Include(x => x.Episodes).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();

        foreach (var ep in p.Episodes)
        {
            await DeleteKeyQuietlyAsync(ep.AudioKey, ct);
            await DeleteKeyQuietlyAsync(ep.ImageKey, ct);
        }
        await DeleteKeyQuietlyAsync(p.ImageKey, ct);

        _db.Podcasts.Remove(p);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var p = await _db.Podcasts.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.Status != "pending")
            return Conflict(new { message = $"Show is already {p.Status}." });

        p.Status = "approved";
        p.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "podcast", EntityId = id,
            Action = "approved", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        if (p.SubmittedByUserId is Guid approvedBy)
            await _notifications.NotifyAsync(approvedBy, "approval",
                $"Your show \"{p.Title}\" was approved",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "It's now live." : req!.Note,
                linkUrl: $"/podcasts/{id}", ct: ct);

        return NoContent();
    }

    [HttpPatch("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var p = await _db.Podcasts.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        if (p.Status != "pending")
            return Conflict(new { message = $"Show is already {p.Status}." });

        p.Status = "rejected";
        p.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "podcast", EntityId = id,
            Action = "rejected", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        if (p.SubmittedByUserId is Guid rejectedBy)
            await _notifications.NotifyAsync(rejectedBy, "rejection",
                $"Your show \"{p.Title}\" was rejected",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "Open your dashboard to revise and resubmit." : req!.Note,
                linkUrl: "/artist-dashboard", ct: ct);

        return NoContent();
    }

    [HttpGet("{id:guid}/review-history")]
    public async Task<ActionResult<IEnumerable<ReviewHistoryDto>>> GetReviewHistory(Guid id, CancellationToken ct = default)
    {
        var history = await _db.ReviewHistories
            .Where(h => h.EntityType == "podcast" && h.EntityId == id)
            .OrderBy(h => h.ReviewedAt)
            .ToListAsync(ct);
        return Ok(history.Select(h => new ReviewHistoryDto(
            h.Id, h.EntityType, h.EntityId, h.Action, h.Note, h.ReviewedByName, h.ReviewedAt)));
    }

    // ── Episodes ──────────────────────────────────────────────────────────

    [HttpPatch("episodes/{id:guid}")]
    public async Task<ActionResult<EpisodeDto>> UpdateEpisode(Guid id, [FromBody] ArtistEpisodeUpdateRequest req, CancellationToken ct = default)
    {
        var ep = await _db.Episodes.Include(e => e.Podcast).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (ep is null) return NotFound();

        if (req.Title is not null) ep.Title = req.Title.Trim();
        if (req.Description is not null) ep.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        if (req.DurationMs.HasValue) ep.DurationMs = Math.Max(0, req.DurationMs.Value);
        if (req.EpisodeNumber.HasValue) ep.EpisodeNumber = Math.Max(1, req.EpisodeNumber.Value);
        if (req.Explicit.HasValue) ep.Explicit = req.Explicit.Value;
        if (req.PublishedAt.HasValue) ep.PublishedAt = req.PublishedAt.Value;
        await _db.SaveChangesAsync(ct);
        return Ok(await _mapper.ToDtoAsync(ep, ct));
    }

    [HttpDelete("episodes/{id:guid}")]
    public async Task<IActionResult> DeleteEpisode(Guid id, CancellationToken ct = default)
    {
        var ep = await _db.Episodes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (ep is null) return NotFound();

        await DeleteKeyQuietlyAsync(ep.AudioKey, ct);
        await DeleteKeyQuietlyAsync(ep.ImageKey, ct);
        _db.Episodes.Remove(ep);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("episodes/{id:guid}/approve")]
    public async Task<IActionResult> ApproveEpisode(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var ep = await _db.Episodes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (ep is null) return NotFound();
        if (ep.Status != "pending")
            return Conflict(new { message = $"Episode is already {ep.Status}." });

        ep.Status = "approved";
        ep.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "episode", EntityId = id,
            Action = "approved", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        if (ep.SubmittedByUserId is Guid approvedBy)
            await _notifications.NotifyAsync(approvedBy, "approval",
                $"Your episode \"{ep.Title}\" was approved",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "It's now live." : req!.Note,
                linkUrl: $"/podcasts/{ep.PodcastId}", ct: ct);

        return NoContent();
    }

    [HttpPatch("episodes/{id:guid}/reject")]
    public async Task<IActionResult> RejectEpisode(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var ep = await _db.Episodes.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (ep is null) return NotFound();
        if (ep.Status != "pending")
            return Conflict(new { message = $"Episode is already {ep.Status}." });

        ep.Status = "rejected";
        ep.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "episode", EntityId = id,
            Action = "rejected", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        if (ep.SubmittedByUserId is Guid rejectedBy)
            await _notifications.NotifyAsync(rejectedBy, "rejection",
                $"Your episode \"{ep.Title}\" was rejected",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "Open your dashboard to revise and resubmit." : req!.Note,
                linkUrl: "/artist-dashboard", ct: ct);

        return NoContent();
    }

    [HttpGet("episodes/{id:guid}/review-history")]
    public async Task<ActionResult<IEnumerable<ReviewHistoryDto>>> GetEpisodeReviewHistory(Guid id, CancellationToken ct = default)
    {
        var history = await _db.ReviewHistories
            .Where(h => h.EntityType == "episode" && h.EntityId == id)
            .OrderBy(h => h.ReviewedAt)
            .ToListAsync(ct);
        return Ok(history.Select(h => new ReviewHistoryDto(
            h.Id, h.EntityType, h.EntityId, h.Action, h.Note, h.ReviewedByName, h.ReviewedAt)));
    }

    private async Task DeleteKeyQuietlyAsync(string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        try { await _storage.DeleteAsync(key, ct); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete podcast media object {Key}", key); }
    }
}
