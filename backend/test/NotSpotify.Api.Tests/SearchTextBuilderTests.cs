using NotSpotify.Api.Services;
using Xunit;

namespace NotSpotify.Api.Tests;

/// <summary>
/// Romanization-aware search blob: a CJK track must be findable by its original
/// script, pinyin, no-space pinyin, syllable initials, English alias, and by its
/// artist/album in either script. Matching is the same substring (ILIKE) test the
/// SearchController runs: normalize the query, then check it's contained in the blob.
/// </summary>
public class SearchTextBuilderTests
{
    // Mirrors SearchController: normalize the query, substring-match the blob.
    private static bool Matches(string blob, string query)
        => blob.Contains(SearchTextBuilder.Normalize(query), System.StringComparison.Ordinal);

    [Theory]
    [InlineData("你")]
    [InlineData("你好不好")]
    [InlineData("你，好不好？")]
    [InlineData("ni hao")]
    [InlineData("ni hao bu hao")]
    [InlineData("NIHAOBUHAO")]
    [InlineData("nhbh")]
    [InlineData("how have you been")]
    [InlineData("Eric Chou")]
    [InlineData("周興哲")]
    public void Track_NiHaoBuHao_IsFoundBy(string query)
    {
        var blob = SearchTextBuilder.ForTrack("你，好不好？", "Eric Chou", "愛，教會我們的事");
        Assert.True(Matches(blob, query), $"'{query}' should match blob: {blob}");
    }

    [Fact]
    public void Track_StoredUnderHanziArtist_StillMatchesEnglishName()
    {
        // Even when the artist is stored in Hanzi, the English alias resolves.
        var blob = SearchTextBuilder.ForTrack("明明", "周興哲", "愛，教會我們的事");
        Assert.True(Matches(blob, "Eric Chou"));
        Assert.True(Matches(blob, "ming ming"));
        Assert.True(Matches(blob, "mingming"));
    }

    [Fact]
    public void Artist_IsFoundByPinyinAndAltScript()
    {
        var blob = SearchTextBuilder.ForArtist("Eric Chou");
        Assert.True(Matches(blob, "周興哲"));
        Assert.True(Matches(blob, "zhou xing zhe"));
        Assert.True(Matches(blob, "zxz"));
        Assert.True(Matches(blob, "eric chou"));
    }

    [Fact]
    public void Album_IsFoundByPinyinAndEnglish()
    {
        var blob = SearchTextBuilder.ForAlbum("愛，教會我們的事", "Eric Chou");
        Assert.True(Matches(blob, "ai jiao hui wo men de shi"));
        Assert.True(Matches(blob, "what love has taught us"));
        Assert.True(Matches(blob, "愛教會我們的事"));
    }

    [Fact]
    public void Normalize_CollapsesCjkAndAsciiPunctuationToSpaces()
    {
        Assert.Equal("你 好不好", SearchTextBuilder.Normalize("你，好不好？"));
        Assert.Equal("hello world", SearchTextBuilder.Normalize("  Hello,   World! "));
    }

    [Fact]
    public void Concat_StripsAllSeparators()
    {
        Assert.Equal("你好不好", SearchTextBuilder.Concat("你，好不好？"));
        Assert.Equal("nihaobuhao", SearchTextBuilder.Concat("ni hao bu hao"));
    }

    [Fact]
    public void UnknownTitle_StillCarriesItsOwnTextButNoAliases()
    {
        var blob = SearchTextBuilder.ForTrack("Some English Song", "Static Bloom", "Tape Hiss Diaries");
        Assert.True(Matches(blob, "some english song"));
        Assert.True(Matches(blob, "static bloom"));
        Assert.False(Matches(blob, "nihaobuhao"));
    }
}
