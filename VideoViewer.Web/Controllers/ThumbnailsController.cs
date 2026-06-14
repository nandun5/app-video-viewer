namespace VideoViewer.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Net;
using VideoViewer.Core.Services;

/// <summary>
/// API endpoint thumbnaiils
/// Route format: /api/thumbnails/{**path} - path segments are decoded into file path
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ThumbnailsController : ControllerBase
{
    private readonly IThumbnailService _thumbnailService;
    private readonly ILogger<ThumbnailsController> _logger;
    private const int BUFFER_SIZE = 65536; // 64KB chunks

    public ThumbnailsController(IThumbnailService thumbnailService, ILogger<ThumbnailsController> logger)
    {
        _thumbnailService = thumbnailService;
        _logger = logger;
    }

    /// <summary>
    /// Stream thumbnail file with HTTP Range request support
    /// </summary>
    /// <param name="path">Relative path to the media file to which thumbnail is requested (catchall route parameter)</param>
    /// <returns>image stream with appropriate headers</returns>
    [HttpGet]
    [HttpGet("{**path}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status416RangeNotSatisfiable)]
    public async Task<IActionResult> GetThumbnailAsync(string? path)
    {
        try
        {
            if (string.IsNullOrEmpty(path))
            {
                return BadRequest(new { error = "Path is required" });
            }

            // Decode URL-encoded characters (e.g. %5C) and normalize slashes to a consistent relative path
            path = WebUtility.UrlDecode(path ?? string.Empty);
            path = path.Replace('\\', '/');
            path = path.TrimStart('/', '\\');

            Stream stream = await _thumbnailService.GetThumbnailAsync(path);
            Response.Headers.ContentLength = stream.Length;
            Response.Headers.AcceptRanges = "bytes";
            Response.Headers.CacheControl = "public, max-age=31536000"; // 1 year cache for static media

            return File(stream, "image/webp");
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogError(ex, "Error streaming media: {path}", path);
            return NotFound(new { error = "Media file not found" });
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogError(ex, "Error streaming media: {path}", path);
            return BadRequest(new { error = "Invalid path" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming media: {path}", path);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Internal server error" });
        }
    }

}
