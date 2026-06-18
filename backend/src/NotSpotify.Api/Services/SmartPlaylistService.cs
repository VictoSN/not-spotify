using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NotSpotify.Api.Data;
using NotSpotify.Api.Dtos;
using NotSpotify.Api.Models;

namespace NotSpotify.Api.Services;

public class SmartPlaylistService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;

    public SmartPlaylistService(AppDbContext db) => _db = db;

    public static string? Validate(SmartPlaylistRulesDto? rules)
    {
        if (rules is null) return null;
        if (string.IsNullOrWhiteSpace(rules.Genre)
            && rules.MinimumRating is null
            && rules.MinimumPlayCount is null
            && rules.AddedWithinDays is null)
            return "Choose at least one smart playlist rule.";
        if (rules.MinimumRating is < 1 or > 5)
            return "Minimum rating must be between 1 and 5.";
        if (rules.MinimumPlayCount is < 0)
            return "Minimum play count cannot be negative.";
        if (rules.AddedWithinDays is < 1 or > 3650)
            return "Recently added must be between 1 and 3650 days.";
        if (rules.Limit is < 1 or > 500)
            return "Smart playlist limit must be between 1 and 500.";
        return null;
    }

    public static string Serialize(SmartPlaylistRulesDto rules)
        => JsonSerializer.Serialize(Normalize(rules), JsonOptions);

    public static SmartPlaylistRulesDto? Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<SmartPlaylistRulesDto>(json, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public async Task<List<Track>> ResolveAsync(string rulesJson, CancellationToken ct = default)
    {
        var rules = Deserialize(rulesJson)
            ?? throw new InvalidOperationException("The smart playlist rules are invalid.");
        var query = _db.Tracks
            .AsNoTracking()
            .Where(t => t.Status == "approved")
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(rules.Genre))
        {
            var genre = rules.Genre.Trim().ToLowerInvariant();
            query = query.Where(t => t.TrackGenres.Any(tg => tg.Genre.Slug == genre));
        }

        if (rules.MinimumRating is not null)
        {
            var minimumRating = rules.MinimumRating.Value;
            query = query.Where(t =>
                t.RatingCount > 0 && (double)t.RatingSum / t.RatingCount >= minimumRating);
        }

        if (rules.MinimumPlayCount is not null)
            query = query.Where(t => t.PlayCount >= rules.MinimumPlayCount.Value);

        if (rules.AddedWithinDays is not null)
        {
            var addedAfter = DateTime.UtcNow.AddDays(-rules.AddedWithinDays.Value);
            query = query.Where(t => t.CreatedAt >= addedAfter);
        }

        return await query
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.TrackGenres).ThenInclude(tg => tg.Genre)
            .OrderByDescending(t => t.RatingCount == 0 ? 0 : (double)t.RatingSum / t.RatingCount)
            .ThenByDescending(t => t.PlayCount)
            .ThenByDescending(t => t.CreatedAt)
            .Take(rules.Limit)
            .ToListAsync(ct);
    }

    private static SmartPlaylistRulesDto Normalize(SmartPlaylistRulesDto rules) => rules with
    {
        Genre = string.IsNullOrWhiteSpace(rules.Genre) ? null : rules.Genre.Trim().ToLowerInvariant(),
        Limit = Math.Clamp(rules.Limit, 1, 500),
    };
}
