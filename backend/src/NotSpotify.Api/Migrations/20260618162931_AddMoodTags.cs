using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMoodTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent (shared Postgres DB): create the taxonomy + join tables only
            // if they don't already exist, then seed the canonical mood/activity tags.
            migrationBuilder.Sql(
                """
                CREATE TABLE IF NOT EXISTS "MoodTags" (
                    "Id" uuid NOT NULL,
                    "Name" text NOT NULL,
                    "Slug" text NOT NULL,
                    "Kind" text NOT NULL,
                    "Color" text NOT NULL,
                    "Icon" text NULL,
                    "SearchQuery" text NULL,
                    "SortOrder" integer NOT NULL,
                    CONSTRAINT "PK_MoodTags" PRIMARY KEY ("Id")
                );

                CREATE TABLE IF NOT EXISTS "TrackMoodTags" (
                    "TrackId" uuid NOT NULL,
                    "MoodTagId" uuid NOT NULL,
                    CONSTRAINT "PK_TrackMoodTags" PRIMARY KEY ("TrackId", "MoodTagId"),
                    CONSTRAINT "FK_TrackMoodTags_MoodTags_MoodTagId" FOREIGN KEY ("MoodTagId")
                        REFERENCES "MoodTags" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_TrackMoodTags_Tracks_TrackId" FOREIGN KEY ("TrackId")
                        REFERENCES "Tracks" ("Id") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS "PlaylistMoodTags" (
                    "PlaylistId" uuid NOT NULL,
                    "MoodTagId" uuid NOT NULL,
                    CONSTRAINT "PK_PlaylistMoodTags" PRIMARY KEY ("PlaylistId", "MoodTagId"),
                    CONSTRAINT "FK_PlaylistMoodTags_MoodTags_MoodTagId" FOREIGN KEY ("MoodTagId")
                        REFERENCES "MoodTags" ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_PlaylistMoodTags_Playlists_PlaylistId" FOREIGN KEY ("PlaylistId")
                        REFERENCES "Playlists" ("Id") ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_MoodTags_Slug" ON "MoodTags" ("Slug");
                CREATE INDEX IF NOT EXISTS "IX_MoodTags_Kind_SortOrder" ON "MoodTags" ("Kind", "SortOrder");
                CREATE INDEX IF NOT EXISTS "IX_TrackMoodTags_MoodTagId" ON "TrackMoodTags" ("MoodTagId");
                CREATE INDEX IF NOT EXISTS "IX_PlaylistMoodTags_MoodTagId" ON "PlaylistMoodTags" ("MoodTagId");

                -- Canonical taxonomy. ON CONFLICT keeps this safe to re-run and lets an
                -- admin edit a tag later without the migration overwriting their changes.
                INSERT INTO "MoodTags" ("Id", "Name", "Slug", "Kind", "Color", "Icon", "SearchQuery", "SortOrder") VALUES
                    ('248a187b-1827-a1f8-c301-577bc7e16310', 'Focus',   'focus',   'activity', '#2563eb', 'BriefcaseIcon', 'focus instrumental', 0),
                    ('2dbfc68f-b589-a91d-a97b-7437a68966b7', 'Workout', 'workout', 'activity', '#dc2626', 'BoltIcon',      'workout energy',     1),
                    ('0e40c860-c9ef-4d89-10d9-271d791c9b79', 'Party',   'party',   'activity', '#9333ea', 'SparklesIcon',  'party dance',        2),
                    ('07665d18-eb54-3c9d-b8fa-c3415d92cd38', 'Sleep',   'sleep',   'activity', '#334155', 'MoonIcon',      'sleep ambient',      3),
                    ('7aad0fcb-0184-980e-2f82-7f749d2f5929', 'Morning', 'morning', 'activity', '#ca8a04', 'SunIcon',       'morning',            4),
                    ('61c71523-fa26-5403-dd0b-b31e5b7969ee', 'At Home', 'at-home', 'activity', '#16a34a', 'HomeIcon',      'home acoustic',      5),
                    ('f8927005-8cc2-2113-847b-094970420608', 'Chill',   'chill',   'mood',     '#0891b2', 'CloudIcon',     'chill',              0),
                    ('bf62c5d9-97aa-ce9a-e544-08b226b23d0c', 'Love',    'love',    'mood',     '#db2777', 'HeartIcon',     'love',               1),
                    ('5d699cff-8e91-d146-a1fc-021093f2f61f', 'Hype',    'hype',    'mood',     '#ea580c', 'FireIcon',      'hype hip hop rock',  2)
                ON CONFLICT ("Id") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP TABLE IF EXISTS "PlaylistMoodTags";
                DROP TABLE IF EXISTS "TrackMoodTags";
                DROP TABLE IF EXISTS "MoodTags";
                """);
        }
    }
}
