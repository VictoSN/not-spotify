using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContentCountry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent (ADD COLUMN IF NOT EXISTS) so it reconciles cleanly on the
            // shared Supabase DB even if a column was already added out-of-band.
            migrationBuilder.Sql(@"ALTER TABLE ""Artists"" ADD COLUMN IF NOT EXISTS ""Country"" text;");
            migrationBuilder.Sql(@"ALTER TABLE ""Albums"" ADD COLUMN IF NOT EXISTS ""Country"" text;");

            // One-time seed backfill so "Popular in {country}" has market content on
            // the already-populated shared DB. Spread existing artists deterministically
            // across a handful of markets; albums inherit their artist's market. Both
            // guarded by IS NULL so re-runs and hand-set values are left untouched.
            migrationBuilder.Sql(@"
                WITH ranked AS (
                    SELECT ""Id"", ROW_NUMBER() OVER (ORDER BY ""Id"") AS rn
                    FROM ""Artists"" WHERE ""Country"" IS NULL
                )
                UPDATE ""Artists"" a
                SET ""Country"" = (ARRAY['US','GB','CA','AU','DE'])[(r.rn % 5) + 1]
                FROM ranked r WHERE a.""Id"" = r.""Id"";");
            migrationBuilder.Sql(@"
                UPDATE ""Albums"" al
                SET ""Country"" = ar.""Country""
                FROM ""Artists"" ar
                WHERE al.""ArtistId"" = ar.""Id"" AND al.""Country"" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE ""Artists"" DROP COLUMN IF EXISTS ""Country"";");
            migrationBuilder.Sql(@"ALTER TABLE ""Albums"" DROP COLUMN IF EXISTS ""Country"";");
        }
    }
}
