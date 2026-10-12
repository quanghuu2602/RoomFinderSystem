namespace RoomFinder.Domain.Entities;

public class RoomImage
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public string ImageUrl { get; set; } = string.Empty; // VD: /uploads/abc123.jpg
}