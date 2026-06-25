using System.Text;

namespace NotSpotify.Api.Services;

/// <summary>
/// Builds the normalized, romanization-aware "search blob" stored in
/// <c>Track/Album/Artist.SearchText</c> so that CJK (Chinese/Japanese/Korean)
/// titles can be found Spotify-style by their original script, pinyin,
/// no-space pinyin, syllable initials, and English aliases.
///
/// Example — a track titled "你，好不好？" by Eric Chou (周興哲) becomes a blob that
/// matches: 你 · 你好不好 · ni hao bu hao · nihaobuhao · nhbh · how have you been ·
/// eric chou · 周興哲.
///
/// IMPORTANT: this is match-only. The displayed Title/Name is never changed —
/// only <c>SearchText</c> carries the romanized aliases.
/// </summary>
public static class SearchTextBuilder
{
    /// <summary>
    /// Lowercase, turn every non-alphanumeric character (ASCII punctuation,
    /// CJK punctuation like ，？。、！ and whitespace) into a single space, then
    /// collapse runs and trim. CJK ideographs and kana are letters, so they survive.
    /// </summary>
    public static string Normalize(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var sb = new StringBuilder(input.Length);
        var pendingSpace = false;
        foreach (var ch in input)
        {
            if (char.IsLetterOrDigit(ch))
            {
                if (pendingSpace && sb.Length > 0) sb.Append(' ');
                pendingSpace = false;
                sb.Append(char.ToLowerInvariant(ch));
            }
            else
            {
                pendingSpace = true;
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// The input reduced to its alphanumerics only — no spaces or punctuation.
    /// Lets a no-space query ("nihaobuhao") or a no-punctuation hanzi ("你好不好")
    /// match a title stored with punctuation ("你，好不好？").
    /// </summary>
    public static string Concat(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var sb = new StringBuilder(input.Length);
        foreach (var ch in input)
            if (char.IsLetterOrDigit(ch)) sb.Append(char.ToLowerInvariant(ch));
        return sb.ToString();
    }

    public static string ForArtist(string? name)
        => Build(Gather(name, SearchAliases.Artist));

    public static string ForAlbum(string? title, string? artistName)
        => Build(Gather(title, SearchAliases.Album)
            .Concat(Gather(artistName, SearchAliases.Artist)));

    public static string ForTrack(string? title, string? artistName, string? albumTitle)
        => Build(Gather(title, SearchAliases.Track)
            .Concat(Gather(artistName, SearchAliases.Artist))
            .Concat(Gather(albumTitle, SearchAliases.Album)));

    // Every textual variant for one field: the value itself + any curated aliases
    // (looked up by the value's concat form so punctuation differences don't matter).
    private static IEnumerable<string> Gather(string? value, IReadOnlyDictionary<string, AliasEntry> dict)
    {
        if (string.IsNullOrWhiteSpace(value)) yield break;
        yield return value;
        if (dict.TryGetValue(Concat(value), out var entry))
            foreach (var v in entry.Expand()) yield return v;
    }

    // Normalize each part into a spaced phrase AND a concat token, de-dup at the
    // phrase level (so multi-word phrases like "ni hao bu hao" stay contiguous),
    // and join into one space-separated blob for substring (ILIKE) matching.
    private static string Build(IEnumerable<string> parts)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var ordered = new List<string>();
        void Add(string s)
        {
            if (s.Length > 0 && seen.Add(s)) ordered.Add(s);
        }
        foreach (var p in parts)
        {
            Add(Normalize(p));
            Add(Concat(p));
        }
        return string.Join(' ', ordered);
    }
}

/// <summary>
/// One curated alias entry for a CJK title/name. <see cref="Pinyin"/> is given as
/// syllables (e.g. ["ni","hao","bu","hao"]) and auto-expanded into the spaced form,
/// the no-space form, and the syllable-initials form. <see cref="English"/> and
/// <see cref="Hanzi"/> are added verbatim.
/// </summary>
public sealed record AliasEntry(
    string[]? Pinyin = null,
    string[]? English = null,
    string[]? Hanzi = null)
{
    public IEnumerable<string> Expand()
    {
        if (Pinyin is { Length: > 0 })
        {
            yield return string.Join(' ', Pinyin);                               // ni hao bu hao
            yield return string.Concat(Pinyin);                                  // nihaobuhao
            yield return string.Concat(Pinyin.Where(s => s.Length > 0)
                                             .Select(s => s[0]));                 // nhbh
        }
        foreach (var e in English ?? Array.Empty<string>()) yield return e;
        foreach (var h in Hanzi ?? Array.Empty<string>()) yield return h;
    }
}

/// <summary>
/// Manual romanization dictionary for known CJK catalogue entries. Keyed by the
/// title/name's <see cref="SearchTextBuilder.Concat"/> form so lookups are robust
/// to punctuation (你，好不好？ and 你好不好 resolve to the same key).
///
/// This is a deliberate stop-gap for known Mandopop entries — later this can be
/// replaced/augmented by an automatic pinyin library (e.g. via a romanization
/// service) without changing the storage shape or the search query.
/// </summary>
public static class SearchAliases
{
    private static IReadOnlyDictionary<string, AliasEntry> Index(Dictionary<string, AliasEntry> raw)
    {
        var indexed = new Dictionary<string, AliasEntry>(StringComparer.Ordinal);
        foreach (var (key, value) in raw)
        {
            var k = SearchTextBuilder.Concat(key);
            if (k.Length > 0) indexed[k] = value;
        }
        return indexed;
    }

    public static readonly IReadOnlyDictionary<string, AliasEntry> Artist = Index(new()
    {
        // 周興哲 — both spellings resolve so a track by either name is searchable both ways.
        ["Eric Chou"] = new(Pinyin: new[] { "zhou", "xing", "zhe" }, Hanzi: new[] { "周興哲" }),
        ["周興哲"]    = new(Pinyin: new[] { "zhou", "xing", "zhe" }, English: new[] { "Eric Chou" }),
        // 周杰倫 (Jay Chou)
        ["Jay Chou"] = new(Pinyin: new[] { "zhou", "jie", "lun" }, Hanzi: new[] { "周杰倫", "周杰伦" }),
        ["周杰倫"]    = new(Pinyin: new[] { "zhou", "jie", "lun" }, English: new[] { "Jay Chou" }),
    });

    public static readonly IReadOnlyDictionary<string, AliasEntry> Album = Index(new()
    {
        // 愛，教會我們的事 (2016) — Eric Chou
        ["愛，教會我們的事"] = new(
            Pinyin: new[] { "ai", "jiao", "hui", "wo", "men", "de", "shi" },
            English: new[] { "what love has taught us" }),

        // ── Jay Chou (周杰倫) albums ──────────────────────────────────────────────
        ["周杰倫的床邊故事"] = new(
            Pinyin: new[] { "zhou", "jie", "lun", "de", "chuang", "bian", "gu", "shi" },
            English: new[] { "jay chou's bedtime stories" }),
        ["葉惠美"] = new(
            Pinyin: new[] { "ye", "hui", "mei" },
            English: new[] { "yeh hui-mei" }),
    });

    public static readonly IReadOnlyDictionary<string, AliasEntry> Track = Index(new()
    {
        // ── 愛，教會我們的事 (2016) — Eric Chou (周興哲) ────────────────────────────
        ["你，好不好？"] = new(
            Pinyin: new[] { "ni", "hao", "bu", "hao" },
            English: new[] { "how have you been" }),
        ["想回到那一天"] = new(
            Pinyin: new[] { "xiang", "hui", "dao", "na", "yi", "tian" },
            English: new[] { "i want to go back to that day" }),
        ["愛，教會我們的事"] = new(
            Pinyin: new[] { "ai", "jiao", "hui", "wo", "men", "de", "shi" },
            English: new[] { "what love has taught us" }),
        ["我愛的那種"] = new(
            Pinyin: new[] { "wo", "ai", "de", "na", "zhong" }),
        ["負一分鐘"] = new(
            Pinyin: new[] { "fu", "yi", "fen", "zhong" },
            English: new[] { "minus one minute" }),
        ["明明"] = new(
            Pinyin: new[] { "ming", "ming" }),

        // ── 周杰倫的床邊故事 / Jay Chou's Bedtime Stories (2016) ────────────────────
        ["不該"]       = new(Pinyin: new[] { "bu", "gai" }, English: new[] { "shouldn't be" }),
        ["愛情廢柴"]   = new(Pinyin: new[] { "ai", "qing", "fei", "chai" }),
        ["前世情人"]   = new(Pinyin: new[] { "qian", "shi", "qing", "ren" }),
        ["英雄"]       = new(Pinyin: new[] { "ying", "xiong" }, English: new[] { "hero" }),
        ["說走就走"]   = new(Pinyin: new[] { "shuo", "zou", "jiu", "zou" }),
        ["床邊故事"]   = new(Pinyin: new[] { "chuang", "bian", "gu", "shi" }, English: new[] { "bedtime story" }),
        ["告白氣球"]   = new(Pinyin: new[] { "gao", "bai", "qi", "qiu" }, English: new[] { "love confession" }),
        ["一點點"]     = new(Pinyin: new[] { "yi", "dian", "dian" }),
        ["土耳其冰淇淋"] = new(Pinyin: new[] { "tu", "er", "qi", "bing", "qi", "lin" }, English: new[] { "turkish ice cream" }),

        // ── 葉惠美 / Yeh Hui-Mei (2003) ───────────────────────────────────────────
        ["愛情懸崖"]   = new(Pinyin: new[] { "ai", "qing", "xuan", "ya" }),
        ["以父之名"]   = new(Pinyin: new[] { "yi", "fu", "zhi", "ming" }, English: new[] { "in the name of the father" }),
        ["梯田"]       = new(Pinyin: new[] { "ti", "tian" }),
        ["同一種調調"] = new(Pinyin: new[] { "tong", "yi", "zhong", "diao", "diao" }),
        ["晴天"]       = new(Pinyin: new[] { "qing", "tian" }, English: new[] { "sunny day" }),
        ["雙刀"]       = new(Pinyin: new[] { "shuang", "dao" }),
        ["妳聽得到"]   = new(Pinyin: new[] { "ni", "ting", "de", "dao" }, English: new[] { "you can hear" }),
        ["她的睫毛"]   = new(Pinyin: new[] { "ta", "de", "jie", "mao" }),
        ["懦夫"]       = new(Pinyin: new[] { "nuo", "fu" }, English: new[] { "coward" }),
        ["三年二班"]   = new(Pinyin: new[] { "san", "nian", "er", "ban" }),
    });
}
