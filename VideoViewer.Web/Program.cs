using Serilog;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using VideoViewer.Core.DependencyInjection;
using VideoViewer.Core.Services;
using VideoViewer.Web.Hubs;
using VideoViewer.Web.Services;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.File("logs/videoviewer-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Load environment variables explicitly so auth values can be supplied via
// VideoViewer__Auth__Pin and VideoViewer__Auth__JwtSecret.
builder.Configuration.AddEnvironmentVariables();

// Enable Windows Service if running as a service
if (OperatingSystem.IsWindows())
{
    builder.Host.UseWindowsService();
}

// Bind to all network interfaces so site is reachable via localhost and LAN IPs
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// Add services to the container
builder.Services.AddLogging(config => config.AddSerilog());
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var authConfig = new AuthConfig
{
    Pin = Environment.GetEnvironmentVariable("VideoViewer__Auth__Pin") ?? string.Empty,
    JwtSecret = Environment.GetEnvironmentVariable("VideoViewer__Auth__JwtSecret") ?? string.Empty,
    TokenLifetimeMinutes = int.TryParse(Environment.GetEnvironmentVariable("VideoViewer__Auth__TokenLifetimeMinutes"), out var ttl) ? ttl : 60
};

if (string.IsNullOrWhiteSpace(authConfig.Pin) || string.IsNullOrWhiteSpace(authConfig.JwtSecret))
{
    throw new InvalidOperationException("VideoViewer auth configuration is missing. Please configure VideoViewer__Auth__Pin and VideoViewer__Auth__JwtSecret environment variables.");
}

builder.Services.AddSingleton<IOptions<AuthConfig>>(Options.Create(authConfig));
builder.Services.AddSingleton<IPinAuthService, PinAuthService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authConfig.JwtSecret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Query.TryGetValue("access_token", out var accessToken) && !string.IsNullOrEmpty(accessToken))
                {
                    context.Token = accessToken;
                }
                else if (context.Request.Cookies.TryGetValue("VideoViewerAuthToken", out var cookieToken) && !string.IsNullOrEmpty(cookieToken))
                {
                    context.Token = cookieToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Configure CORS for React frontend (allow local origins / LAN access)
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
    {
        // Allow requests from localhost, LAN IPs and any origin on local network.
        // For production tighten this to specific origins.
        policy
            .AllowAnyMethod()
            .AllowAnyHeader()
            .SetIsOriginAllowed(_ => true)
            .WithExposedHeaders("Content-Range", "Accept-Ranges", "Content-Length");
    });
});

builder.Services.AddVideoViewerCore();

// Add SignalR for server push notifications
builder.Services.AddSignalR();
// Background service that watches the configured directory and broadcasts changes
builder.Services.AddHostedService<DirectoryWatcher>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    // Swagger/Swashbuckle removed due to incompatible transitive dependency with target runtime.
}

// Apply CORS policy for all environments (needed for media streams from same origin)
// app.UseCors("ReactApp");
app.UseCors(policy => 
    policy
        .SetIsOriginAllowed(_ => true)
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials()
);
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Map SignalR hub for directory change notifications
app.MapHub<DirectoryHub>("/hubs/directory");

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health");

// Serve static files (React build output)
app.UseDefaultFiles(); // ensures index.html is served by default
app.UseStaticFiles();

// Fallback to index.html for SPA routing (MUST come before UseStaticFiles so that non-existent paths fall back to SPA)
app.MapFallbackToFile("index.html");
// Insert middleware to rewrite non-API requests for non-existing files to index.html
// This lets the SPA handle routes like /folder/video.mp4 instead of returning 404 from static files
var env = app.Services.GetService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;

    // Skip API calls
    if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/health", StringComparison.OrdinalIgnoreCase))
    {
        await next();
        return;
    }

    // Check if a physical file exists in wwwroot for this path
    var fileInfo = env?.WebRootFileProvider.GetFileInfo(path ?? string.Empty);
    var exists = fileInfo != null && fileInfo.Exists;
    app.Logger.LogDebug("Request path: {path}, file exists in wwwroot: {exists}", path, exists);
    if (!exists)
    {
        // Rewrite to SPA entry
        context.Request.Path = "/index.html";
    }

    await next();
});

// Serve static files (React build output)
app.UseDefaultFiles();
app.UseStaticFiles();


try
{
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
