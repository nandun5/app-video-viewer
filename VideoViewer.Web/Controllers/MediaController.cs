namespace VideoViewer.Controllers;

using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;
using System.Net;
using VideoViewer.Core.Services;

/// <summary>
/// API endpoint for media streaming with range request support (Richardson Maturity Level 4)
/// Route format: /api/media/stream/{**path} - path segments are decoded into file path
/// </summary>
[ApiController]
[Route("api/[controller]/stream")]
public class MediaController : ControllerBase
{
    private readonly IMediaService _mediaService;
    private readonly ILogger<MediaController> _logger;
    private const int BUFFER_SIZE = 65536; // 64KB chunks

    public MediaController(IMediaService mediaService, ILogger<MediaController> logger)
    {
        _mediaService = mediaService;
        _logger = logger;
    }

    /// <summary>
    /// Stream media file with HTTP Range request support (206 Partial Content)
    /// </summary>
    /// <param name="path">Relative path to the media file (catchall route parameter)</param>
    /// <returns>Media stream with appropriate headers</returns>
    [HttpGet]
    [HttpGet("{**path}")]
    [ProducesResponseType(StatusCodes.Status206PartialContent)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status416RangeNotSatisfiable)]
    public async Task<IActionResult> Stream(string? path)
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

            var (mimeType, fileSize) = await _mediaService.GetMediaInfoAsync(path);

            // Parse Range header
            var rangeHeader = Request.Headers.Range.FirstOrDefault();
            RangeHeaderValue? range = null;
            if (!string.IsNullOrEmpty(rangeHeader))
            {
                try
                {
                    range = RangeHeaderValue.Parse(rangeHeader);
                }
                catch
                {
                    // Invalid range, ignore
                    _logger.LogWarning("Invalid range header: {range}", rangeHeader);
                }
            }

            Stream stream;
            RangeRequestInfo? rangeInfo = null;

            if (range?.Ranges.Count > 0)
            {
                var firstRange = range.Ranges.First();
                long start = firstRange.From ?? 0;
                long end = firstRange.To ?? (fileSize - 1);

                if (start > end || start >= fileSize)
                {
                    Response.StatusCode = StatusCodes.Status416RangeNotSatisfiable;
                    Response.Headers.ContentRange = $"bytes */{fileSize}";
                    return new EmptyResult();
                }

                rangeInfo = new RangeRequestInfo { Start = start, End = end };
                stream = await _mediaService.GetMediaStreamAsync(path, rangeInfo);

                Response.StatusCode = StatusCodes.Status206PartialContent;
                Response.Headers.ContentRange = $"bytes {start}-{end}/{fileSize}";
                Response.Headers.ContentLength = (end - start + 1);
                Response.Headers.AcceptRanges = "bytes";

                return File(stream, mimeType, enableRangeProcessing: true);
            }
            else
            {
                stream = await _mediaService.GetMediaStreamAsync(path);
                Response.Headers.ContentLength = fileSize;
                Response.Headers.AcceptRanges = "bytes";
                Response.Headers.CacheControl = "public, max-age=31536000"; // 1 year cache for static media

                return File(stream, mimeType, enableRangeProcessing: true);
            }
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { error = "Media file not found" });
        }
        catch (UnauthorizedAccessException)
        {
            return BadRequest(new { error = "Invalid path" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming media: {path}", path);
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Internal server error" });
        }
    }

    /// <summary>
    /// Get media file information (headers only)
    /// </summary>
    /// <param name="path">Relative path to the media file (catchall route parameter)</param>
    /// <returns>Media information with headers</returns>
    [HttpHead]
    [HttpHead("{**path}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StreamHead(string? path)
    {
        try
        {
            if (string.IsNullOrEmpty(path))
            {
                return BadRequest(new { error = "Path is required" });
            }

            // Decode + normalize path for HEAD requests as well
            path = WebUtility.UrlDecode(path ?? string.Empty);
            path = path.Replace('\\', '/');
            path = path.TrimStart('/', '\\');

            var (mimeType, fileSize) = await _mediaService.GetMediaInfoAsync(path);

            Response.Headers.ContentLength = fileSize;
            Response.Headers.ContentType = mimeType;
            Response.Headers.AcceptRanges = "bytes";
            Response.Headers.CacheControl = "public, max-age=31536000";

            return Ok();
        }
        catch (FileNotFoundException)
        {
            return NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting media info: {path}", path);
            return StatusCode(StatusCodes.Status500InternalServerError);
        }
    }
}
