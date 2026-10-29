namespace RoomFinder.Domain.Entities;

public class Room
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty; // Quận/Huyện, dùng để lọc
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public decimal Price { get; set; }
    public double Area { get; set; }
    public bool IsAvailable { get; set; } = true;
    // Giữ tên cột cũ để tương thích dữ liệu; hiện lưu ID admin tạo phòng của công ty.
    public string LandlordId { get; set; } = string.Empty;
}
