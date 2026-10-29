namespace RoomFinder.API.Services;

public class RoomImageStorage
{
    private readonly string _directory;
    private readonly ILogger<RoomImageStorage> _logger;
    public const long MaxFileSize = 5 * 1024 * 1024;
    public const int MaxFiles = 10;

    public RoomImageStorage(IWebHostEnvironment env, ILogger<RoomImageStorage> logger)
    {
        _directory = Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"), "uploads");
        _logger = logger;
    }

    public static async Task<bool> IsValidImageAsync(IFormFile file)
    {
        if (file.Length == 0 || file.Length > MaxFileSize) return false;
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, 12, throwOnEndOfStream: false);
        if (read < 12) return false;
        return Path.GetExtension(file.FileName).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff,
            ".png" => header.Take(8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            ".webp" => System.Text.Encoding.ASCII.GetString(header, 0, 4) == "RIFF" &&
                       System.Text.Encoding.ASCII.GetString(header, 8, 4) == "WEBP",
            _ => false
        };
    }

    public async Task<string> SaveAsync(IFormFile file)
    {
        Directory.CreateDirectory(_directory);
        var name = Guid.NewGuid().ToString("N") + Path.GetExtension(file.FileName).ToLowerInvariant();
        var url = "/uploads/" + name;
        try
        {
            await using var stream = new FileStream(Path.Combine(_directory, name), FileMode.CreateNew);
            await file.CopyToAsync(stream);
            return url;
        }
        catch { Delete(url); throw; }
    }

    public void Delete(string imageUrl)
    {
        if (!imageUrl.StartsWith("/uploads/", StringComparison.Ordinal)) return;
        var name = imageUrl["/uploads/".Length..];
        if (string.IsNullOrWhiteSpace(name) || name != Path.GetFileName(name) || name.Contains('\\')) return;
        var fullPath = Path.GetFullPath(Path.Combine(_directory, name));
        if (!fullPath.StartsWith(Path.GetFullPath(_directory) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return;
        try { File.Delete(fullPath); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(ex, "Không xóa được file ảnh {FileName}", name);
        }
    }
}
