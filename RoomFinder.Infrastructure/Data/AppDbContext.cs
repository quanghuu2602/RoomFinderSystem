using Microsoft.EntityFrameworkCore;
using RoomFinder.Domain.Entities;

namespace RoomFinder.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Room> Rooms => Set<Room>();
}