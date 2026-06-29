using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotSpotify.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserFollows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent (IF NOT EXISTS) so it reconciles cleanly on the shared Postgres
            // DB regardless of whether the defensive guard in Program.cs already created
            // the table — same hazard the UserSavedAlbums migration hit. Schema is byte-for-byte
            // what EF would have generated from the UserFollow model.
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""UserFollows"" (
                    ""Id""         uuid NOT NULL,
                    ""FollowerId"" uuid NOT NULL,
                    ""FolloweeId"" uuid NOT NULL,
                    ""CreatedAt""  timestamp with time zone NOT NULL,
                    CONSTRAINT ""PK_UserFollows"" PRIMARY KEY (""Id""),
                    CONSTRAINT ""FK_UserFollows_AspNetUsers_FollowerId""
                        FOREIGN KEY (""FollowerId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_UserFollows_AspNetUsers_FolloweeId""
                        FOREIGN KEY (""FolloweeId"") REFERENCES ""AspNetUsers""(""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_UserFollows_FolloweeId""
                    ON ""UserFollows""(""FolloweeId"");
                CREATE INDEX IF NOT EXISTS ""IX_UserFollows_FollowerId""
                    ON ""UserFollows""(""FollowerId"");
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UserFollows_FollowerId_FolloweeId""
                    ON ""UserFollows""(""FollowerId"", ""FolloweeId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DROP TABLE IF EXISTS ""UserFollows"";");
        }
    }
}
