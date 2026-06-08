using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddArtistSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add Status + SubmittedByUserId to Tracks
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Tracks",
                type: "text",
                nullable: false,
                defaultValue: "approved");

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedByUserId",
                table: "Tracks",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_Status",
                table: "Tracks",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_SubmittedByUserId",
                table: "Tracks",
                column: "SubmittedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tracks_AspNetUsers_SubmittedByUserId",
                table: "Tracks",
                column: "SubmittedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Add ArtistId to AspNetUsers
            migrationBuilder.AddColumn<Guid>(
                name: "ArtistId",
                table: "AspNetUsers",
                type: "uuid",
                nullable: true);

            // Create ArtistApplications table
            migrationBuilder.CreateTable(
                name: "ArtistApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "text", nullable: false),
                    Bio = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    SampleWorkUrl = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false, defaultValue: "pending"),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewNote = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArtistApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArtistApplications_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ArtistApplications_AspNetUsers_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArtistApplications_Status",
                table: "ArtistApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ArtistApplications_UserId",
                table: "ArtistApplications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ArtistApplications_ReviewedByUserId",
                table: "ArtistApplications",
                column: "ReviewedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ArtistApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_Tracks_AspNetUsers_SubmittedByUserId",
                table: "Tracks");

            migrationBuilder.DropIndex(name: "IX_Tracks_Status", table: "Tracks");
            migrationBuilder.DropIndex(name: "IX_Tracks_SubmittedByUserId", table: "Tracks");

            migrationBuilder.DropColumn(name: "Status", table: "Tracks");
            migrationBuilder.DropColumn(name: "SubmittedByUserId", table: "Tracks");
            migrationBuilder.DropColumn(name: "ArtistId", table: "AspNetUsers");
        }
    }
}
