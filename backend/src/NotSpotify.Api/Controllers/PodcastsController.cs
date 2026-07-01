using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("podcasts")]
public class PodcastsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MediaMapper _mapper;

    public PodcastsController(AppDbContext db, MediaMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    /// <summary>The /podcasts catalogue — every approved show with its approved episode count.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PodcastSummaryDto>>> List(CancellationToken ct = default)
    {
        var podcasts = await _db.Podcasts
            .Include(p => p.Episodes.Where(e => e.Status == "approved"))
            .Where(p => p.Status == "approved")
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
        return Ok(podcasts.Select(p => _mapper.ToSummary(p)));
    }

    /// <summary>A single show with its full, resolved (approved) episode list.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PodcastDto>> Get(Guid id, CancellationToken ct = default)
    {
        var podcast = await _db.Podcasts
            .Include(p => p.Episodes.Where(e => e.Status == "approved"))
            .FirstOrDefaultAsync(p => p.Id == id && p.Status == "approved", ct);
        if (podcast is null) return NotFound();
        return Ok(await _mapper.ToDtoAsync(podcast, ct));
    }

    /// <summary>Just the approved episodes for a show (newest first), for lightweight loads.</summary>
    [HttpGet("{id:guid}/episodes")]
    public async Task<ActionResult<IEnumerable<EpisodeDto>>> Episodes(Guid id, CancellationToken ct = default)
    {
        var podcast = await _db.Podcasts
            .Include(p => p.Episodes.Where(e => e.Status == "approved"))
            .FirstOrDefaultAsync(p => p.Id == id && p.Status == "approved", ct);
        if (podcast is null) return NotFound();

        var dtos = new List<EpisodeDto>();
        foreach (var ep in podcast.Episodes.OrderBy(e => e.EpisodeNumber).ThenByDescending(e => e.PublishedAt))
        {
            ep.Podcast = podcast;
            dtos.Add(await _mapper.ToDtoAsync(ep, ct));
        }
        return Ok(dtos);
    }
}
