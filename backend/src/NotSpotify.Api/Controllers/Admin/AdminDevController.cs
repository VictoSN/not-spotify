using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;

namespace NotSpotify.Api.Controllers.Admin;

/// <summary>Development-only helpers. All endpoints require Admin role.</summary>
[ApiController]
[Route("admin/dev")]
[Authorize(Roles = "Admin")]
public class AdminDevController : ControllerBase
{
    private readonly AppDbContext _db;
    public AdminDevController(AppDbContext db) => _db = db;

    /// <summary>
    /// Resets all track play counts and play history rows back to zero / empty.
    /// Ratings, saves, and other user data are left untouched.
    /// FOR DEVELOPMENT USE ONLY.
    /// </summary>
    [HttpPost("reset-plays")]
    public async Task<IActionResult> ResetPlays(CancellationToken ct = default)
    {
        await _db.Database.ExecuteSqlRawAsync(@"DELETE FROM ""PlayHistories"";", ct);
        await _db.Database.ExecuteSqlRawAsync(@"UPDATE ""Tracks"" SET ""PlayCount"" = 0;", ct);
        return Ok(new { message = "Play counts reset to zero." });
    }
}
