using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers;

/// <summary>
/// Personal uploads locker — application-level owner-scoped audio. Demo-scale: stored via
/// the same <c>IStorageService</c> as the catalogue and listed for the owner only.
/// </summary>
[ApiController]
[Route("me/uploads")]
[Authorize]
public class MeUploadsController : ControllerBase
{
    private static readonly HashSet<string> AllowedAudioExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac", ".webm",
    };
    private static readonly HashSet<string> AllowedImageExts = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp",
    };

    private readonly AppDbContext _db;
    private readonly IStorageService _storage;

    public MeUploadsController(AppDbContext db, IStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    private Guid? Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var g) ? g : null;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserUploadDto>>> List(CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();
        var uploads = await _db.UserUploads
            .Where(u => u.UserId == uid)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync(ct);

        var dtos = new List<UserUploadDto>(uploads.Count);
        foreach (var u in uploads) dtos.Add(await ToDtoAsync(u, ct));
        return Ok(dtos);
    }

    [HttpPost]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<UserUploadDto>> Upload([FromForm] UploadAudioForm form, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();

        var file = form.File;
        if (file is null || file.Length == 0) return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedAudioExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'." });

        var key = $"uploads/{uid}/{Guid.NewGuid()}{ext}";
        await using (var stream = file.OpenReadStream())
            await _storage.UploadAsync(key, stream, file.ContentType ?? "audio/mpeg", ct);

        var title = string.IsNullOrWhiteSpace(form.Title)
            ? Path.GetFileNameWithoutExtension(file.FileName)
            : form.Title.Trim();

        var upload = new UserUpload
        {
            UserId = uid,
            Title = string.IsNullOrWhiteSpace(title) ? "Untitled" : title,
            Artist = string.IsNullOrWhiteSpace(form.Artist) ? null : form.Artist.Trim(),
            AudioKey = key,
            DurationMs = form.DurationMs ?? 0,
        };
        _db.UserUploads.Add(upload);
        await _db.SaveChangesAsync(ct);

        return Ok(await ToDtoAsync(upload, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();
        var upload = await _db.UserUploads.FirstOrDefaultAsync(u => u.Id == id && u.UserId == uid, ct);
        if (upload is null) return NotFound();

        if (!string.IsNullOrEmpty(upload.AudioKey))
        {
            try { await _storage.DeleteAsync(upload.AudioKey, ct); } catch { /* object may already be gone */ }
        }
        if (!string.IsNullOrEmpty(upload.CoverKey))
        {
            try { await _storage.DeleteAsync(upload.CoverKey, ct); } catch { /* object may already be gone */ }
        }
        _db.UserUploads.Remove(upload);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Sets optional artwork for one of the caller's private uploads.</summary>
    [HttpPost("{id:guid}/cover")]
    [RequestSizeLimit(5_000_000)]
    public async Task<ActionResult<UserUploadDto>> UploadCover(Guid id, [FromForm] UploadCoverForm form, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();
        var upload = await _db.UserUploads.FirstOrDefaultAsync(u => u.Id == id && u.UserId == uid, ct);
        if (upload is null) return NotFound();

        var file = form.File;
        if (file is null || file.Length == 0) return BadRequest(new { message = "No cover image provided." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageExts.Contains(ext))
            return BadRequest(new { message = "Unsupported cover type. Use JPG, PNG, or WebP." });

        var oldKey = upload.CoverKey;
        var key = $"covers/uploads/{uid}/{upload.Id}/{Guid.NewGuid()}{ext}";
        await using var stream = file.OpenReadStream();
        await _storage.UploadAsync(key, stream, file.ContentType ?? "application/octet-stream", ct);

        upload.CoverKey = key;
        await _db.SaveChangesAsync(ct);
        if (!string.IsNullOrEmpty(oldKey))
        {
            try { await _storage.DeleteAsync(oldKey, ct); } catch { /* best effort */ }
        }
        return Ok(await ToDtoAsync(upload, ct));
    }

    private async Task<UserUploadDto> ToDtoAsync(UserUpload u, CancellationToken ct)
    {
        var audioUrl = u.AudioKey is not null ? await _storage.GetAudioUrlAsync(u.AudioKey, ct) : u.AudioUrl;
        var coverUrl = u.CoverKey is not null ? _storage.GetPublicUrl(u.CoverKey) : null;
        return new UserUploadDto(u.Id, u.Title, u.Artist, audioUrl, coverUrl, u.DurationMs, u.CreatedAt);
    }
}

public class UploadAudioForm
{
    public IFormFile? File { get; set; }
    public string? Title { get; set; }
    public string? Artist { get; set; }
    public long? DurationMs { get; set; }
}

public class UploadCoverForm
{
    public IFormFile? File { get; set; }
}
