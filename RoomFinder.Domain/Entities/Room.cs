namespace RoomFinder.Domain.Entities;

public class Room
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public decimal Price { get; set; }
    public double Area { get; set; }
    public bool IsAvailable { get; set; } = true;
    public string LandlordId { get; set; } = string.Empty;
}