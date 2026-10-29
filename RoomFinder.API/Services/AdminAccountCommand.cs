using Microsoft.AspNetCore.Identity;
using RoomFinder.Domain.Entities;

namespace RoomFinder.API.Services;

// Chỉ chạy trực tiếp trên máy chủ: dotnet run --project RoomFinder.API -- --create-admin
public static class AdminAccountCommand
{
    public static async Task<int> RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        Console.Write("Email admin: ");
        var email = Console.ReadLine()?.Trim();
        Console.Write("Ho ten: ");
        var name = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(name))
        {
            Console.Error.WriteLine("Email va ho ten khong duoc de trong.");
            return 1;
        }
        if (await users.FindByEmailAsync(email) != null)
        {
            Console.Error.WriteLine("Email da ton tai. Cong cu khong tu dong nang quyen tai khoan cu.");
            return 1;
        }
        Console.Write("Mat khau (khong hien thi): ");
        var password = ReadPassword();
        Console.Write("Nhap lai mat khau: ");
        if (password != ReadPassword())
        {
            Console.Error.WriteLine("Mat khau khong khop.");
            return 1;
        }
        var result = await users.CreateAsync(new AppUser
        {
            UserName = email, Email = email, FullName = name, Role = "Admin"
        }, password);
        foreach (var error in result.Errors) Console.Error.WriteLine(error.Description);
        Console.WriteLine(result.Succeeded ? "Da tao admin. Dang nhap bang email va mat khau vua nhap." : "Khong tao duoc admin.");
        return result.Succeeded ? 0 : 1;
    }

    private static string ReadPassword()
    {
        if (Console.IsInputRedirected) return Console.ReadLine() ?? "";
        var result = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return result.ToString(); }
            if (key.Key == ConsoleKey.Backspace && result.Length > 0) result.Length--;
            else if (!char.IsControl(key.KeyChar)) result.Append(key.KeyChar);
        }
    }
}
