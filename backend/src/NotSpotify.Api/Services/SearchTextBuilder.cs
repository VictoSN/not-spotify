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
        var folded = input.Normalize(NormalizationForm.FormKC);
        var sb = new StringBuilder(folded.Length);
        var pendingSpace = false;
        foreach (var ch in folded)
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
        var folded = input.Normalize(NormalizationForm.FormKC);
        var sb = new StringBuilder(folded.Length);
        foreach (var ch in folded)
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
        // Automatic per-character Hanzi→pinyin — additive to (and independent of) the
        // curated aliases, so any Chinese title is pinyin-searchable without an entry.
        foreach (var v in PinyinRomanizer.Romanize(value)) yield return v;
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
    string[]? Romaji = null,
    string[]? English = null,
    string[]? Hanzi = null)
{
    public IEnumerable<string> Expand()
    {
        foreach (var v in ExpandSyllables(Pinyin)) yield return v;
        foreach (var v in ExpandSyllables(Romaji)) yield return v;
        foreach (var e in English ?? Array.Empty<string>()) yield return e;
        foreach (var h in Hanzi ?? Array.Empty<string>()) yield return h;
    }

    private static IEnumerable<string> ExpandSyllables(string[]? syllables)
    {
        if (syllables is { Length: > 0 })
        {
            yield return string.Join(' ', syllables);                            // ni hao bu hao / kai kai kitan
            yield return string.Concat(syllables);                               // nihaobuhao / kaikaikitan
            yield return string.Concat(syllables.Where(s => s.Length > 0)
                                                .Select(s => s[0]));              // nhbh / kkk
        }
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
    // Bump when aliases change. Startup uses this to recompute existing SearchText
    // rows once, so imported songs get new search terms without a manual command.
    public const string Version = "2026-06-27-auto-pinyin-romanizer";

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

        // Japanese catalogue aliases. 7!! is pronounced "seven oops"; the artist
        // is often searched with either the symbol form or the spoken form.
        ["7!!"] = new(English: new[] { "seven oops", "seven!!", "7 oops", "seven" }),
        ["seven oops"] = new(English: new[] { "7!!", "seven!!", "7 oops" }),
        ["Eve"] = new(Hanzi: new[] { "イブ" }),
        ["イブ"] = new(English: new[] { "Eve" }),
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

        // ── Japanese tracks: native script ⇄ romaji / English title search ─────
        // Eve
        ["廻廻奇譚"] = new(
            Romaji: new[] { "kai", "kai", "kitan" },
            English: new[] { "kaikai kitan" }),
        ["Kaikai Kitan"] = new(
            Romaji: new[] { "kai", "kai", "kitan" },
            Hanzi: new[] { "廻廻奇譚" }),
        ["ドラマツルギー"] = new(
            Romaji: new[] { "doramatsurugi" },
            English: new[] { "dramaturgy" }),
        ["Dramaturgy"] = new(
            Romaji: new[] { "doramatsurugi" },
            Hanzi: new[] { "ドラマツルギー" }),
        ["アウトサイダー"] = new(
            Romaji: new[] { "autosaida" },
            English: new[] { "outsider" }),
        ["Outsider"] = new(
            Romaji: new[] { "autosaida" },
            Hanzi: new[] { "アウトサイダー" }),
        ["ナンセンス文学"] = new(
            Romaji: new[] { "nansensu", "bungaku" },
            English: new[] { "nonsense bungaku", "nonsense literature" }),
        ["Nonsense Bungaku"] = new(
            Romaji: new[] { "nansensu", "bungaku" },
            Hanzi: new[] { "ナンセンス文学" }),
        ["お気に召すまま"] = new(
            Romaji: new[] { "oki", "ni", "mesu", "mama" },
            English: new[] { "as you like it" }),
        ["ラストダンス"] = new(
            Romaji: new[] { "rasuto", "dansu" },
            English: new[] { "last dance" }),
        ["Last Dance"] = new(
            Romaji: new[] { "rasuto", "dansu" },
            Hanzi: new[] { "ラストダンス" }),
        ["僕らまだアンダーグラウンド"] = new(
            Romaji: new[] { "bokura", "mada", "andaguraundo" },
            English: new[] { "we're still underground", "bokura mada underground" }),
        ["夜は仄か"] = new(
            Romaji: new[] { "yoru", "wa", "honoka" }),
        ["Yoru wa Honoka"] = new(
            Romaji: new[] { "yoru", "wa", "honoka" },
            Hanzi: new[] { "夜は仄か" }),
        ["群青讃歌"] = new(
            Romaji: new[] { "gunjo", "sanka" },
            English: new[] { "gunjou sanka" }),
        ["Gunjo Sanka"] = new(
            Romaji: new[] { "gunjo", "sanka" },
            Hanzi: new[] { "群青讃歌" }),
        ["心予報"] = new(
            Romaji: new[] { "kokoro", "yohou" },
            English: new[] { "heart forecast" }),
        ["蒼のワルツ"] = new(
            Romaji: new[] { "ao", "no", "warutsu" },
            English: new[] { "ao no waltz", "blue waltz" }),
        ["Ao no Waltz"] = new(
            Romaji: new[] { "ao", "no", "warutsu" },
            Hanzi: new[] { "蒼のワルツ" }),

        // 7!!
        ["オレンジ"] = new(
            Romaji: new[] { "orenji" },
            English: new[] { "orange" }),
        ["Orange"] = new(
            Romaji: new[] { "orenji" },
            Hanzi: new[] { "オレンジ" }),
        ["ラヴァーズ"] = new(
            Romaji: new[] { "ravazu" },
            English: new[] { "lovers" }),
        ["Lovers"] = new(
            Romaji: new[] { "ravazu" },
            Hanzi: new[] { "ラヴァーズ" }),
        ["スタートライン"] = new(
            Romaji: new[] { "sutato", "rain" },
            English: new[] { "start line" }),
        ["Start Line"] = new(
            Romaji: new[] { "sutato", "rain" },
            Hanzi: new[] { "スタートライン" }),
        ["バイバイ"] = new(
            Romaji: new[] { "bai", "bai" },
            English: new[] { "bye bye" }),
        ["Bye Bye"] = new(
            Romaji: new[] { "bai", "bai" },
            Hanzi: new[] { "バイバイ" }),
        ["きみがいるなら"] = new(
            Romaji: new[] { "kimi", "ga", "iru", "nara" }),
        ["この広い空の下で"] = new(
            Romaji: new[] { "kono", "hiroi", "sora", "no", "shita", "de" }),

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
