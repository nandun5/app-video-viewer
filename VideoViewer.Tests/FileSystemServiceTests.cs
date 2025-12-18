namespace VideoViewer.Tests;

using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using VideoViewer.Core.Services;
using VideoViewer.Core.Models;

public class FileSystemServiceTests
{
    private readonly Mock<IDirectoryConfigService> _mockDirectoryConfig;
    private readonly Mock<ILogger<FileSystemService>> _mockLogger;
    private readonly FileSystemService _service;

    public FileSystemServiceTests()
    {
        _mockDirectoryConfig = new Mock<IDirectoryConfigService>();
        _mockLogger = new Mock<ILogger<FileSystemService>>();
        _service = new FileSystemService(_mockDirectoryConfig.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task GetDirectoryContentAsync_WithValidPath_ReturnsDirectoryContent()
    {
        // Arrange
        var rootDir = Path.Combine(Path.GetTempPath(), "test_videos");
        Directory.CreateDirectory(rootDir);

        _mockDirectoryConfig.Setup(x => x.GetRootDirectory()).Returns(rootDir);

        try
        {
            // Act
            var result = await _service.GetDirectoryContentAsync();

            // Assert
            Assert.NotNull(result);
            Assert.Equal("test_videos", result.Name);
            Assert.True(result.IsDirectory);
        }
        finally
        {
            // Cleanup
            if (Directory.Exists(rootDir))
            {
                Directory.Delete(rootDir, true);
            }
        }
    }

    [Fact]
    public async Task GetDirectoryContentAsync_WithPathTraversal_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var rootDir = Path.Combine(Path.GetTempPath(), "test_videos");
        Directory.CreateDirectory(rootDir);

        _mockDirectoryConfig.Setup(x => x.GetRootDirectory()).Returns(rootDir);

        try
        {
            // Act & Assert
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                _service.GetDirectoryContentAsync("../../etc/passwd"));
        }
        finally
        {
            if (Directory.Exists(rootDir))
            {
                Directory.Delete(rootDir, true);
            }
        }
    }
}

public class SupportedMediaTypesTests
{
    [Theory]
    [InlineData("video.mp4")]
    [InlineData("movie.mkv")]
    [InlineData("clip.webm")]
    public void IsVideo_WithVideoFile_ReturnsTrue(string filename)
    {
        Assert.True(SupportedMediaTypes.IsVideo(filename));
    }

    [Theory]
    [InlineData("photo.jpg")]
    [InlineData("image.png")]
    [InlineData("picture.gif")]
    public void IsImage_WithImageFile_ReturnsTrue(string filename)
    {
        Assert.True(SupportedMediaTypes.IsImage(filename));
    }

    [Theory]
    [InlineData("document.pdf")]
    [InlineData("archive.zip")]
    [InlineData("script.sh")]
    public void IsMediaFile_WithNonMediaFile_ReturnsFalse(string filename)
    {
        Assert.False(SupportedMediaTypes.IsMediaFile(filename));
    }
}
