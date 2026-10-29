using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RoomFinder.API.Controllers;
using RoomFinder.API.Services;
using RoomFinder.Domain.Entities;
using RoomFinder.Infrastructure.Data;

// Runs the actual controllers and authorization middleware with a test identity provider.
// No production database, credentials or accounts are used.
var tempRoot = Path.Combine(Path.GetTempPath(), "roomfinder-checks-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(tempRoot);
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, WebRootPath = tempRoot });
builder.Logging.ClearProviders();
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.Configuration["Jwt:Key"] = new string('x', 64);
builder.Configuration["Jwt:Issuer"] = "roomfinder-checks";
builder.Configuration["Jwt:Audience"] = "roomfinder-checks";
builder.Services.AddControllers().AddApplicationPart(typeof(RoomsController).Assembly);
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer("Server=unused;Database=unused;Integrated Security=true"));
builder.Services.AddSingleton<TestUsers>();
builder.Services.AddSingleton<UserManager<AppUser>>(services => services.GetRequiredService<TestUsers>());
builder.Services.AddScoped<RoomImageStorage>();
builder.Services.AddAuthentication("Checks").AddScheme<AuthenticationSchemeOptions, TestAuthentication>("Checks", _ => {});
builder.Services.AddAuthorization();
await using var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
try
{
    await app.StartAsync();
    using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
    var writes = new (HttpMethod Method, string Url)[]
    {
        (HttpMethod.Post, "/api/rooms"),
        (HttpMethod.Put, "/api/rooms/1"),
        (HttpMethod.Delete, "/api/rooms/1"),
        (HttpMethod.Patch, "/api/rooms/1/availability"),
        (HttpMethod.Post, "/api/rooms/1/images"),
        (HttpMethod.Delete, "/api/rooms/1/images/1")
    };
    foreach (var role in new string?[] { null, "Customer", "Student", "Landlord" })
    {
        foreach (var endpoint in writes)
        {
            using var request = new HttpRequestMessage(endpoint.Method, endpoint.Url);
            if (role != null) request.Headers.Add("X-Test-Role", role);
            request.Content = JsonContent.Create(new {});
            using var response = await client.SendAsync(request);
            Check(response.StatusCode == (role == null ? HttpStatusCode.Unauthorized : HttpStatusCode.Forbidden),
                $"Protected route {endpoint.Method} {endpoint.Url}: {role ?? "guest"}");
        }
    }
    // Public registration must ignore injected privilege fields.
    using (var response = await client.PostAsJsonAsync("/api/auth/register",
        new { email = "customer@example.test", password = "Test123!", fullName = "Customer", role = "Admin" }))
    {
        Check(response.IsSuccessStatusCode, "Registration response");
        Check(app.Services.GetRequiredService<TestUsers>().Created?.Role == "Customer", "Registration cannot assign Admin");
    }
    var users = app.Services.GetRequiredService<TestUsers>();
    foreach (var role in new[] { "Landlord", "Student", "Customer", "Admin" })
    {
        users.LoginUser.Role = role;
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "test@example.test", password = "Test123!" });
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var token = new JwtSecurityTokenHandler().ReadJwtToken(json.GetProperty("token").GetString());
        Check(token.Claims.Single(claim => claim.Type == ClaimTypes.Role).Value == (role == "Admin" ? "Admin" : "Customer"), "Login normalizes legacy roles");
    }
    using (var request = new HttpRequestMessage(HttpMethod.Post, "/api/rooms"))
    {
        request.Headers.Add("X-Test-Role", "Admin");
        request.Content = JsonContent.Create(new {title = " ", address = "", district = "", price = -1, area = 0});
        using var response = await client.SendAsync(request);
        Check(response.StatusCode == HttpStatusCode.BadRequest, "Admin passes permission gate; invalid room input rejected");
    }
    using var scope = app.Services.CreateScope();
    var storage = scope.ServiceProvider.GetRequiredService<RoomImageStorage>();
    var png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=");
    var valid = MakeFile("room.png", png);
    Check(await RoomImageStorage.IsValidImageAsync(valid), "PNG accepted");
    Check(!await RoomImageStorage.IsValidImageAsync(MakeFile("fake.png", System.Text.Encoding.UTF8.GetBytes("<script>alert(1)</script>"))), "Spoofed image rejected");
    Check(!await RoomImageStorage.IsValidImageAsync(MakeFile("room.svg", png)), "Unapproved extension rejected");
    Check(!await RoomImageStorage.IsValidImageAsync(MakeFile("empty.jpg", Array.Empty<byte>())), "Empty file rejected");
    Check(!await RoomImageStorage.IsValidImageAsync(MakeFile("large.png", new byte[5 * 1024 * 1024 + 1])), "Oversize rejected");
    var url = await storage.SaveAsync(valid);
    var storedPath = Path.Combine(tempRoot, url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
    Check(File.Exists(storedPath), "Image saved");
    Check((await File.ReadAllBytesAsync(storedPath)).SequenceEqual(png), "Image bytes preserved");
    var outside = Path.Combine(tempRoot, "keep.txt");
    await File.WriteAllTextAsync(outside, "keep");
    storage.Delete("/uploads/../keep.txt");
    Check(File.Exists(outside), "Deletion cannot escape uploads");
    storage.Delete(url);
    Check(!File.Exists(storedPath), "Image deleted");
    Console.WriteLine("PASS: all room/image write routes deny guests and non-admin roles; registration ignores injected Admin; legacy roles normalize; admin room validation; image signature/size/type validation; save/delete/path containment.");
}
finally
{
    await app.StopAsync();
    var resolved = Path.GetFullPath(tempRoot);
    if (resolved.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) &&
        Path.GetFileName(resolved).StartsWith("roomfinder-checks-", StringComparison.Ordinal))
        Directory.Delete(resolved, recursive: true);
}

static void Check(bool passed, string message)
{
    if (!passed) throw new Exception("FAIL: " + message);
}
static IFormFile MakeFile(string name, byte[] bytes) =>
    new FormFile(new MemoryStream(bytes), 0, bytes.Length, "files", name);

sealed class TestAuthentication : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthentication(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger,
        UrlEncoder encoder, ISystemClock clock) : base(options, logger, encoder, clock) {}
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var role = Request.Headers["X-Test-Role"].ToString();
        if (string.IsNullOrEmpty(role)) return Task.FromResult(AuthenticateResult.NoResult());
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "test-admin"),
            new Claim(ClaimTypes.Role, role)
        }, "Checks"));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, "Checks")));
    }
}
sealed class TestUsers : UserManager<AppUser>
{
    public AppUser? Created { get; private set; }
    public AppUser LoginUser { get; } = new() {Id = "test-user", Email = "test@example.test"};
    public TestUsers() : base(
        new UserStore<AppUser>(new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer("Server=unused;Database=unused").Options)),
        Microsoft.Extensions.Options.Options.Create(new IdentityOptions()), new PasswordHasher<AppUser>(),
        Array.Empty<IUserValidator<AppUser>>(), Array.Empty<IPasswordValidator<AppUser>>(),
        new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null!,
        NullLogger<UserManager<AppUser>>.Instance) {}
    public override Task<IdentityResult> CreateAsync(AppUser user, string password)
    {
        Created = user;
        return Task.FromResult(IdentityResult.Success);
    }
    public override Task<AppUser?> FindByEmailAsync(string email) => Task.FromResult<AppUser?>(LoginUser);
    public override Task<bool> CheckPasswordAsync(AppUser user, string password) => Task.FromResult(true);
}
