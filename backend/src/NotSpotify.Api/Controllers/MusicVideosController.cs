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
        var video = await _db.MusicVideos.Include(v => v.Artist).FirstOrDefaultAsync(v => v.Id == id, ct);
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
            .FirstOrDefaultAsync(v => v.TrackId == trackId, ct);
        if (video is null) return NotFound();
        return Ok(await _mapper.ToDtoAsync(video, ct));
    }
}
