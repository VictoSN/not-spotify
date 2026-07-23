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
/// Personal uploads locker — a user's private audio. Demo-scale: stored via the
/// same <c>IStorageService</c> as the catalogue and resolved for the owner only.
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

    /// <summary>
    /// Ceiling for a presigned (direct-to-S3) upload. Keep in step with the uploads
    /// Lambda's <c>MAX_UPLOAD_BYTES</c> — S3 enforces the real limit via the POST
    /// policy, and this is the backstop that runs if the two ever drift apart.
    /// Unrelated to <see cref="RequestSizeLimitAttribute"/> on <see cref="Upload"/>,
    /// which bounds what may stream *through* this container.
    /// </summary>
    private const long MaxUploadBytes = 100L * 1024 * 1024;

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

    /// <summary>
    /// Registers an object the browser already uploaded straight to S3 with a presigned
    /// URL minted by the uploads Lambda (see docs/aws-lambda-setup.md). The file never
    /// passes through this container — only this small JSON call does.
    /// </summary>
    /// <remarks>
    /// The client is untrusted here in a way it isn't in <see cref="Upload"/>: it names a
    /// key it claims to have written. So this re-derives everything it can rather than
    /// believing the request — ownership from the key's own prefix, existence and size
    /// from S3 itself. A caller who tampers with the key can at worst register something
    /// under their own prefix.
    /// </remarks>
    [HttpPost("complete")]
    public async Task<ActionResult<UserUploadDto>> Complete([FromBody] CompleteUploadRequest req, CancellationToken ct = default)
    {
        if (Me() is not Guid uid) return Unauthorized();

        var key = (req.Key ?? string.Empty).Replace('\\', '/').Trim().TrimStart('/');
        var prefix = $"uploads/{uid}/";
        if (!key.StartsWith(prefix, StringComparison.Ordinal))
            return StatusCode(403, new { message = "That upload key does not belong to you." });

        // Everything after the prefix must be a single flat file name. Without this a key
        // like "uploads/{me}/../{someone-else}/x.mp3" passes the prefix check above.
        var name = key[prefix.Length..];
        if (name.Length == 0 || name.Contains('/') || name.Contains(".."))
            return BadRequest(new { message = "Malformed upload key." });

        var ext = Path.GetExtension(name).ToLowerInvariant();
        if (!AllowedAudioExts.Contains(ext))
            return BadRequest(new { message = $"Unsupported file type '{ext}'." });

        // Presigned URLs are single-use by convention only; S3 will happily accept the
        // same key twice. Without this a replayed call would create duplicate rows
        // pointing at one object, and deleting either would break the other.
        if (await _db.UserUploads.AnyAsync(u => u.AudioKey == key, ct))
            return Conflict(new { message = "That upload is already registered." });

        var size = await _storage.GetSizeAsync(key, ct);
        if (size is null)
            return BadRequest(new { message = "That upload was not found in storage. Try uploading again." });
        if (size > MaxUploadBytes)
        {
            // S3's content-length-range policy should have blocked this; if it somehow
            // didn't, don't leave the oversized object sitting in the bucket.
            try { await _storage.DeleteAsync(key, ct); } catch { /* best effort */ }
            return BadRequest(new { message = "That file is larger than the upload limit." });
        }

        var title = string.IsNullOrWhiteSpace(req.Title)
            ? Path.GetFileNameWithoutExtension(name)
            : req.Title.Trim();

        var upload = new UserUpload
        {
            UserId = uid,
            Title = string.IsNullOrWhiteSpace(title) ? "Untitled" : title,
            Artist = string.IsNullOrWhiteSpace(req.Artist) ? null : req.Artist.Trim(),
            AudioKey = key,
            DurationMs = req.DurationMs ?? 0,
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
        _db.UserUploads.Remove(upload);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<UserUploadDto> ToDtoAsync(UserUpload u, CancellationToken ct)
    {
        var audioUrl = u.AudioKey is not null ? await _storage.GetAudioUrlAsync(u.AudioKey, ct) : u.AudioUrl;
        return new UserUploadDto(u.Id, u.Title, u.Artist, audioUrl, u.DurationMs, u.CreatedAt);
    }
}

/// <summary>Body of <c>POST /me/uploads/complete</c>. <paramref name="Key"/> is the key
/// the uploads Lambda handed out; everything else is metadata the browser collected.</summary>
public record CompleteUploadRequest(string? Key, string? Title, string? Artist, long? DurationMs);

public class UploadAudioForm
{
    public IFormFile? File { get; set; }
    public string? Title { get; set; }
    public string? Artist { get; set; }
    public long? DurationMs { get; set; }
}
