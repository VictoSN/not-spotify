using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/playlists")]
[Authorize(Roles = "Admin")]
public class AdminPlaylistsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public AdminPlaylistsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
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
            q = q.Where(p => p.Name.Contains(search) || (p.Description != null && p.Description.Contains(search)));

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
}

public record SetFeaturedRequest(bool? IsFeatured = null, int? SortOrder = null);
