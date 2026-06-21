using Microsoft.AspNetCore.Mvc;
using NotSpotify.Api.Controllers;
using NotSpotify.Api.Dtos;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// SearchController contract tests.
///
/// NOTE: the title/artist/album/playlist + by-lyrics matching uses
/// <c>EF.Functions.ILike</c>, a Postgres-only operator the EF Core InMemory
/// provider cannot translate — so the *matching* paths are exercised by the
/// running app / manual checks, not here. What IS unit-testable (and worth
/// pinning) is the empty-query contract: a blank query must short-circuit to an
/// all-empty result without running any ILike query.
/// </summary>
public class SearchControllerTests
{
    [Fact]
    public async Task Search_EmptyQuery_ReturnsAllEmptyBuckets()
    {
        await using var db = TestHelpers.NewDb();
        db.SeedTrack("Something"); // present in catalogue but must not be returned for a blank query
        await db.SaveChangesAsync();

        var result = await new SearchController(db, TestHelpers.NewMapper()).Search("");

        var dto = Assert.IsType<SearchResultsDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Empty(dto.Tracks);
        Assert.Empty(dto.Artists);
        Assert.Empty(dto.Albums);
        Assert.Empty(dto.Playlists);
        Assert.Empty(dto.TracksByLyrics);
    }

    [Fact]
    public async Task Search_WhitespaceQuery_ReturnsAllEmptyBuckets()
    {
        await using var db = TestHelpers.NewDb();

        var result = await new SearchController(db, TestHelpers.NewMapper()).Search("   ");

        var dto = Assert.IsType<SearchResultsDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Empty(dto.Tracks);
        Assert.Empty(dto.TracksByLyrics);
    }
}
