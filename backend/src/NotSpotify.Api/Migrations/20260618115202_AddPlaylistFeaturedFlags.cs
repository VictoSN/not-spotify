using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaylistFeaturedFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsFeatured",
                table: "Playlists",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Playlists",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Reposts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: true),
                    AlbumId = table.Column<Guid>(type: "uuid", nullable: true),
                    PlaylistId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reposts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reposts_Albums_AlbumId",
                        column: x => x.AlbumId,
                        principalTable: "Albums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reposts_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reposts_Playlists_PlaylistId",
                        column: x => x.PlaylistId,
                        principalTable: "Playlists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reposts_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrackComments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    ParentId = table.Column<Guid>(type: "uuid", nullable: true),
                    TimestampMs = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrackComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrackComments_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrackComments_TrackComments_ParentId",
                        column: x => x.ParentId,
                        principalTable: "TrackComments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TrackComments_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Playlists_IsFeatured_SortOrder",
                table: "Playlists",
                columns: new[] { "IsFeatured", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Reposts_AlbumId",
                table: "Reposts",
                column: "AlbumId");

            migrationBuilder.CreateIndex(
                name: "IX_Reposts_PlaylistId",
                table: "Reposts",
                column: "PlaylistId");

            migrationBuilder.CreateIndex(
                name: "IX_Reposts_TrackId",
                table: "Reposts",
                column: "TrackId");

            migrationBuilder.CreateIndex(
                name: "IX_Reposts_UserId_AlbumId",
                table: "Reposts",
                columns: new[] { "UserId", "AlbumId" },
                unique: true,
                filter: "\"AlbumId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Reposts_UserId_CreatedAt",
                table: "Reposts",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Reposts_UserId_PlaylistId",
                table: "Reposts",
                columns: new[] { "UserId", "PlaylistId" },
                unique: true,
                filter: "\"PlaylistId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Reposts_UserId_TrackId",
                table: "Reposts",
                columns: new[] { "UserId", "TrackId" },
                unique: true,
                filter: "\"TrackId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TrackComments_ParentId",
                table: "TrackComments",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_TrackComments_TrackId_CreatedAt",
                table: "TrackComments",
                columns: new[] { "TrackId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TrackComments_UserId",
                table: "TrackComments",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reposts");

            migrationBuilder.DropTable(
                name: "TrackComments");

            migrationBuilder.DropIndex(
                name: "IX_Playlists_IsFeatured_SortOrder",
                table: "Playlists");

            migrationBuilder.DropColumn(
                name: "IsFeatured",
                table: "Playlists");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Playlists");
        }
    }
}
