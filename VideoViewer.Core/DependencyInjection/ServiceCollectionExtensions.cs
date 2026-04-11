namespace VideoViewer.Core.DependencyInjection;

using Microsoft.Extensions.DependencyInjection;
using VideoViewer.Core.Services;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddVideoViewerCore(this IServiceCollection services)
    {

        // Register domain services
        services.AddSingleton<IDirectoryConfigService, DirectoryConfigService>();
        services.AddSingleton<IMpegService, MpegService>();
        services.AddSingleton<IThumbnailService, ThumbnailService>();
        services.AddScoped<IFileSystemService, FileSystemService>();
        services.AddScoped<IMediaService, MediaService>();

        string ffmpegPath = FFmpegBootstrapper.EnsureExtracted();

        services.AddSingleton(new FFmpegConfig(ffmpegPath));

        return services;

    }
}