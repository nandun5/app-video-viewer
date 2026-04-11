using System;
using System.IO;
using System.Reflection;

namespace VideoViewer.Core.Services
{
    
    public record FFmpegConfig(string FFmpegPath);

    public static class FFmpegBootstrapper
    {
        public static string EnsureExtracted()
        {
            string baseDir = AppContext.BaseDirectory; // <-- Web bin folder
            Console.WriteLine($"FFmpeg extraction base dir: {baseDir}");
            string ffmpegPath = Path.Combine(baseDir, "ffmpeg.exe");
            string ffprobePath = Path.Combine(baseDir, "ffprobe.exe");

            ExtractIfMissing(
                "VideoViewer.Core.Native.ffmpeg.ffmpeg.exe",
                ffmpegPath);

            ExtractIfMissing(
                "VideoViewer.Core.Native.ffmpeg.ffprobe.exe",
                ffprobePath);

            return ffmpegPath;
        }

        private static void ExtractIfMissing(string resourceName, string outputPath)
        {
            if (File.Exists(outputPath))
                return;

            var assembly = typeof(FFmpegBootstrapper).Assembly;

            using Stream? resource =
                assembly.GetManifestResourceStream(resourceName);

            if (resource == null)
                throw new InvalidOperationException(
                    $"Embedded resource not found: {resourceName}");

            using FileStream file =
                new(outputPath, FileMode.Create, FileAccess.Write);

            resource.CopyTo(file);
        }
    }
}
