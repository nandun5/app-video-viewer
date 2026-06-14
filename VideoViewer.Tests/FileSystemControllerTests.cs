namespace VideoViewer.Tests;

using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using VideoViewer.Controllers;
using VideoViewer.Core.Models;
using VideoViewer.Core.Services;
using Xunit;

public class FileSystemControllerTests
{
    [Fact]
    public async Task GetDirectory_WithImageItem_ReturnsThumbnailLinkForImage()
    {
        // Arrange
        var fileSystemService = new Mock<IFileSystemService>();
        var logger = new Mock<ILogger<FileSystemController>>();

        fileSystemService
            .Setup(x => x.GetDirectoryContentAsync(null))
            .ReturnsAsync(new DirectoryContent
            {
                Name = "root",
                Path = string.Empty,
                IsDirectory = true,
                Items =
                [
                    new FileSystemItem
                    {
                        Name = "photo.jpg",
                        Path = "photo.jpg",
                        IsDirectory = false,
                        MediaType = "image/jpeg",
                        Size = 100,
                        Modified = DateTime.UtcNow
                    }
                ]
            });

        var controller = new FileSystemController(fileSystemService.Object, logger.Object);

        // Act
        var result = await controller.GetDirectory(null);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var dto = Assert.IsType<DirectoryContentDto>(okResult.Value);
        var item = Assert.Single(dto.Items);

        Assert.Equal("/api/thumbnails/photo.jpg", item.Links?["thumbnail"]);
    }
}
