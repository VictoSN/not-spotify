using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReposts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: shared Supabase DB may already have this table from
            // the raw-SQL guard in Program.cs.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""Reposts"" (
                    ""Id""         uuid NOT NULL,
                    ""UserId""     uuid NOT NULL,
                    ""TrackId""    uuid NULL,
                    ""AlbumId""    uuid NULL,
                    ""PlaylistId"" uuid NULL,
                    ""CreatedAt""  timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT ""PK_Reposts"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_Reposts_AspNetUsers_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_Reposts_Tracks_TrackId""
                        FOREIGN KEY (""TrackId"") REFERENCES ""Tracks""(""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_Reposts_Albums_AlbumId""
                        FOREIGN KEY (""AlbumId"") REFERENCES ""Albums""(""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_Reposts_Playlists_PlaylistId""
                        FOREIGN KEY (""PlaylistId"") REFERENCES ""Playlists""(""Id"") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Reposts_UserId_TrackId""
                    ON ""Reposts""(""UserId"", ""TrackId"") WHERE ""TrackId"" IS NOT NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Reposts_UserId_AlbumId""
                    ON ""Reposts""(""UserId"", ""AlbumId"") WHERE ""AlbumId"" IS NOT NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Reposts_UserId_PlaylistId""
                    ON ""Reposts""(""UserId"", ""PlaylistId"") WHERE ""PlaylistId"" IS NOT NULL;
                CREATE INDEX IF NOT EXISTS ""IX_Reposts_UserId_CreatedAt""
                    ON ""Reposts""(""UserId"", ""CreatedAt"");
                CREATE INDEX IF NOT EXISTS ""IX_Reposts_AlbumId""
                    ON ""Reposts""(""AlbumId"");
                CREATE INDEX IF NOT EXISTS ""IX_Reposts_PlaylistId""
                    ON ""Reposts""(""PlaylistId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reposts");
        }
    }
}
