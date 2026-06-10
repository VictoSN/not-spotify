using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using NotSpotify.Api.Data;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260610120000_CreateUserSavedAlbumsTable")]
    public partial class CreateUserSavedAlbumsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The previous AddUserSavedAlbums migration was recorded as applied but was empty
            // (generated from a stale binary). This migration creates the table using IF NOT EXISTS
            // so it is safe to run regardless of whether the table already exists.
            migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""UserSavedAlbums"" (
    ""UserId""  uuid NOT NULL,
    ""AlbumId"" uuid NOT NULL,
    ""SavedAt"" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT ""PK_UserSavedAlbums"" PRIMARY KEY (""UserId"", ""AlbumId""),
    CONSTRAINT ""FK_UserSavedAlbums_Albums_AlbumId""
        FOREIGN KEY (""AlbumId"") REFERENCES ""Albums"" (""Id"") ON DELETE CASCADE,
    CONSTRAINT ""FK_UserSavedAlbums_AspNetUsers_UserId""
        FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ""IX_UserSavedAlbums_AlbumId""
    ON ""UserSavedAlbums"" (""AlbumId"");

CREATE INDEX IF NOT EXISTS ""IX_UserSavedAlbums_UserId_SavedAt""
    ON ""UserSavedAlbums"" (""UserId"", ""SavedAt"");
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "UserSavedAlbums");
        }
    }
}
