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
[Route("admin/videos")]
[Authorize(Roles = "Admin")]
public class AdminMusicVideosController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly NotificationService _notifications;
    private readonly IStorageService _storage;
    private readonly ILogger<AdminMusicVideosController> _logger;

    public AdminMusicVideosController(
        AppDbContext db,
        MediaMapper mapper,
        NotificationService notifications,
        IStorageService storage,
        ILogger<AdminMusicVideosController> logger)
    {
        _db = db;
        _mapper = mapper;
        _notifications = notifications;
        _storage = storage;
        _logger = logger;
    }

    private IQueryable<MusicVideo> BaseQuery() => _db.MusicVideos.Include(v => v.Artist);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<MusicVideoDto>>> List([FromQuery] string? status = null, CancellationToken ct = default)
    {
        var q = BaseQuery().AsQueryable();
        if (status == "rejected")
        {
            var resubmittedIds = await _db.ReviewHistories
                .Where(h => h.EntityType == "video" && h.Action == "rejected")
                .Select(h => h.EntityId)
                .Distinct()
                .ToListAsync(ct);
            q = q.Where(v => v.Status == "rejected" || (v.Status == "pending" && resubmittedIds.Contains(v.Id)));
        }
        else if (!string.IsNullOrEmpty(status))
        {
            q = q.Where(v => v.Status == status);
        }
        var videos = await q.OrderByDescending(v => v.CreatedAt).ToListAsync(ct);
        var dtos = new List<MusicVideoDto>(videos.Count);
        foreach (var v in videos) dtos.Add(await _mapper.ToDtoAsync(v, ct));
        return Ok(dtos);
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<MusicVideoDto>>> Pending(CancellationToken ct = default)
    {
        var videos = await BaseQuery()
            .Where(v => v.Status == "pending")
            .OrderBy(v => v.CreatedAt)
            .ToListAsync(ct);
        var dtos = new List<MusicVideoDto>(videos.Count);
        foreach (var v in videos) dtos.Add(await _mapper.ToDtoAsync(v, ct));
        return Ok(dtos);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MusicVideoDto>> Get(Guid id, CancellationToken ct = default)
    {
        var v = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        return v is null ? NotFound() : Ok(await _mapper.ToDtoAsync(v, ct));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<MusicVideoDto>> Update(Guid id, [FromBody] ArtistMusicVideoUpdateRequest req, CancellationToken ct = default)
    {
        var v = await BaseQuery().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return NotFound();

        if (req.Title is not null) v.Title = req.Title.Trim();
        if (req.Description is not null) v.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        if (req.ClearTrack) v.TrackId = null;
        else if (req.TrackId.HasValue) v.TrackId = req.TrackId.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(await _mapper.ToDtoAsync(v, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        var v = await _db.MusicVideos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return NotFound();

        await DeleteKeyQuietlyAsync(v.VideoKey, ct);
        await DeleteKeyQuietlyAsync(v.ThumbnailKey, ct);
        _db.MusicVideos.Remove(v);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var v = await _db.MusicVideos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return NotFound();
        if (v.Status != "pending")
            return Conflict(new { message = $"Video is already {v.Status}." });

        v.Status = "approved";
        v.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "video", EntityId = id,
            Action = "approved", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        if (v.SubmittedByUserId is Guid approvedBy)
            await _notifications.NotifyAsync(approvedBy, "approval",
                $"Your music video \"{v.Title}\" was approved",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "It's now live." : req!.Note,
                linkUrl: $"/videos/{id}", ct: ct);

        return NoContent();
    }

    [HttpPatch("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var v = await _db.MusicVideos.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return NotFound();
        if (v.Status != "pending")
            return Conflict(new { message = $"Video is already {v.Status}." });

        v.Status = "rejected";
        v.ReviewNote = req?.Note;
        _db.ReviewHistories.Add(new ReviewHistory
        {
            EntityType = "video", EntityId = id,
            Action = "rejected", Note = req?.Note,
            ReviewedByName = User.FindFirstValue("name"), ReviewedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);

        if (v.SubmittedByUserId is Guid rejectedBy)
            await _notifications.NotifyAsync(rejectedBy, "rejection",
                $"Your music video \"{v.Title}\" was rejected",
                body: string.IsNullOrWhiteSpace(req?.Note) ? "Open your dashboard to revise and resubmit." : req!.Note,
                linkUrl: "/artist-dashboard", ct: ct);

        return NoContent();
    }

    [HttpGet("{id:guid}/review-history")]
    public async Task<ActionResult<IEnumerable<ReviewHistoryDto>>> GetReviewHistory(Guid id, CancellationToken ct = default)
    {
        var history = await _db.ReviewHistories
            .Where(h => h.EntityType == "video" && h.EntityId == id)
            .OrderBy(h => h.ReviewedAt)
            .ToListAsync(ct);
        return Ok(history.Select(h => new ReviewHistoryDto(
            h.Id, h.EntityType, h.EntityId, h.Action, h.Note, h.ReviewedByName, h.ReviewedAt)));
    }

    private async Task DeleteKeyQuietlyAsync(string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        try { await _storage.DeleteAsync(key, ct); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete music video media object {Key}", key); }
    }
}
