using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTrackComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: shared Supabase DB may already have this table from
            // the raw-SQL guard in Program.cs.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""TrackComments"" (
                    ""Id""          uuid NOT NULL,
                    ""TrackId""     uuid NOT NULL,
                    ""UserId""      uuid NOT NULL,
                    ""Body""        character varying(1000) NOT NULL,
                    ""ParentId""    uuid NULL,
                    ""TimestampMs"" bigint NULL,
                    ""CreatedAt""   timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT ""PK_TrackComments"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_TrackComments_AspNetUsers_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_TrackComments_Tracks_TrackId""
                        FOREIGN KEY (""TrackId"") REFERENCES ""Tracks""(""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_TrackComments_TrackComments_ParentId""
                        FOREIGN KEY (""ParentId"") REFERENCES ""TrackComments""(""Id"") ON DELETE SET NULL
                );
                CREATE INDEX IF NOT EXISTS ""IX_TrackComments_TrackId_CreatedAt""
                    ON ""TrackComments""(""TrackId"", ""CreatedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_TrackComments_ParentId""
                    ON ""TrackComments""(""ParentId"");
                CREATE INDEX IF NOT EXISTS ""IX_TrackComments_UserId""
                    ON ""TrackComments""(""UserId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrackComments");
        }
    }
}
