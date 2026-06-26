namespace NotSpotify.Api.Services;

/// <summary>
/// Automatic Hanzi→pinyin romanization for the search blob. Where
/// <see cref="SearchAliases"/> is a hand-curated, per-title dictionary, this is a
/// per-<b>character</b> dictionary that "crawls" any title character by character and
/// emits the same Spotify-style variants the curated <c>AliasEntry</c> produces:
/// the spaced pinyin ("xue bu hui"), the no-space form ("xuebuhui"), and the syllable
/// initials ("xbh"). So a brand-new Chinese title is searchable by pinyin with no
/// manual entry — the curated dictionary is now only needed for English aliases and
/// special cases.
///
/// Match-only: the displayed Title/Name is never changed.
///
/// The character map is a seed covering the current catalogue; extend it as new Hanzi
/// appear (or later swap it for a full Unihan-derived table / a pinyin NuGet library
/// without changing this API). Readings are toneless primary Mandarin readings; a
/// polyphone falls back to its most common reading, which is sufficient for substring
/// search.
/// </summary>
public static class PinyinRomanizer
{
    /// <summary>
    /// Romanization variants for every maximal run of mapped Hanzi in <paramref name="text"/>.
    /// A run of "美麗的神話" yields "mei li de shen hua", "meilideshenhua", and "mldsh".
    /// Returns an empty list when the text has no mapped Hanzi (e.g. an English title),
    /// so non-CJK content is left untouched.
    /// </summary>
    public static IReadOnlyList<string> Romanize(string? text)
    {
        var results = new List<string>();
        if (string.IsNullOrEmpty(text)) return results;

        var run = new List<string>();
        void Flush()
        {
            if (run.Count == 0) return;
            results.Add(string.Join(' ', run));                 // mei li de shen hua
            results.Add(string.Concat(run));                    // meilideshenhua
            if (run.Count > 1)
                results.Add(string.Concat(run.Select(s => s[0]))); // mldsh
            run.Clear();
        }

        foreach (var ch in text)
        {
            if (Map.TryGetValue(ch, out var py)) run.Add(py);
            else Flush(); // any non-Hanzi (or unmapped) character breaks the run
        }
        Flush();
        return results;
    }

    // Single-character → primary toneless Mandarin reading. Seeded from the current
    // catalogue (JJ Lin 學不會, Beyond 樂與怒, 田馥甄 小幸運, F4, 美麗的神話, …) plus a few
    // very common characters. Keep alphabetised-by-meaning groups for easy extension.
    private static readonly Dictionary<char, string> Map = new()
    {
        // very common
        ['的'] = "de", ['不'] = "bu", ['你'] = "ni", ['我'] = "wo", ['是'] = "shi",
        ['好'] = "hao", ['很'] = "hen", ['在'] = "zai", ['人'] = "ren", ['天'] = "tian",
        ['一'] = "yi", ['和'] = "he", ['與'] = "yu", ['為'] = "wei", ['那'] = "na",
        ['些'] = "xie", ['老'] = "lao", ['朋'] = "peng", ['友'] = "you",

        // 美麗的神話 (The Myth)
        ['美'] = "mei", ['麗'] = "li", ['神'] = "shen", ['話'] = "hua",

        // 學不會 (JJ Lin) + tracks
        ['學'] = "xue", ['會'] = "hui",
        ['白'] = "bai", ['蘭'] = "lan", ['花'] = "hua",
        ['故'] = "gu", ['事'] = "shi", ['細'] = "xi", ['膩'] = "ni",
        ['獨'] = "du", ['奏'] = "zou",
        ['冒'] = "mao", ['險'] = "xian", ['夢'] = "meng",
        ['羊'] = "yang",
        ['存'] = "cun", ['情'] = "qing",
        ['陌'] = "mo", ['生'] = "sheng",
        ['林'] = "lin", ['俊'] = "jun", ['傑'] = "jie",

        // 樂與怒 (Beyond) + tracks
        ['樂'] = "le", ['怒'] = "nu",
        ['爸'] = "ba", ['媽'] = "ma", ['愛'] = "ai", ['容'] = "rong", ['易'] = "yi",
        ['說'] = "shuo", ['平'] = "ping", ['海'] = "hai", ['闊'] = "kuo", ['空'] = "kong",

        // 小幸運 (田馥甄)
        ['小'] = "xiao", ['幸'] = "xing", ['運'] = "yun",
        ['田'] = "tian", ['馥'] = "fu", ['甄'] = "zhen",

        // F4 tracks
        ['真'] = "zhen", ['流'] = "liu", ['星'] = "xing", ['雨'] = "yu",
        ['執'] = "zhi", ['著'] = "zhuo", ['要'] = "yao", ['定'] = "ding",
        ['誰'] = "shui", ['讓'] = "rang", ['淚'] = "lei", ['第'] = "di", ['間'] = "jian",
    };
}
