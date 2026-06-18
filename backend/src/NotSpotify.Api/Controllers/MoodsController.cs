using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("moods")]
public class MoodsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public MoodsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<MoodTagDto>>> List(CancellationToken ct = default)
    {
        var tags = await _db.MoodTags
            .OrderBy(m => m.Kind)
            .ThenBy(m => m.SortOrder)
            .ThenBy(m => m.Name)
            .ToListAsync(ct);
        return Ok(tags.Select(m => _mapper.ToDto(m)));
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<MoodTagDto>> Get(string slug, CancellationToken ct = default)
    {
        var tag = await _db.MoodTags.FirstOrDefaultAsync(m => m.Slug == slug, ct);
        return tag is null ? NotFound() : Ok(_mapper.ToDto(tag));
    }

    [HttpGet("{slug}/tracks")]
    public async Task<ActionResult<IEnumerable<TrackDto>>> Tracks(string slug, CancellationToken ct = default)
    {
        var tag = await _db.MoodTags.FirstOrDefaultAsync(m => m.Slug == slug, ct);
        if (tag is null) return NotFound();

        var tracks = await _db.Tracks
            .Where(t => t.Status == "approved" && t.TrackMoodTags.Any(tm => tm.MoodTagId == tag.Id))
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderByDescending(t => t.PlayCount)
            .Take(50)
            .ToListAsync(ct);
        return Ok(await _mapper.ToDtoListAsync(tracks, ct));
    }

    [HttpGet("{slug}/playlists")]
    public async Task<ActionResult<IEnumerable<PlaylistSummaryDto>>> Playlists(string slug, CancellationToken ct = default)
    {
        var tag = await _db.MoodTags.FirstOrDefaultAsync(m => m.Slug == slug, ct);
        if (tag is null) return NotFound();

        var playlists = await _db.Playlists
            .Where(p => p.IsPublic && p.PlaylistMoodTags.Any(pm => pm.MoodTagId == tag.Id))
            .Include(p => p.Owner)
            .Include(p => p.PlaylistTracks)
            .OrderByDescending(p => p.FollowerCount)
            .ThenByDescending(p => p.UpdatedAt)
            .Take(24)
            .ToListAsync(ct);

        return Ok(playlists.Select(p => _mapper.ToSummary(p)));
    }
}
