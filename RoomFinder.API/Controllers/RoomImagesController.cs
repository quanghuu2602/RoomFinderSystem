using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RoomFinder.Domain.Entities;
using RoomFinder.Infrastructure.Data;
using RoomFinder.API.Services;

namespace RoomFinder.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId:int}/images")]
public class RoomImagesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly RoomImageStorage _storage;
    public RoomImagesController(AppDbContext context, RoomImageStorage storage)
    {
        _context = context;
        _storage = storage;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [RequestSizeLimit(55 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 55 * 1024 * 1024)]
    public async Task<IActionResult> Upload(int roomId, [FromForm] List<IFormFile> files)
    {
        if (!await _context.Rooms.AnyAsync(r => r.Id == roomId))
            return NotFound(new { message = "Không tìm thấy phòng." });
        if (files.Count == 0 || files.Count > RoomImageStorage.MaxFiles)
            return BadRequest(new { message = "Chọn từ 1 đến 10 ảnh mỗi lần tải." });
        foreach (var file in files)
        {
            if (!await RoomImageStorage.IsValidImageAsync(file))
                return BadRequest(new { message = $"Ảnh {file.FileName} không hợp lệ. Chỉ nhận JPG, PNG, WebP, tối đa 5 MB mỗi ảnh." });
        }
        var images = new List<RoomImage>();
        try
        {
            // Giữ thứ tự chọn: ảnh đầu tiên là ảnh đại diện khi phòng chưa có ảnh.
            foreach (var file in files)
                images.Add(new RoomImage { RoomId = roomId, ImageUrl = await _storage.SaveAsync(file) });
            // Ngăn xóa phòng đồng thời tạo ra các bản ghi ảnh mồ côi.
            await using var transaction = await _context.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
            if (!await _context.Rooms.AnyAsync(r => r.Id == roomId))
            {
                foreach (var image in images) _storage.Delete(image.ImageUrl);
                return NotFound(new { message = "Phòng đã bị xóa. Vui lòng tải lại danh sách." });
            }
            _context.RoomImages.AddRange(images);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return Ok(images);
        }
        catch
        {
            foreach (var image in images) _storage.Delete(image.ImageUrl);
            throw;
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetImages(int roomId)
    {
        if (!await _context.Rooms.AnyAsync(r => r.Id == roomId))
            return NotFound(new { message = "Không tìm thấy phòng." });
        return Ok(await _context.RoomImages.Where(i => i.RoomId == roomId).OrderBy(i => i.Id).ToListAsync());
    }

    [HttpDelete("{imageId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteImage(int roomId, int imageId)
    {
        var image = await _context.RoomImages.FirstOrDefaultAsync(i => i.Id == imageId && i.RoomId == roomId);
        if (image == null) return NotFound(new { message = "Không tìm thấy ảnh." });
        _context.RoomImages.Remove(image);
        await _context.SaveChangesAsync();
        _storage.Delete(image.ImageUrl);
        return Ok(new { message = "Đã xóa ảnh." });
    }
}
