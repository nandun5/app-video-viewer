namespace VideoViewer.Controllers;

using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Linq;
using VideoViewer.Core.Models;
using VideoViewer.Core.Services;

/// <summary>
/// API endpoint for browsing file system structure (Richardson Maturity Level 4)
/// Route format: /api/filesystem/{**path} - path segments are decoded into folder/file path
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FileSystemController : ControllerBase
{
    private readonly IFileSystemService _fileSystemService;
    private readonly ILogger<FileSystemController> _logger;

    public FileSystemController(IFileSystemService fileSystemService, ILogger<FileSystemController> logger)
    {
        _fileSystemService = fileSystemService;
        _logger = logger;
    }

    /// <summary>
    /// Get directory contents with file listing
    /// </summary>
    /// <param name="path">Relative path from root directory (catchall route parameter)</param>
    /// <returns>DirectoryContent with items and HATEOAS links</returns>
    [HttpGet]
    [HttpGet("{**path}")]
    [ProducesResponseType(typeof(DirectoryContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DirectoryContentDto>> GetDirectory(string? path)
    {
        try
        {
            // Normalize and decode incoming path
            path = WebUtility.UrlDecode(path ?? string.Empty);
            path = path.Replace('\\', '/').TrimStart('/');

            try
            {
                var content = await _fileSystemService.GetDirectoryContentAsync(string.IsNullOrEmpty(path) ? null : path);
                var dto = MapToDto(content);
                return Ok(dto);
            }
            catch (DirectoryNotFoundException)
            {
                // Not a directory - attempt to treat as file
                var fileItem = await _fileSystemService.GetFileItemAsync(path ?? string.Empty);
                if (fileItem == null)
                {
                    return NotFound(new { error = "File not found" });
                }

                // Build links: self, root, parent, stream, previous, next
                var links = new Dictionary<string, string>
                {
                    { "self", $"/api/filesystem/{Uri.EscapeDataString(path ?? string.Empty)}" },
                    { "root", "/api/filesystem" },
                    { "stream", $"/api/media/stream/{Uri.EscapeDataString(path ?? string.Empty)}" }
                };

                // Parent folder
                var parent = string.Empty;
                var lastSlash = (path ?? string.Empty).LastIndexOf('/');
                if (lastSlash >= 0)
                {
                    parent = (path ?? string.Empty).Substring(0, lastSlash);
                    links["parent"] = $"/api/filesystem/{Uri.EscapeDataString(parent)}";
                }

                // Compute previous/next based on alphabetical order within parent folder
                try
                {
                    var directoryPathForListing = string.IsNullOrEmpty(parent) ? null : parent;
                    var parentContent = await _fileSystemService.GetDirectoryContentAsync(directoryPathForListing);
                    // Sort files by name using ordinal ignore-case for deterministic order
                    var files = parentContent.Items.Where(i => !i.IsDirectory)
                        .OrderBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    // Find index by filename only (robust to different path formats)
                    var fileName = Path.GetFileName(path ?? string.Empty);
                    var index = files.FindIndex(f => string.Equals(f.Name, fileName, StringComparison.OrdinalIgnoreCase));

                    _logger.LogDebug("Computing prev/next for file {file} in parent {parent}. Index: {index}, total files: {count}", fileName, parent, index, files.Count);

                    if (index >= 0)
                    {
                        if (index > 0)
                        {
                            var prev = files[index - 1];
                            var prevPath = string.IsNullOrEmpty(parent) ? prev.Name : (parent + "/" + prev.Name);
                            links["previous"] = $"/api/filesystem/{Uri.EscapeDataString(prevPath)}";
                        }
                        if (index < files.Count - 1)
                        {
                            var next = files[index + 1];
                            var nextPath = string.IsNullOrEmpty(parent) ? next.Name : (parent + "/" + next.Name);
                            links["next"] = $"/api/filesystem/{Uri.EscapeDataString(nextPath)}";
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to compute previous/next for {path}", path);
                    // ignore previous/next if parent listing fails
                }

                var fileDto = new FileSystemItemDto
                {
                    Name = fileItem.Name,
                    Path = fileItem.Path.Replace('\\', '/'),
                    IsDirectory = false,
                    MediaType = fileItem.MediaType,
                    Size = fileItem.Size,
                    Modified = fileItem.Modified,
                    Links = links
                };

                return Ok(fileDto);
            }
        }
        
        catch (UnauthorizedAccessException)
        {
            return BadRequest(new { error = "Invalid path" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving directory");
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Internal server error" });
        }
    }

    private DirectoryContentDto MapToDto(DirectoryContent content)
    {
        return new DirectoryContentDto
        {
            Name = content.Name,
            Path = content.Path,
            IsDirectory = content.IsDirectory,
            Items = content.Items.Select(MapToDto).ToList(),
            Links = new Dictionary<string, string>
            {
                { "self", $"/api/filesystem/{Uri.EscapeDataString(content.Path)}" },
                { "root", "/api/filesystem" }
            }
        };
    }

    private FileSystemItemDto MapToDto(FileSystemItem item)
    {
        var links = new Dictionary<string, string>();

        if (item.IsDirectory)
        {
            links["view"] = $"/api/filesystem/{Uri.EscapeDataString(item.Path)}";
        }
        else
        {
            links["view"] = $"/api/media/stream/{Uri.EscapeDataString(item.Path)}";
            if (SupportedMediaTypes.IsImage(item.Path))
            {
                links["thumbnail"] = links["view"];
            }
        }

        return new FileSystemItemDto
        {
            Name = item.Name,
            Path = item.Path,
            IsDirectory = item.IsDirectory,
            MediaType = item.MediaType,
            Size = item.Size,
            Modified = item.Modified,
            Links = links
        };
    }
}

/// <summary>
/// DTOs for API responses
/// </summary>
public class DirectoryContentDto
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsDirectory { get; set; }
    public List<FileSystemItemDto> Items { get; set; } = new();
    public Dictionary<string, string>? Links { get; set; }
}

public class FileSystemItemDto
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsDirectory { get; set; }
    public string? MediaType { get; set; }
    public long? Size { get; set; }
    public DateTime Modified { get; set; }
    public Dictionary<string, string>? Links { get; set; }
}
