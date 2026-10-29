using Microsoft.EntityFrameworkCore;
using RoomFinder.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using RoomFinder.Domain.Entities;
using System.Text;
using System.Security.Claims;
using RoomFinder.API.Services;
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, WebRootPath = "wwwroot" });
var webRoot = builder.Environment.WebRootPath;
Directory.CreateDirectory(webRoot);
builder.Environment.WebRootFileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRoot);
builder.Services.AddScoped<RoomImageStorage>();

// Add services to the container.

// Đăng ký Controller
builder.Services.AddControllers();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Đăng ký DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")
    ));

builder.Services.AddIdentity<AppUser, IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var users = context.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = userId == null ? null : await users.FindByIdAsync(userId);
            if (user == null || await users.IsLockedOutAsync(user))
            {
                context.Fail("Tài khoản không còn khả dụng.");
                return;
            }
            // Quyền hiện tại trong database có hiệu lực ngay, kể cả với JWT cũ.
            var identity = (ClaimsIdentity)context.Principal!.Identity!;
            foreach (var claim in identity.FindAll(identity.RoleClaimType).ToList()) identity.RemoveClaim(claim);
            identity.AddClaim(new Claim(identity.RoleClaimType, user.Role == "Admin" ? "Admin" : "Customer"));
        }
    };
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();
if (args.Contains("--create-admin"))
{
    Environment.ExitCode = await AdminAccountCommand.RunAsync(app.Services);
    return;
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();
// Cho phép các Controller hoạt động
app.MapControllers();

// WeatherForecast mặc định
var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild",
    "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();

    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.Run();

internal record WeatherForecast(
    DateOnly Date,
    int TemperatureC,
    string? Summary)
{
    public int TemperatureF =>
        32 + (int)(TemperatureC / 0.5556);
}
