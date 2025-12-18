namespace VideoViewer.Core.Services;

using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.Logging;
using VideoViewer.Core.Models;

/// <summary>
/// Scans and retrieves file system structure
/// </summary>
public interface IFileSystemService
{
    Task<DirectoryContent> GetDirectoryContentAsync(string? relativePath = null);
    Task<FileSystemItem?> GetFileItemAsync(string relativePath);
}

/// <summary>
/// Implementation that scans the configured root directory
/// </summary>
public class FileSystemService : IFileSystemService
{
    private readonly IDirectoryConfigService _directoryConfig;
    private readonly ILogger<FileSystemService> _logger;
    private const long MAX_FILE_SIZE = 100L * 1024 * 1024 * 1024; // 100GB limit

    public FileSystemService(IDirectoryConfigService directoryConfig, ILogger<FileSystemService> logger)
    {
        _directoryConfig = directoryConfig;
        _logger = logger;
    }

    public async Task<DirectoryContent> GetDirectoryContentAsync(string? relativePath = null)
    {
        try
        {
            var rootDir = _directoryConfig.GetRootDirectory();
            var fullPath = string.IsNullOrEmpty(relativePath) 
                ? rootDir 
                : Path.Combine(rootDir, relativePath);

            // Security: Ensure the resolved path is within root directory
            var resolvedPath = Path.GetFullPath(fullPath);
            if (!resolvedPath.StartsWith(Path.GetFullPath(rootDir), StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Path traversal attempt detected: {path}", fullPath);
                throw new UnauthorizedAccessException("Invalid path");
            }

            if (!Directory.Exists(resolvedPath))
            {
                _logger.LogWarning("Directory not found: {path}", resolvedPath);
                throw new DirectoryNotFoundException($"Directory not found: {resolvedPath}");
            }

            var dirInfo = new DirectoryInfo(resolvedPath);
            var items = new List<FileSystemItem>();

            // Get subdirectories
            foreach (var dir in dirInfo.EnumerateDirectories())
            {
                items.Add(new FileSystemItem
                {
                    Name = dir.Name,
                    Path = Path.GetRelativePath(rootDir, dir.FullName),
                    IsDirectory = true,
                    Modified = dir.LastWriteTime
                });
            }

            // Get media files and sort
            foreach (var file in dirInfo.EnumerateFiles())
            {
                if (SupportedMediaTypes.IsMediaFile(file.FullName))
                {
                    items.Add(new FileSystemItem
                    {
                        Name = file.Name,
                        Path = Path.GetRelativePath(rootDir, file.FullName),
                        IsDirectory = false,
                        Size = file.Length,
                        Modified = file.LastWriteTime,
                        MediaType = GetMimeType(file.Extension)
                    });
                }
            }

            // Sort: directories first, then by name
            items = items.OrderByDescending(x => x.IsDirectory).ThenBy(x => x.Name).ToList();

            var content = new DirectoryContent
            {
                Name = dirInfo.Name,
                Path = Path.GetRelativePath(rootDir, resolvedPath),
                IsDirectory = true,
                Items = items
            };

            return await Task.FromResult(content);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading directory: {path}", relativePath);
            throw;
        }
    }

    public async Task<FileSystemItem?> GetFileItemAsync(string relativePath)
    {
        try
        {
            var rootDir = _directoryConfig.GetRootDirectory();
            var fullPath = Path.Combine(rootDir, relativePath);
            var resolvedPath = Path.GetFullPath(fullPath);

            // Security check
            if (!resolvedPath.StartsWith(Path.GetFullPath(rootDir), StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Path traversal attempt detected: {path}", relativePath);
                return null;
            }

            if (!File.Exists(resolvedPath) || !SupportedMediaTypes.IsMediaFile(resolvedPath))
            {
                _logger.LogWarning("File not found or not supported: {path}", resolvedPath);
                return null;
            }

            var fileInfo = new FileInfo(resolvedPath);
            return await Task.FromResult(new FileSystemItem
            {
                Name = fileInfo.Name,
                Path = relativePath,
                IsDirectory = false,
                Size = fileInfo.Length,
                Modified = fileInfo.LastWriteTime,
                MediaType = GetMimeType(fileInfo.Extension)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file item: {path}", relativePath);
            return null;
        }
    }

    private string? GetMimeType(string extension)
    {
        return SupportedMediaTypes.MimeTypes.TryGetValue(extension, out var mime) ? mime : "application/octet-stream";
    }
}
