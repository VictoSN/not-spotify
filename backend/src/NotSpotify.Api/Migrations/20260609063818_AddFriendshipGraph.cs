using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFriendshipGraph : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── Idempotent section ──────────────────────────────────────────────────
            // Several of the operations below were applied to the DB directly before
            // this migration was generated, so __EFMigrationsHistory is behind.
            // We use PostgreSQL's IF NOT EXISTS / DO-block patterns to make each
            // statement safe whether the object already exists or not.

            // Remove Status defaults — DROP DEFAULT is a no-op if no default exists.
            migrationBuilder.Sql(@"
                ALTER TABLE ""Tracks"" ALTER COLUMN ""Status"" DROP DEFAULT;
                ALTER TABLE ""Albums"" ALTER COLUMN ""Status"" DROP DEFAULT;
            ");

            // Columns that may already exist from manually-applied migrations.
            migrationBuilder.Sql(@"
                ALTER TABLE ""AspNetUsers"" ADD COLUMN IF NOT EXISTS ""ArtistId"" uuid;
                ALTER TABLE ""Artists"" ADD COLUMN IF NOT EXISTS ""IsRevoked"" boolean NOT NULL DEFAULT false;
                ALTER TABLE ""Artists"" ADD COLUMN IF NOT EXISTS ""RevocationNote"" text;
                ALTER TABLE ""Artists"" ADD COLUMN IF NOT EXISTS ""RevokedAt"" timestamp with time zone;
            ");

            // Tables that may already exist.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""ArtistApplications"" (
                    ""Id"" uuid NOT NULL,
                    ""UserId"" uuid NOT NULL,
                    ""DisplayName"" text NOT NULL,
                    ""Bio"" text NOT NULL,
                    ""SampleWorkUrl"" text,
                    ""Status"" text NOT NULL,
                    ""SubmittedAt"" timestamp with time zone NOT NULL,
                    ""ReviewedAt"" timestamp with time zone,
                    ""ReviewedByUserId"" uuid,
                    ""ReviewNote"" text,
                    CONSTRAINT ""PK_ArtistApplications"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_ArtistApplications_AspNetUsers_ReviewedByUserId""
                        FOREIGN KEY (""ReviewedByUserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE SET NULL,
                    CONSTRAINT ""FK_ArtistApplications_AspNetUsers_UserId""
                        FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE
                );
            ");

            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""ReviewHistories"" (
                    ""Id"" uuid NOT NULL,
                    ""EntityType"" text NOT NULL,
                    ""EntityId"" uuid NOT NULL,
                    ""Action"" text NOT NULL,
                    ""Note"" text,
                    ""ReviewedByName"" text,
                    ""ReviewedAt"" timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_ReviewHistories"" PRIMARY KEY (""Id"")
                );
            ");

            // Indexes on already-existing tables — IF NOT EXISTS is safe.
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_ArtistApplications_ReviewedByUserId"" ON ""ArtistApplications"" (""ReviewedByUserId"");
                CREATE INDEX IF NOT EXISTS ""IX_ArtistApplications_Status"" ON ""ArtistApplications"" (""Status"");
                CREATE INDEX IF NOT EXISTS ""IX_ArtistApplications_UserId"" ON ""ArtistApplications"" (""UserId"");
            ");

            // FK on Tracks — guard with an existence check.
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE constraint_name = 'FK_Tracks_AspNetUsers_SubmittedByUserId'
                          AND table_name = 'Tracks'
                    ) THEN
                        ALTER TABLE ""Tracks""
                            ADD CONSTRAINT ""FK_Tracks_AspNetUsers_SubmittedByUserId""
                            FOREIGN KEY (""SubmittedByUserId"")
                            REFERENCES ""AspNetUsers"" (""Id"") ON DELETE SET NULL;
                    END IF;
                END $$;
            ");

            // ── New objects — added for the first time by this migration ───────────

            // LastSeenAt is genuinely new — not in any earlier migration.
            migrationBuilder.AddColumn<DateTime>(
                name: "LastSeenAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: true);

            // Friendships table — the core of the graph feature.
            migrationBuilder.CreateTable(
                name: "Friendships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddresseeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Friendships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Friendships_AspNetUsers_AddresseeId",
                        column: x => x.AddresseeId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Friendships_AspNetUsers_RequesterId",
                        column: x => x.RequesterId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Friendships_AddresseeId_Status",
                table: "Friendships",
                columns: new[] { "AddresseeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Friendships_RequesterId_AddresseeId",
                table: "Friendships",
                columns: new[] { "RequesterId", "AddresseeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Friendships_RequesterId_Status",
                table: "Friendships",
                columns: new[] { "RequesterId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tracks_AspNetUsers_SubmittedByUserId",
                table: "Tracks");

            migrationBuilder.DropTable(
                name: "ArtistApplications");

            migrationBuilder.DropTable(
                name: "Friendships");

            migrationBuilder.DropTable(
                name: "ReviewHistories");

            migrationBuilder.DropColumn(
                name: "ArtistId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "LastSeenAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "IsRevoked",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "RevocationNote",
                table: "Artists");

            migrationBuilder.DropColumn(
                name: "RevokedAt",
                table: "Artists");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Tracks",
                type: "text",
                nullable: false,
                defaultValue: "approved",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Albums",
                type: "text",
                nullable: false,
                defaultValue: "approved",
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
