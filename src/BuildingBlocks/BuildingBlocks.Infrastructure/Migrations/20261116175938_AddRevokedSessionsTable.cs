using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BuildingBlocks.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRevokedSessionsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "revoked_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_revoked_sessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_revoked_sessions_ExpiresAtUtc",
                table: "revoked_sessions",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_revoked_sessions_SessionId",
                table: "revoked_sessions",
                column: "SessionId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "revoked_sessions");
        }
    }
}
