using Microsoft.AspNetCore.Identity;

namespace RoomFinder.Domain.Entities;

public class AppUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = "Student"; // Student, Landlord, Admin
}