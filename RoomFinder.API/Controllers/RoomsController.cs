using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RoomFinder.Domain.Entities;
using RoomFinder.Infrastructure.Data;
using System.Security.Claims;

namespace RoomFinder.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoomsController : ControllerBase
{
    private readonly AppDbContext _context;
    public RoomsController(AppDbContext context) => _context = context;

    public record CreateRoomDto(string Title, string Address, decimal Price, double Area);
    public record UpdateRoomDto(string Title, string Address, decimal Price, double Area);
    public record AvailabilityDto(bool IsAvailable);

    // GET /api/rooms - ai cũng xem được, không cần đăng nhập
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rooms = await _context.Rooms.ToListAsync();
        return Ok(rooms);
    }

    // GET /api/rooms/5 - xem chi tiết 1 phòng
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });
        return Ok(room);
    }

    // POST /api/rooms - chỉ Landlord/Admin, tự lấy LandlordId từ token
    [HttpPost]
    [Authorize(Roles = "Landlord,Admin")]
    public async Task<IActionResult> Create(CreateRoomDto dto)
    {
        var landlordId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var room = new Room
        {
            Title = dto.Title,
            Address = dto.Address,
            Price = dto.Price,
            Area = dto.Area,
            LandlordId = landlordId!,
            IsAvailable = true
        };

        _context.Rooms.Add(room);
        await _context.SaveChangesAsync();
        return Ok(room);
    }

    // PUT /api/rooms/5 - chỉ đúng chủ tin hoặc Admin được sửa
    [HttpPut("{id}")]
    [Authorize(Roles = "Landlord,Admin")]
    public async Task<IActionResult> Update(int id, UpdateRoomDto dto)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentRole = User.FindFirstValue(ClaimTypes.Role);
        if (room.LandlordId != currentUserId && currentRole != "Admin")
            return Forbid();

        room.Title = dto.Title;
        room.Address = dto.Address;
        room.Price = dto.Price;
        room.Area = dto.Area;
        await _context.SaveChangesAsync();
        return Ok(room);
    }

    // DELETE /api/rooms/5 - chỉ đúng chủ tin hoặc Admin được xóa
    [HttpDelete("{id}")]
    [Authorize(Roles = "Landlord,Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentRole = User.FindFirstValue(ClaimTypes.Role);
        if (room.LandlordId != currentUserId && currentRole != "Admin")
            return Forbid();

        _context.Rooms.Remove(room);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Da xoa phong" });
    }

    // PATCH /api/rooms/5/availability - đổi nhanh Còn/Hết phòng
    [HttpPatch("{id}/availability")]
    [Authorize(Roles = "Landlord,Admin")]
    public async Task<IActionResult> UpdateAvailability(int id, AvailabilityDto dto)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });

        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentRole = User.FindFirstValue(ClaimTypes.Role);
        if (room.LandlordId != currentUserId && currentRole != "Admin")
            return Forbid();

        room.IsAvailable = dto.IsAvailable;
        await _context.SaveChangesAsync();
        return Ok(room);
    }
}