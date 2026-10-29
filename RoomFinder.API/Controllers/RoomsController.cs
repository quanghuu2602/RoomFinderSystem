using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RoomFinder.Domain.Entities;
using RoomFinder.Infrastructure.Data;
using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using RoomFinder.API.Services;

namespace RoomFinder.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RoomsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly RoomImageStorage _images;
    public RoomsController(AppDbContext context, RoomImageStorage images) { _context = context; _images = images; }

    public record CreateRoomDto(
        [Required, StringLength(200)] string Title,
        [Required, StringLength(500)] string Address,
        [Required, StringLength(100)] string District,
        [Range(typeof(decimal), "0", "1000000000000")] decimal Price,
        [Range(0.1, 1000000)] double Area);
    public record UpdateRoomDto(
        [Required, StringLength(200)] string Title,
        [Required, StringLength(500)] string Address,
        [Required, StringLength(100)] string District,
        [Range(typeof(decimal), "0", "1000000000000")] decimal Price,
        [Range(0.1, 1000000)] double Area);
    public record AvailabilityDto(bool IsAvailable);

    // GET /api/rooms?minPrice=1000000&maxPrice=3000000&district=Quan 10&onlyAvailable=true
    [HttpGet]
    public async Task<IActionResult> GetAll(
        decimal? minPrice, decimal? maxPrice, string? district, bool onlyAvailable = false)
    {
        var query = _context.Rooms.AsQueryable();

        if (minPrice.HasValue) query = query.Where(r => r.Price >= minPrice.Value);
        if (maxPrice.HasValue) query = query.Where(r => r.Price <= maxPrice.Value);
        if (!string.IsNullOrWhiteSpace(district)) query = query.Where(r => r.District == district);
        if (onlyAvailable) query = query.Where(r => r.IsAvailable);

        var rooms = await query
            .OrderByDescending(r => r.Id)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Address,
                r.District,
                r.Price,
                r.Area,
                r.IsAvailable,
                r.Latitude,
                r.Longitude,
                // Ảnh đầu tiên của phòng làm ảnh đại diện (null nếu chưa có ảnh)
                ThumbnailUrl = _context.RoomImages
                    .Where(i => i.RoomId == r.Id)
                    .OrderBy(i => i.Id)
                    .Select(i => i.ImageUrl)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(rooms);
    }

    // GET /api/rooms/districts - danh sách khu vực đang có phòng (cho dropdown)
    [HttpGet("districts")]
    public async Task<IActionResult> GetDistricts()
    {
        var districts = await _context.Rooms
            .Where(r => r.District != "")
            .Select(r => r.District)
            .Distinct()
            .OrderBy(d => d)
            .ToListAsync();
        return Ok(districts);
    }
    // GET /api/rooms/5 - xem chi tiết 1 phòng
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });
        var images = await _context.RoomImages.Where(i => i.RoomId == id).OrderBy(i => i.Id)
            .Select(i => new { i.Id, i.ImageUrl }).ToListAsync();
        return Ok(new { room.Id, room.Title, room.Address, room.District, room.Price, room.Area,
            room.IsAvailable, room.Latitude, room.Longitude,
            ThumbnailUrl = images.FirstOrDefault()?.ImageUrl, Images = images });
    }

    // Chỉ admin công ty tạo phòng; cột LandlordId hiện lưu ID người quản trị tạo phòng.
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(CreateRoomDto dto)
    {
        var landlordId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var room = new Room
        {
            District = dto.District.Trim(),
            Title = dto.Title.Trim(),
            Address = dto.Address.Trim(),
            Price = dto.Price,
            Area = dto.Area,
            LandlordId = landlordId!,
            IsAvailable = true
        };

        _context.Rooms.Add(room);
        await _context.SaveChangesAsync();
        return Ok(room);
    }

    // Chỉ admin công ty được sửa phòng.
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, UpdateRoomDto dto)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });


        room.District = dto.District.Trim();
        room.Title = dto.Title.Trim();
        room.Address = dto.Address.Trim();
        room.Price = dto.Price;
        room.Area = dto.Area;
        await _context.SaveChangesAsync();
        return Ok(room);
    }

    // Xóa thông tin và ảnh của phòng trong cùng một giao dịch database.
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });



        var images = await _context.RoomImages.Where(i => i.RoomId == id).ToListAsync();
        _context.RoomImages.RemoveRange(images);
        _context.Rooms.Remove(room);
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        foreach (var image in images) _images.Delete(image.ImageUrl);
        return Ok(new { message = "Da xoa phong" });
    }

    // PATCH /api/rooms/5/availability - đổi nhanh Còn/Hết phòng
    [HttpPatch("{id}/availability")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateAvailability(int id, AvailabilityDto dto)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });



        room.IsAvailable = dto.IsAvailable;
        await _context.SaveChangesAsync();
        return Ok(room);
    }
}
