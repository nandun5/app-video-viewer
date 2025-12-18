using Serilog;
using VideoViewer.Core.Services;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.File("logs/videoviewer-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Bind to all network interfaces so site is reachable via localhost and LAN IPs
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// Add services to the container
builder.Services.AddLogging(config => config.AddSerilog());
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

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

// Register domain services
builder.Services.AddSingleton<IDirectoryConfigService, DirectoryConfigService>();
builder.Services.AddScoped<IFileSystemService, FileSystemService>();
builder.Services.AddScoped<IMediaService, MediaService>();

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
        .WithOrigins("*") // or "*" for all
        .AllowAnyMethod()
        .AllowAnyHeader()
);
app.UseAuthorization();

app.MapControllers();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .WithName("Health");

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
