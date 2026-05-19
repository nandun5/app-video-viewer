using System.IO;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using VideoViewer.Core.Services;
using VideoViewer.Web.Hubs;

namespace VideoViewer.Web.Services;

public class DirectoryWatcher : BackgroundService
{
    private readonly IDirectoryConfigService _directoryConfig;
    private readonly IHubContext<DirectoryHub> _hubContext;
    private readonly ILogger<DirectoryWatcher> _logger;
    private FileSystemWatcher? _watcher;

    public DirectoryWatcher(IDirectoryConfigService directoryConfig, IHubContext<DirectoryHub> hubContext, ILogger<DirectoryWatcher> logger)
    {
        _directoryConfig = directoryConfig;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            var root = _directoryConfig.GetRootDirectory();
            if (!Directory.Exists(root))
            {
                _logger.LogWarning("DirectoryWatcher: root directory does not exist: {root}", root);
                return Task.CompletedTask;
            }

            _watcher = new FileSystemWatcher(root)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size
            };

            FileSystemEventHandler onChange = async (s, e) => await BroadcastChange(e.FullPath);
            RenamedEventHandler onRenamed = async (s, e) => await BroadcastChange(e.FullPath);

            _watcher.Created += onChange;
            _watcher.Changed += onChange;
            _watcher.Deleted += onChange;
            _watcher.Renamed += onRenamed;

            _watcher.EnableRaisingEvents = true;

            _logger.LogInformation("DirectoryWatcher started watching {root}", root);

            // Keep running until cancelled
            stoppingToken.Register(() => _logger.LogInformation("DirectoryWatcher stopping"));
            return Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DirectoryWatcher failed to start");
            return Task.CompletedTask;
        }
    }

    private async Task BroadcastChange(string fullPath)
    {
        try
        {
            var root = _directoryConfig.GetRootDirectory();
            var relative = Path.GetRelativePath(root, fullPath).Replace('\\', '/');
            if (string.IsNullOrEmpty(relative)) relative = string.Empty;

            _logger.LogDebug("DirectoryWatcher broadcasting change: {path}", relative);
            await _hubContext.Clients.All.SendAsync("DirectoryChanged", relative);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to broadcast directory change for {path}", fullPath);
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            _watcher?.Dispose();
            _logger.LogInformation("DirectoryWatcher stopped");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error stopping DirectoryWatcher");
        }

        return base.StopAsync(cancellationToken);
    }
}
