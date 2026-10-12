using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RoomFinder.Domain.Entities;
using RoomFinder.Infrastructure.Data;
using System.Security.Claims;

namespace RoomFinder.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId}/images")]
public class RoomImagesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
    private const long MaxFileSize = 5 * 1024 * 1024; // 5MB mỗi ảnh

    public RoomImagesController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    // Kiểm tra: đúng chủ tin hoặc Admin
    private bool CanManage(Room room)
    {
        var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var currentRole = User.FindFirstValue(ClaimTypes.Role);
        return room.LandlordId == currentUserId || currentRole == "Admin";
    }

    // POST /api/rooms/5/images  (form-data, key = files, có thể chọn nhiều ảnh)
    [HttpPost]
    [Authorize(Roles = "Landlord,Admin")]
    public async Task<IActionResult> Upload(int roomId, List<IFormFile> files)
    {
        var room = await _context.Rooms.FindAsync(roomId);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });
        if (!CanManage(room)) return Forbid();

        if (files == null || files.Count == 0)
            return BadRequest(new { message = "Chua chon anh nao" });

        // Kiểm tra hết các file trước khi lưu
        foreach (var file in files)
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
                return BadRequest(new { message = $"File {file.FileName} khong phai anh (chi nhan jpg, jpeg, png, webp)" });
            if (file.Length > MaxFileSize)
                return BadRequest(new { message = $"File {file.FileName} qua 5MB" });
        }

        var uploadDir = Path.Combine(_env.WebRootPath, "uploads");
        Directory.CreateDirectory(uploadDir);

        var savedImages = new List<RoomImage>();
        foreach (var file in files)
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var fileName = $"{Guid.NewGuid()}{ext}"; // đặt tên ngẫu nhiên để không trùng
            var fullPath = Path.Combine(uploadDir, fileName);

            await using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            savedImages.Add(new RoomImage
            {
                RoomId = roomId,
                ImageUrl = $"/uploads/{fileName}"
            });
        }

        _context.RoomImages.AddRange(savedImages);
        await _context.SaveChangesAsync();
        return Ok(savedImages);
    }

    // GET /api/rooms/5/images - ai cũng xem được
    [HttpGet]
    public async Task<IActionResult> GetImages(int roomId)
    {
        var images = await _context.RoomImages
            .Where(i => i.RoomId == roomId)
            .ToListAsync();
        return Ok(images);
    }

    // DELETE /api/rooms/5/images/3
    [HttpDelete("{imageId}")]
    [Authorize(Roles = "Landlord,Admin")]
    public async Task<IActionResult> DeleteImage(int roomId, int imageId)
    {
        var room = await _context.Rooms.FindAsync(roomId);
        if (room == null) return NotFound(new { message = "Khong tim thay phong" });
        if (!CanManage(room)) return Forbid();

        var image = await _context.RoomImages
            .FirstOrDefaultAsync(i => i.Id == imageId && i.RoomId == roomId);
        if (image == null) return NotFound(new { message = "Khong tim thay anh" });

        // Xóa file thật trên ổ đĩa
        var relativePath = image.ImageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(_env.WebRootPath, relativePath);
        if (System.IO.File.Exists(fullPath))
            System.IO.File.Delete(fullPath);

        _context.RoomImages.Remove(image);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Da xoa anh" });
    }
}