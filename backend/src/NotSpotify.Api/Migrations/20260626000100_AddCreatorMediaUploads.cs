using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <summary>
    /// Adds the small amount of metadata needed for artist-owned podcasts and
    /// music-video uploads. Hand-authored because the podcast/video tables are
    /// created by Program.cs idempotent guards on shared databases.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20260626000100_AddCreatorMediaUploads")]
    public partial class AddCreatorMediaUploads : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Podcasts') THEN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Podcasts' AND column_name = 'ArtistId') THEN
                            ALTER TABLE "Podcasts" ADD COLUMN "ArtistId" uuid NULL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Podcasts_Artists_ArtistId') THEN
                            ALTER TABLE "Podcasts" ADD CONSTRAINT "FK_Podcasts_Artists_ArtistId"
                                FOREIGN KEY ("ArtistId") REFERENCES "Artists"("Id") ON DELETE SET NULL;
                        END IF;
                        EXECUTE 'CREATE INDEX IF NOT EXISTS "IX_Podcasts_ArtistId" ON "Podcasts"("ArtistId")';
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Episodes') THEN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'ImageUrl') THEN
                            ALTER TABLE "Episodes" ADD COLUMN "ImageUrl" text NULL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'ImageKey') THEN
                            ALTER TABLE "Episodes" ADD COLUMN "ImageKey" text NULL;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'Explicit') THEN
                            ALTER TABLE "Episodes" ADD COLUMN "Explicit" boolean NOT NULL DEFAULT false;
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MusicVideos') THEN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MusicVideos' AND column_name = 'Description') THEN
                            ALTER TABLE "MusicVideos" ADD COLUMN "Description" text NULL;
                        END IF;
                    END IF;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MusicVideos')
                        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'MusicVideos' AND column_name = 'Description') THEN
                        ALTER TABLE "MusicVideos" DROP COLUMN "Description";
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Episodes') THEN
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'Explicit') THEN
                            ALTER TABLE "Episodes" DROP COLUMN "Explicit";
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'ImageKey') THEN
                            ALTER TABLE "Episodes" DROP COLUMN "ImageKey";
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Episodes' AND column_name = 'ImageUrl') THEN
                            ALTER TABLE "Episodes" DROP COLUMN "ImageUrl";
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Podcasts') THEN
                        EXECUTE 'DROP INDEX IF EXISTS "IX_Podcasts_ArtistId"';
                        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Podcasts_Artists_ArtistId') THEN
                            ALTER TABLE "Podcasts" DROP CONSTRAINT "FK_Podcasts_Artists_ArtistId";
                        END IF;
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Podcasts' AND column_name = 'ArtistId') THEN
                            ALTER TABLE "Podcasts" DROP COLUMN "ArtistId";
                        END IF;
                    END IF;
                END $$;
                """);
        }
    }
}
