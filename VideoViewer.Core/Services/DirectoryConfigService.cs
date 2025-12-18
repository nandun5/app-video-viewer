namespace VideoViewer.Core.Services;

using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.Configuration;
using VideoViewer.Core.Models;

/// <summary>
/// Manages the configurable root directory for media files
/// </summary>
public interface IDirectoryConfigService
{
    string GetRootDirectory();
    void SetRootDirectory(string path);
}

/// <summary>
/// Default implementation using configuration
/// </summary>
public class DirectoryConfigService : IDirectoryConfigService
{
    private const string DEFAULT_ROOT = "C:\\Videos"; // Fallback default
    private string _rootDirectory;

    public DirectoryConfigService(IConfiguration configuration)
    {
        // Read from appsettings VideoViewer:RootDirectory, fallback to DEFAULT_ROOT
        var configuredPath = configuration?["VideoViewer:RootDirectory"];
        _rootDirectory = !string.IsNullOrEmpty(configuredPath) ? configuredPath : DEFAULT_ROOT;
    }

    public string GetRootDirectory()
    {
        return _rootDirectory;
    }

    public void SetRootDirectory(string path)
    {
        if (!Directory.Exists(path))
        {
            throw new DirectoryNotFoundException($"Directory not found: {path}");
        }
        _rootDirectory = Path.GetFullPath(path);
    }
}
