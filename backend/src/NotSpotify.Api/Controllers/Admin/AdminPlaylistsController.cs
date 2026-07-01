using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/playlists")]
[Authorize(Roles = "Admin")]
public class AdminPlaylistsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;
    private readonly ILogger<AdminPlaylistsController> _logger;

    public AdminPlaylistsController(AppDbContext db, MediaMapper mapper, ILogger<AdminPlaylistsController> logger)
    {
        _db = db;
        _mapper = mapper;
        _logger = logger;
    }

    /// <summary>
    /// List all playlists (including private) for admin management.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlaylistSummaryDto>>> List(
        [FromQuery] string? search,
        CancellationToken ct = default)
    {
        var q = _db.Playlists
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var like = $"%{search}%";
            q = q.Where(p =>
                EF.Functions.ILike(p.Name, like) ||
                (p.Description != null && EF.Functions.ILike(p.Description, like)) ||
                EF.Functions.ILike(p.Owner.Name, like));
        }

        var playlists = await q
            .OrderByDescending(p => p.IsFeatured)
            .ThenBy(p => p.SortOrder)
            .ThenByDescending(p => p.UpdatedAt)
            .ToListAsync(ct);

        return Ok(playlists.Select(p => _mapper.ToSummary(p, isOwner: false, isSaved: false)));
    }

    /// <summary>
    /// Toggle IsFeatured and/or set SortOrder for a playlist.
    /// </summary>
    [HttpPatch("{id:guid}/feature")]
    public async Task<ActionResult<PlaylistSummaryDto>> SetFeatured(
        Guid id,
        [FromBody] SetFeaturedRequest req,
        CancellationToken ct = default)
    {
        var p = await _db.Playlists
            .Include(x => x.Owner)
            .Include(x => x.PlaylistTracks)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (p is null) return NotFound();

        if (req.IsFeatured is not null)
            p.IsFeatured = req.IsFeatured.Value;

        if (req.SortOrder is not null)
            p.SortOrder = req.SortOrder.Value;

        p.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(_mapper.ToSummary(p));
    }

    /// <summary>
    /// Admin soft-delete: snapshot the playlist into DeletedPlaylists (30-day
    /// recoverable window, same as owner-initiated delete) and remove it. The
    /// acting admin id is logged for traceability; the DeletedPlaylist.UserId
    /// stays as the original owner so restore workflows work unchanged.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromBody] AdminDeletePlaylistRequest? req,
        CancellationToken ct = default)
    {
        var p = await _db.Playlists
            .Include(x => x.PlaylistTracks)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();

        var snapshotTracks = p.PlaylistTracks
            .OrderBy(pt => pt.Position)
            .Select(pt => new { pt.TrackId, pt.Position })
            .ToList();

        _db.DeletedPlaylists.Add(new DeletedPlaylist
        {
            Id = Guid.NewGuid(),
            OriginalPlaylistId = p.Id,
            UserId = p.OwnerId,
            Name = p.Name,
            Description = p.Description,
            CoverUrl = p.CoverUrl,
            CoverKey = p.CoverKey,
            IsPublic = p.IsPublic,
            Visibility = p.Visibility,
            Rules = p.Rules,
            TracksJson = JsonSerializer.Serialize(snapshotTracks),
            DeletedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
        });

        _db.Playlists.Remove(p);
        await _db.SaveChangesAsync(ct);

        var adminId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation(
            "Admin {AdminId} deleted playlist {PlaylistId} '{PlaylistName}' owned by {OwnerId}. Reason: {Reason}",
            adminId, p.Id, p.Name, p.OwnerId, req?.Reason ?? "(none)");

        return NoContent();
    }
}

public record SetFeaturedRequest(bool? IsFeatured = null, int? SortOrder = null);

public record AdminDeletePlaylistRequest(string? Reason = null);
