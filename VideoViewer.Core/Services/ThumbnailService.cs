namespace VideoViewer.Core.Services;

using Microsoft.Extensions.Logging;
using System.Net;

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

        var fullPath =  Path.Combine(rootDir, decoded);

        return Path.GetFullPath(fullPath);
    }

    public async Task<Stream> GetThumbnailAsync(string relativeMediaPath)
    {
        try
        {
            var relativeThumbnailPath = relativeMediaPath + ".webp";

            var resolvedMediaPath = GetFullResolvedDecodedPath(relativeMediaPath, _directoryConfig.GetRootDirectory());
            var resolvedThumbnailPath = GetFullResolvedDecodedPath(relativeThumbnailPath, _directoryConfig.GetRootDirectory() + Path.DirectorySeparatorChar + "_thumbnails");

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