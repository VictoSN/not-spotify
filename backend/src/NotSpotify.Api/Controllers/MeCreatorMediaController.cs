using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

[ApiController]
[Route("me")]
[Authorize]
public class MeCreatorMediaController : ControllerBase
{
    private const long MaxAudioBytes = 150_000_000;
    private const long MaxVideoBytes = 500_000_000;
    private const long MaxImageBytes = 8_000_000;

    private static readonly HashSet<string> AllowedAudioExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac", ".webm", ".weba",
    };

    private static readonly HashSet<string> AllowedVideoExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".m4v", ".mov", ".webm",
    };

    private static readonly HashSet<string> AllowedImageExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp",
    };

    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly IStorageService _storage;
    private readonly MediaMapper _mapper;
    private readonly ILogger<MeCreatorMediaController> _logger;

    public MeCreatorMediaController(
        AppDbContext db,
        UserManager<ApplicationUser> users,
        IStorageService storage,
        MediaMapper mapper,
        ILogger<MeCreatorMediaController> logger)
    {
        _db = db;
        _users = users;
        _storage = storage;
        _mapper = mapper;
        _logger = logger;
    }

    private Guid? CurrentUserId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    private async Task<(ApplicationUser? User, ActionResult? Error)> CurrentArtistUserAsync()
    {
        var me = CurrentUserId();
        if (me is null) return (null, Unauthorized());
        var user = await _users.FindByIdAsync(me.Value.ToString());
        if (user?.ArtistId is null) return (null, Forbid());
        return (user, null);
    }

    [HttpGet("artist-podcasts")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<IEnumerable<PodcastDto>>> GetArtistPodcasts(CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var podcasts = await _db.Podcasts
            .Where(p => p.ArtistId == user!.ArtistId)
            .Include(p => p.Episodes)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        var dtos = new List<PodcastDto>(podcasts.Count);
        foreach (var podcast in podcasts) dtos.Add(await _mapper.ToDtoAsync(podcast, ct));
        return Ok(dtos);
    }

    [HttpPost("artist-podcasts")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<PodcastDto>> CreateArtistPodcast([FromBody] ArtistPodcastUpsertRequest req, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == user!.ArtistId, ct);
        if (artist is null) return Forbid();

        var title = req.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Podcast title is required." });

        var podcast = new Podcast
        {
            Id = Guid.NewGuid(),
            ArtistId = artist.Id,
            Artist = artist,
            Title = title,
            Author = artist.Name,
            Description = Clean(req.Description),
            Category = Clean(req.Category),
            CreatedAt = DateTime.UtcNow,
        };
        _db.Podcasts.Add(podcast);
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(podcast, ct));
    }

    [HttpPatch("artist-podcasts/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<PodcastDto>> UpdateArtistPodcast(Guid id, [FromBody] ArtistPodcastUpsertRequest req, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var podcast = await _db.Podcasts
            .Include(p => p.Episodes)
            .FirstOrDefaultAsync(p => p.Id == id && p.ArtistId == user!.ArtistId, ct);
        if (podcast is null) return NotFound();

        var artistName = await _db.Artists
            .Where(a => a.Id == user!.ArtistId)
            .Select(a => a.Name)
            .FirstOrDefaultAsync(ct);

        podcast.Title = req.Title.Trim();
        podcast.Author = string.IsNullOrWhiteSpace(artistName) ? podcast.Author : artistName;
        podcast.Description = Clean(req.Description);
        podcast.Category = Clean(req.Category);
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(podcast, ct));
    }

    [HttpDelete("artist-podcasts/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<IActionResult> DeleteArtistPodcast(Guid id, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var podcast = await _db.Podcasts
            .Include(p => p.Episodes)
            .FirstOrDefaultAsync(p => p.Id == id && p.ArtistId == user!.ArtistId, ct);
        if (podcast is null) return NotFound();

        foreach (var episode in podcast.Episodes)
        {
            await DeleteKeyQuietlyAsync(episode.AudioKey, ct);
            await DeleteKeyQuietlyAsync(episode.ImageKey, ct);
        }
        await DeleteKeyQuietlyAsync(podcast.ImageKey, ct);

        _db.Podcasts.Remove(podcast);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("artist-podcasts/{podcastId:guid}/episodes")]
    [Authorize(Roles = "Artist")]
    [RequestSizeLimit(170_000_000)]
    public async Task<ActionResult<EpisodeDto>> UploadArtistEpisode(Guid podcastId, [FromForm] ArtistEpisodeUploadForm form, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var podcast = await _db.Podcasts
            .Include(p => p.Episodes)
            .FirstOrDefaultAsync(p => p.Id == podcastId && p.ArtistId == user!.ArtistId, ct);
        if (podcast is null) return NotFound();

        if (ValidateFile(form.File, AllowedAudioExts, MaxAudioBytes, "audio") is { } fileError) return fileError;
        if (form.Image is not null && ValidateFile(form.Image, AllowedImageExts, MaxImageBytes, "image") is { } imageError) return imageError;

        var title = form.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Episode title is required." });

        var audioKey = await UploadFileAsync(form.File, "audio", form.File.ContentType ?? "audio/mpeg", ct);
        var imageKey = form.Image is null ? null : await UploadFileAsync(form.Image, "covers", form.Image.ContentType ?? "image/jpeg", ct);
        var nextNumber = podcast.Episodes.Count == 0 ? 1 : podcast.Episodes.Max(e => e.EpisodeNumber) + 1;

        var episode = new Episode
        {
            Id = Guid.NewGuid(),
            PodcastId = podcast.Id,
            Podcast = podcast,
            Title = title,
            Description = Clean(form.Description),
            AudioUrl = string.Empty,
            AudioKey = audioKey,
            ImageKey = imageKey,
            DurationMs = form.DurationMs,
            EpisodeNumber = form.EpisodeNumber ?? nextNumber,
            Explicit = form.Explicit,
            PublishedAt = form.PublishedAt ?? DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Episodes.Add(episode);
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(episode, ct));
    }

    [HttpPatch("artist-episodes/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<EpisodeDto>> UpdateArtistEpisode(Guid id, [FromBody] ArtistEpisodeUpdateRequest req, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var episode = await _db.Episodes
            .Include(e => e.Podcast)
            .FirstOrDefaultAsync(e => e.Id == id && e.Podcast.ArtistId == user!.ArtistId, ct);
        if (episode is null) return NotFound();

        if (req.Title is not null) episode.Title = req.Title.Trim();
        if (req.Description is not null) episode.Description = Clean(req.Description);
        if (req.DurationMs.HasValue) episode.DurationMs = Math.Max(0, req.DurationMs.Value);
        if (req.EpisodeNumber.HasValue) episode.EpisodeNumber = Math.Max(1, req.EpisodeNumber.Value);
        if (req.Explicit.HasValue) episode.Explicit = req.Explicit.Value;
        if (req.PublishedAt.HasValue) episode.PublishedAt = req.PublishedAt.Value;
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(episode, ct));
    }

    [HttpDelete("artist-episodes/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<IActionResult> DeleteArtistEpisode(Guid id, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var episode = await _db.Episodes
            .Include(e => e.Podcast)
            .FirstOrDefaultAsync(e => e.Id == id && e.Podcast.ArtistId == user!.ArtistId, ct);
        if (episode is null) return NotFound();

        await DeleteKeyQuietlyAsync(episode.AudioKey, ct);
        await DeleteKeyQuietlyAsync(episode.ImageKey, ct);
        _db.Episodes.Remove(episode);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("artist-videos")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<IEnumerable<MusicVideoDto>>> GetArtistVideos(CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var videos = await _db.MusicVideos
            .Where(v => v.ArtistId == user!.ArtistId)
            .Include(v => v.Artist)
            .OrderByDescending(v => v.CreatedAt)
            .ToListAsync(ct);

        var dtos = new List<MusicVideoDto>(videos.Count);
        foreach (var video in videos) dtos.Add(await _mapper.ToDtoAsync(video, ct));
        return Ok(dtos);
    }

    [HttpPost("artist-videos")]
    [Authorize(Roles = "Artist")]
    [RequestSizeLimit(530_000_000)]
    public async Task<ActionResult<MusicVideoDto>> UploadArtistVideo([FromForm] ArtistMusicVideoUploadForm form, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var artist = await _db.Artists.FirstOrDefaultAsync(a => a.Id == user!.ArtistId, ct);
        if (artist is null) return Forbid();

        if (ValidateFile(form.Video, AllowedVideoExts, MaxVideoBytes, "video") is { } videoError) return videoError;
        if (form.Thumbnail is not null && ValidateFile(form.Thumbnail, AllowedImageExts, MaxImageBytes, "thumbnail") is { } thumbError) return thumbError;

        if (form.TrackId.HasValue && !await OwnsTrackAsync(artist.Id, form.TrackId.Value, ct))
            return BadRequest(new { message = "Linked track must belong to your artist profile." });

        var title = form.Title.Trim();
        if (title.Length == 0) return BadRequest(new { message = "Music video title is required." });

        var videoKey = await UploadFileAsync(form.Video, "videos", form.Video.ContentType ?? "video/mp4", ct);
        var thumbnailKey = form.Thumbnail is null ? null : await UploadFileAsync(form.Thumbnail, "covers", form.Thumbnail.ContentType ?? "image/jpeg", ct);

        var video = new MusicVideo
        {
            Id = Guid.NewGuid(),
            Title = title,
            Description = Clean(form.Description),
            ArtistId = artist.Id,
            Artist = artist,
            TrackId = form.TrackId,
            VideoUrl = string.Empty,
            VideoKey = videoKey,
            ThumbnailKey = thumbnailKey,
            DurationMs = form.DurationMs,
            CreatedAt = DateTime.UtcNow,
        };
        _db.MusicVideos.Add(video);
        await _db.SaveChangesAsync(ct);

        return Ok(await _mapper.ToDtoAsync(video, ct));
    }

    [HttpPatch("artist-videos/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<ActionResult<MusicVideoDto>> UpdateArtistVideo(Guid id, [FromBody] ArtistMusicVideoUpdateRequest req, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var video = await _db.MusicVideos
            .Include(v => v.Artist)
            .FirstOrDefaultAsync(v => v.Id == id && v.ArtistId == user!.ArtistId, ct);
        if (video is null) return NotFound();

        if (req.TrackId.HasValue && !await OwnsTrackAsync(user!.ArtistId!.Value, req.TrackId.Value, ct))
            return BadRequest(new { message = "Linked track must belong to your artist profile." });

        if (req.Title is not null) video.Title = req.Title.Trim();
        if (req.Description is not null) video.Description = Clean(req.Description);
        if (req.ClearTrack) video.TrackId = null;
        else if (req.TrackId.HasValue) video.TrackId = req.TrackId.Value;

        await _db.SaveChangesAsync(ct);
        return Ok(await _mapper.ToDtoAsync(video, ct));
    }

    [HttpDelete("artist-videos/{id:guid}")]
    [Authorize(Roles = "Artist")]
    public async Task<IActionResult> DeleteArtistVideo(Guid id, CancellationToken ct = default)
    {
        var (user, error) = await CurrentArtistUserAsync();
        if (error is not null) return error;

        var video = await _db.MusicVideos
            .FirstOrDefaultAsync(v => v.Id == id && v.ArtistId == user!.ArtistId, ct);
        if (video is null) return NotFound();

        await DeleteKeyQuietlyAsync(video.VideoKey, ct);
        await DeleteKeyQuietlyAsync(video.ThumbnailKey, ct);
        _db.MusicVideos.Remove(video);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<bool> OwnsTrackAsync(Guid artistId, Guid trackId, CancellationToken ct)
        => await _db.Tracks.AnyAsync(t => t.Id == trackId && t.ArtistId == artistId, ct);

    private async Task<string> UploadFileAsync(IFormFile file, string folder, string contentType, CancellationToken ct)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var key = $"{folder}/{Guid.NewGuid():N}{ext}";
        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(key, stream, contentType, ct);
        return key;
    }

    private ActionResult? ValidateFile(IFormFile? file, HashSet<string> allowedExts, long maxBytes, string label)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = $"No {label} file provided." });
        if (file.Length > maxBytes) return BadRequest(new { message = $"{label} file is too large." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExts.Contains(ext)) return BadRequest(new { message = $"Unsupported {label} file type '{ext}'." });

        return null;
    }

    private async Task DeleteKeyQuietlyAsync(string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key)) return;
        try { await _storage.DeleteAsync(key, ct); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete creator media object {Key}", key); }
    }

    private static string? Clean(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }
}
