namespace VideoViewer.Core.Models;

/// <summary>
/// Represents a file system item (file or directory)
/// </summary>
public class FileSystemItem
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsDirectory { get; set; }
    public long? Size { get; set; }
    public DateTime Modified { get; set; }
    public string? MediaType { get; set; }
}

/// <summary>
/// Represents a directory with its contents
/// </summary>
public class DirectoryContent
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsDirectory { get; set; } = true;
    public List<FileSystemItem> Items { get; set; } = new();
    public Dictionary<string, string>? Links { get; set; }
}

/// <summary>
/// Supported media file types
/// </summary>
public static class SupportedMediaTypes
{
    public static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v", ".mpg", ".mpeg"
    };

    public static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".ico", ".tiff"
    };

    public static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        { ".mp4", "video/mp4" },
        { ".webm", "video/webm" },
        { ".ogg", "video/ogg" },
        { ".mov", "video/quicktime" },
        { ".avi", "video/x-msvideo" },
        { ".mkv", "video/x-matroska" },
        { ".flv", "video/x-flv" },
        { ".wmv", "video/x-ms-wmv" },
        { ".m4v", "video/x-m4v" },
        { ".mpg", "video/mpeg" },
        { ".mpeg", "video/mpeg" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".png", "image/png" },
        { ".gif", "image/gif" },
        { ".bmp", "image/bmp" },
        { ".webp", "image/webp" },
        { ".ico", "image/x-icon" },
        { ".tiff", "image/tiff" }
    };

    public static bool IsVideo(string path) => VideoExtensions.Contains(Path.GetExtension(path));
    public static bool IsImage(string path) => ImageExtensions.Contains(Path.GetExtension(path));
    public static bool IsMediaFile(string path) => IsVideo(path) || IsImage(path);
}
