using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;
using NotSpotify.Api.Services;

namespace NotSpotify.Api.Controllers.Admin;

[ApiController]
[Route("admin/applications")]
[Authorize(Roles = "Admin")]
public class AdminApplicationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly MediaMapper _mapper;

    public AdminApplicationsController(AppDbContext db, UserManager<ApplicationUser> users, MediaMapper mapper)
    {
        _db = db;
        _users = users;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ArtistApplicationDto>>> List(
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        var q = _db.ArtistApplications
            .Include(a => a.User)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            q = q.Where(a => a.Status == status);

        var apps = await q.OrderByDescending(a => a.SubmittedAt).ToListAsync(ct);
        return Ok(apps.Select(ToDto));
    }

    [HttpPatch("{id:guid}/approve")]
    public async Task<ActionResult<ArtistApplicationDto>> Approve(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var reviewerId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(reviewerId, out var reviewerGuid)) return Unauthorized();

        var app = await _db.ArtistApplications
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (app is null) return NotFound();
        if (app.Status != "pending")
            return Conflict(new { message = $"Application is already {app.Status}." });

        // Create Artist entity from application details.
        var artist = new Artist
        {
            Id = Guid.NewGuid(),
            Name = app.DisplayName,
            Bio = app.Bio,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Artists.Add(artist);

        // Link artist to user.
        app.User.ArtistId = artist.Id;
        await _users.UpdateAsync(app.User);

        // Assign Artist role.
        if (!await _users.IsInRoleAsync(app.User, "Artist"))
            await _users.AddToRoleAsync(app.User, "Artist");

        // Stamp the application.
        app.Status = "approved";
        app.ReviewedAt = DateTime.UtcNow;
        app.ReviewedByUserId = reviewerGuid;
        app.ReviewNote = req?.Note;

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(app));
    }

    [HttpPatch("{id:guid}/reject")]
    public async Task<ActionResult<ArtistApplicationDto>> Reject(Guid id, [FromBody] ReviewApplicationRequest? req, CancellationToken ct = default)
    {
        var reviewerId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(reviewerId, out var reviewerGuid)) return Unauthorized();

        var app = await _db.ArtistApplications
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (app is null) return NotFound();
        if (app.Status != "pending")
            return Conflict(new { message = $"Application is already {app.Status}." });

        app.Status = "rejected";
        app.ReviewedAt = DateTime.UtcNow;
        app.ReviewedByUserId = reviewerGuid;
        app.ReviewNote = req?.Note;

        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(app));
    }

    private static ArtistApplicationDto ToDto(ArtistApplication a) => new(
        a.Id,
        a.UserId,
        a.User.Name,
        a.User.Email ?? string.Empty,
        a.DisplayName,
        a.Bio,
        a.SampleWorkUrl,
        a.Status,
        a.SubmittedAt,
        a.ReviewedAt,
        a.ReviewNote
    );
}
