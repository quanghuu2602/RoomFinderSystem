using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RoomFinder.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDistrictToRoom : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "Rooms",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "District",
                table: "Rooms");
        }
    }
}
