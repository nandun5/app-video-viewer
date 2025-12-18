namespace VideoViewer.Core.Services;

using Microsoft.Extensions.Logging;
using System.Net;
using VideoViewer.Core.Models;

/// <summary>
/// Handles streaming and serving media files with range request support
/// </summary>
public interface IMediaService
{
    Task<Stream> GetMediaStreamAsync(string relativePath, RangeRequestInfo? rangeInfo = null);
    Task<(string MimeType, long FileSize)> GetMediaInfoAsync(string relativePath);
}

/// <summary>
/// HTTP Range request information
/// </summary>
public class RangeRequestInfo
{
    public long? Start { get; set; }
    public long? End { get; set; }
}

/// <summary>
/// Implementation for media streaming
/// </summary>
public class MediaService : IMediaService
{
    private readonly IDirectoryConfigService _directoryConfig;
    private readonly ILogger<MediaService> _logger;

    public MediaService(IDirectoryConfigService directoryConfig, ILogger<MediaService> logger)
    {
        _directoryConfig = directoryConfig;
        _logger = logger;
    }

    public async Task<Stream> GetMediaStreamAsync(string relativePath, RangeRequestInfo? rangeInfo = null)
    {
        try
        {
            var rootDir = _directoryConfig.GetRootDirectory();

            // Decode URL-encoded characters (e.g. %5C) and normalize separators
            var decoded = WebUtility.UrlDecode(relativePath ?? string.Empty);
            // Normalize both backslashes and forward slashes to platform separator
            decoded = decoded.Replace('\\', Path.DirectorySeparatorChar).Replace('/', Path.DirectorySeparatorChar);
            // Prevent absolute path segments that would escape root
            decoded = decoded.TrimStart(Path.DirectorySeparatorChar);

            var fullPath = Path.Combine(rootDir, decoded);
            var resolvedPath = Path.GetFullPath(fullPath);

            // Security check
            if (!resolvedPath.StartsWith(Path.GetFullPath(rootDir), StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Path traversal attempt detected: {path}", relativePath);
                throw new UnauthorizedAccessException("Invalid path");
            }

            if (!File.Exists(resolvedPath) || !SupportedMediaTypes.IsMediaFile(resolvedPath))
            {
                _logger.LogWarning("Media file not found: {path}", resolvedPath);
                throw new FileNotFoundException($"Media file not found: {resolvedPath}");
            }

            var stream = new FileStream(resolvedPath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, FileOptions.SequentialScan);

            if (rangeInfo?.Start.HasValue == true || rangeInfo?.End.HasValue == true)
            {
                var start = rangeInfo.Start ?? 0;
                var end = rangeInfo.End ?? (stream.Length - 1);

                if (start < stream.Length)
                {
                    stream.Seek(start, SeekOrigin.Begin);
                }
            }

            return await Task.FromResult(stream);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming media: {path}", relativePath);
            throw;
        }
    }

    public async Task<(string MimeType, long FileSize)> GetMediaInfoAsync(string relativePath)
    {
        try
        {
            var rootDir = _directoryConfig.GetRootDirectory();
            var fullPath = Path.Combine(rootDir, relativePath);
            var resolvedPath = Path.GetFullPath(fullPath);

            // Security check
            if (!resolvedPath.StartsWith(Path.GetFullPath(rootDir), StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("Invalid path");
            }

            if (!File.Exists(resolvedPath))
            {
                throw new FileNotFoundException($"File not found: {resolvedPath}");
            }

            var fileInfo = new FileInfo(resolvedPath);
            var extension = fileInfo.Extension;
            var mimeType = SupportedMediaTypes.MimeTypes.TryGetValue(extension, out var mime)
                ? mime
                : "application/octet-stream";

            return await Task.FromResult((mimeType, fileInfo.Length));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting media info: {path}", relativePath);
            throw;
        }
    }
}
