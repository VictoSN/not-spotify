using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("videos")]
public class MusicVideosController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public MusicVideosController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    /// <summary>The /videos catalogue — newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<MusicVideoDto>>> List(CancellationToken ct = default)
    {
        var videos = await _db.MusicVideos
            .Include(v => v.Artist)
            .Where(v => v.Status == "approved")
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(ct);

        var dtos = new List<MusicVideoDto>(videos.Count);
        foreach (var v in videos) dtos.Add(await _mapper.ToDtoAsync(v, ct));
        return Ok(dtos);
    }

    /// <summary>A single video (counts a view on load).</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MusicVideoDto>> Get(Guid id, CancellationToken ct = default)
    {
        var video = await _db.MusicVideos.Include(v => v.Artist)
            .FirstOrDefaultAsync(v => v.Id == id && v.Status == "approved", ct);
        if (video is null) return NotFound();

        await _db.MusicVideos.Where(v => v.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.ViewCount, v => v.ViewCount + 1), ct);
        video.ViewCount += 1;

        return Ok(await _mapper.ToDtoAsync(video, ct));
    }

    /// <summary>The MV accompanying a given audio track, or 404 if none exists.</summary>
    [HttpGet("by-track/{trackId:guid}")]
    public async Task<ActionResult<MusicVideoDto>> GetByTrack(Guid trackId, CancellationToken ct = default)
    {
        var video = await _db.MusicVideos
            .Include(v => v.Artist)
            .FirstOrDefaultAsync(v => v.TrackId == trackId && v.Status == "approved", ct);
        if (video is null) return NotFound();
        return Ok(await _mapper.ToDtoAsync(video, ct));
    }

    [HttpGet("{id:guid}/comments")]
    public async Task<ActionResult<IEnumerable<MusicVideoCommentDto>>> GetComments(Guid id, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 200);

        var exists = await _db.MusicVideos.AnyAsync(v => v.Id == id, ct);
        if (!exists) return NotFound();

        var comments = await _db.MusicVideoComments
            .Where(c => c.MusicVideoId == id && c.ParentId == null)
            .Include(c => c.User)
            .OrderByDescending(c => c.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);

        return Ok(comments.Select(ToDto));
    }

    [HttpGet("{id:guid}/comments/{commentId:guid}/replies")]
    public async Task<ActionResult<IEnumerable<MusicVideoCommentDto>>> GetCommentReplies(Guid id, Guid commentId, CancellationToken ct = default)
    {
        var exists = await _db.MusicVideos.AnyAsync(v => v.Id == id, ct);
        if (!exists) return NotFound();

        var replies = await _db.MusicVideoComments
            .Where(c => c.MusicVideoId == id && c.ParentId == commentId)
            .Include(c => c.User)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(ct);

        return Ok(replies.Select(ToDto));
    }

    [HttpPost("{id:guid}/comments")]
    [Authorize]
    public async Task<ActionResult<MusicVideoCommentDto>> PostComment(Guid id, [FromBody] CreateCommentRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Body) || req.Body.Length > 1000)
            return BadRequest(new { message = "Comment body must be 1-1000 characters." });

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdValue, out var userId)) return Unauthorized();

        var video = await _db.MusicVideos
            .Where(v => v.Id == id)
            .Select(v => new { v.DurationMs })
            .FirstOrDefaultAsync(ct);
        if (video is null) return NotFound();

        if (req.ParentId is { } parentId)
        {
            var parentExists = await _db.MusicVideoComments.AnyAsync(c => c.Id == parentId && c.MusicVideoId == id, ct);
            if (!parentExists) return BadRequest(new { message = "Parent comment not found on this music video." });
        }
        if (req.ParentId is not null && req.TimestampMs is not null)
            return BadRequest(new { message = "Replies cannot be pinned to the timeline." });
        if (req.TimestampMs is < 0 || req.TimestampMs > video.DurationMs)
            return BadRequest(new { message = "Comment timestamp must be within the video duration." });

        var comment = new Models.MusicVideoComment
        {
            MusicVideoId = id,
            UserId = userId,
            Body = req.Body.Trim(),
            ParentId = req.ParentId,
            TimestampMs = req.TimestampMs,
            CreatedAt = DateTime.UtcNow,
        };

        _db.MusicVideoComments.Add(comment);
        await _db.SaveChangesAsync(ct);

        await _db.Entry(comment).Reference(c => c.User).LoadAsync(ct);

        return CreatedAtAction(nameof(GetComments), new { id }, ToDto(comment));
    }

    [HttpDelete("{id:guid}/comments/{commentId:guid}")]
    [Authorize]
    public async Task<IActionResult> DeleteComment(Guid id, Guid commentId, CancellationToken ct = default)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdValue, out var userId)) return Unauthorized();

        var comment = await _db.MusicVideoComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.MusicVideoId == id, ct);

        if (comment is null) return NotFound();

        var isAdmin = User.IsInRole("Admin");
        if (comment.UserId != userId && !isAdmin)
            return StatusCode(403, new { message = "You can only delete your own comments." });

        var replies = await _db.MusicVideoComments
            .Where(c => c.ParentId == commentId)
            .ToListAsync(ct);
        _db.MusicVideoComments.RemoveRange(replies);
        _db.MusicVideoComments.Remove(comment);
        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    private MusicVideoCommentDto ToDto(Models.MusicVideoComment c) =>
        new(c.Id, c.MusicVideoId, _mapper.ToRef(c.User), c.Body, c.ParentId, c.TimestampMs, c.CreatedAt);
}
