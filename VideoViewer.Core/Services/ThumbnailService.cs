namespace VideoViewer.Core.Services;

using Microsoft.Extensions.Logging;
using System.Net;
using VideoViewer.Core.Models;

public interface IThumbnailService
{
    public Task<Stream> GetThumbnailAsync(string relativeMediaPath);
}

public class ThumbnailService : IThumbnailService
{
    private readonly IDirectoryConfigService _directoryConfig;
    private readonly IMpegService _mpegService;
    private readonly ILogger<ThumbnailService> _logger;

    public ThumbnailService(IDirectoryConfigService directoryConfig, IMpegService mpegService, ILogger<ThumbnailService> logger)
    {
        _directoryConfig = directoryConfig;
        _mpegService = mpegService;
        _logger = logger;
    }

    private static string GetFullResolvedDecodedPath(string path, string rootDir)
    {
        // Decode URL-encoded characters (e.g. %5C) and normalize separators
        var decoded = WebUtility.UrlDecode(path ?? string.Empty);
        // Normalize both backslashes and forward slashes to platform separator
        decoded = decoded.Replace('\\', Path.DirectorySeparatorChar).Replace('/', Path.DirectorySeparatorChar);
        // Prevent absolute path segments that would escape root
        decoded = decoded.TrimStart(Path.DirectorySeparatorChar);

        var fullPath = Path.Combine(rootDir, decoded);

        return Path.GetFullPath(fullPath);
    }

    private static bool IsSupportedMediaPath(string relativeMediaPath)
    {
        return SupportedMediaTypes.IsMediaFile(relativeMediaPath);
    }

    private string GetThumbnailOutputPath(string relativeMediaPath)
    {
        var relativeThumbnailPath = relativeMediaPath + ".webp";
        var thumbnailsRoot = Path.Combine(_directoryConfig.GetRootDirectory(), "_thumbnails");

        return GetFullResolvedDecodedPath(relativeThumbnailPath, thumbnailsRoot);
    }

    public async Task<Stream> GetThumbnailAsync(string relativeMediaPath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(relativeMediaPath) || !IsSupportedMediaPath(relativeMediaPath))
            {
                throw new NotSupportedException("Thumbnail generation is only supported for image and video files.");
            }

            var resolvedMediaPath = GetFullResolvedDecodedPath(relativeMediaPath, _directoryConfig.GetRootDirectory());
            var resolvedThumbnailPath = GetThumbnailOutputPath(relativeMediaPath);

            if (!File.Exists(resolvedThumbnailPath))
            {
                await _mpegService.CreateThumbnailAsync(resolvedMediaPath, resolvedThumbnailPath);
            }

            Stream stream = new FileStream(resolvedThumbnailPath, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, FileOptions.SequentialScan);

            return stream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting thumbnail: {path}", relativeMediaPath);
            throw;
        }
    }
}