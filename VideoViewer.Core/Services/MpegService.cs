namespace VideoViewer.Core.Services;

using System.Diagnostics;

public interface IMpegService
{
    public Task CreateThumbnailAsync(string input, string output);
}

public class MpegService : IMpegService
{
    private readonly string _ffmpegPath;
    public MpegService(FFmpegConfig config)
    {
        _ffmpegPath = config.FFmpegPath;
    }

    public Task CreateThumbnailAsync(string input, string output)
    {
        return Task.Run(() =>
        {
            // Ensure output directory exists (no-op if it already does)
            string? outputDir = Path.GetDirectoryName(output);
            if (!string.IsNullOrWhiteSpace(outputDir))
            {
                Directory.CreateDirectory(outputDir);
            }

            string args =
                $"-y -i \"{input}\" " +
                "-vf \"thumbnail=10," +
                // "-vf \"select='not(mod(n\\,8))'," +
                "setpts=N/(3*TB)," +
                "scale=100:100:flags=lanczos:force_original_aspect_ratio=decrease\" " + 
                "-r 3 " +                // output GIF FPS = 3
                "-gifflags -transdiff " + // optimize GIF
                "-loop 0 " +              // infinite loop
                $"\"{output}\"";

            Console.WriteLine($"Running FFmpeg: {_ffmpegPath} {args}");
            RunFFmpeg(args);
        });
    }

    private void RunFFmpeg(string arguments)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "ffmpeg.exe",  // Or your extracted path
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = startInfo };

        // Read output asynchronously to avoid deadlock
        process.OutputDataReceived += (s, e) => { /* ignore or log e.Data */ };
        process.ErrorDataReceived += (s, e) => { /* ignore or log e.Data */ };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        process.WaitForExit();
        if (process.ExitCode != 0)
            throw new Exception($"FFmpeg exited with code {process.ExitCode}");
    }
}