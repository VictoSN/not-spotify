using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackWaveforms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'Tracks' AND column_name = 'Waveform'
                    ) THEN
                        ALTER TABLE "Tracks" ADD COLUMN "Waveform" jsonb NULL;
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""ALTER TABLE "Tracks" DROP COLUMN IF EXISTS "Waveform";""");
        }
    }
}
