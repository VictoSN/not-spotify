using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMoodTagBackfill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // One-time backfill: tag existing approved tracks with mood/activity tags derived
            // from their genres, so /moods has real content on an already-populated DB. Runs
            // once (migration history), so later admin tag edits are not overwritten.
            // ON CONFLICT keeps it safe if some rows were already tagged manually.
            migrationBuilder.Sql(
                """
                INSERT INTO "TrackMoodTags" ("TrackId", "MoodTagId")
                SELECT DISTINCT tg."TrackId", map."MoodTagId"::uuid
                FROM "TrackGenres" tg
                JOIN "Genres" g ON g."Id" = tg."GenreId"
                JOIN "Tracks" t ON t."Id" = tg."TrackId"
                JOIN (VALUES
                    ('electronic',  '2dbfc68f-b589-a91d-a97b-7437a68966b7'),
                    ('electronic',  '0e40c860-c9ef-4d89-10d9-271d791c9b79'),
                    ('synthwave',   '2dbfc68f-b589-a91d-a97b-7437a68966b7'),
                    ('synthwave',   '5d699cff-8e91-d146-a1fc-021093f2f61f'),
                    ('retrowave',   '5d699cff-8e91-d146-a1fc-021093f2f61f'),
                    ('indie',       'f8927005-8cc2-2113-847b-094970420608'),
                    ('indie',       '7aad0fcb-0184-980e-2f82-7f749d2f5929'),
                    ('dream-pop',   'f8927005-8cc2-2113-847b-094970420608'),
                    ('dream-pop',   '07665d18-eb54-3c9d-b8fa-c3415d92cd38'),
                    ('post-rock',   '248a187b-1827-a1f8-c301-577bc7e16310'),
                    ('instrumental','248a187b-1827-a1f8-c301-577bc7e16310'),
                    ('instrumental','07665d18-eb54-3c9d-b8fa-c3415d92cd38'),
                    ('alternative', '5d699cff-8e91-d146-a1fc-021093f2f61f'),
                    ('rnb',         'bf62c5d9-97aa-ce9a-e544-08b226b23d0c'),
                    ('rnb',         'f8927005-8cc2-2113-847b-094970420608'),
                    ('neo-soul',    'bf62c5d9-97aa-ce9a-e544-08b226b23d0c'),
                    ('neo-soul',    '61c71523-fa26-5403-dd0b-b31e5b7969ee'),
                    ('pop',         '0e40c860-c9ef-4d89-10d9-271d791c9b79'),
                    ('pop',         '7aad0fcb-0184-980e-2f82-7f749d2f5929'),
                    ('lo-fi',       '248a187b-1827-a1f8-c301-577bc7e16310'),
                    ('lo-fi',       '07665d18-eb54-3c9d-b8fa-c3415d92cd38'),
                    ('lo-fi',       '61c71523-fa26-5403-dd0b-b31e5b7969ee'),
                    ('bedroom-pop', '61c71523-fa26-5403-dd0b-b31e5b7969ee'),
                    ('bedroom-pop', 'f8927005-8cc2-2113-847b-094970420608')
                ) AS map("GenreSlug", "MoodTagId") ON map."GenreSlug" = g."Slug"
                WHERE t."Status" = 'approved'
                ON CONFLICT DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op: removing only the backfilled rows would also wipe manual admin tags,
            // so this migration is intentionally not reversible at the data level.
        }
    }
}
