# Video Viewer Application

A modern web-based video and image viewer built with **ASP.NET Core 10** and **React 18**, featuring a responsive dark-themed UI with support for browsing local media files.

## Features

- 📁 **Folder Navigation**: Browse directory structure with intuitive UI
- 🎬 **Video Playback**: Stream videos with full HTTP range request support for seeking
- 🖼️ **Image Viewing**: Display images in fullscreen with responsive sizing
- 📱 **Responsive Design**: Adapts seamlessly to desktop, tablet, and mobile devices
- 🎨 **Dark Theme**: Modern black theme with optimized contrast
- ⌨️ **Keyboard Navigation**: Arrow keys for next/previous media, ESC to close
- 👆 **Touch Support**: Swipe left/right on touch devices to navigate between media
- 🔒 **Security**: Path traversal protection on all API endpoints
- 📡 **Richardson Maturity Level 4 API**: Proper REST implementation with HATEOAS

## Tech Stack

### Backend
- **.NET 10** with ASP.NET Core
- **Serilog** for structured logging
- **Dependency Injection** for loose coupling
- **Swagger/OpenAPI** for API documentation

### Frontend
- **React 18** with TypeScript
- **Zustand** for state management
- **Axios** for HTTP requests
- **CSS3** with responsive grid layouts

## Project Structure

```
VideoViewer/
├── VideoViewer.sln                 # Solution file
├── VideoViewer.Web/                # Web API + React frontend
│   ├── Controllers/
│   │   ├── FileSystemController.cs # Browse folders/files
│   │   └── MediaController.cs      # Stream media
│   ├── Program.cs                  # ASP.NET configuration
│   ├── ClientApp/                  # React application
│   │   ├── src/
│   │   │   ├── components/         # React components
│   │   │   ├── api/                # API client
│   │   │   ├── store/              # Zustand store
│   │   │   └── App.tsx
│   │   └── package.json
│   └── appsettings.json
├── VideoViewer.Core/               # Shared domain logic
│   ├── Models/                     # FileSystemItem, DirectoryContent
│   └── Services/                   # FileSystem, Media, Config services
└── VideoViewer.Tests/              # Unit tests with xUnit
```

## Getting Started

### Prerequisites

- **.NET 10 SDK** ([download](https://dotnet.microsoft.com/download/dotnet/10.0))
- **Node.js 18+** ([download](https://nodejs.org/))
- **npm** (included with Node.js)

### Backend Setup

```bash
# Restore NuGet packages
dotnet restore

# Build solution
dotnet build

# Run tests
dotnet test

# Start API server (runs on http://localhost:5000)
dotnet run --project VideoViewer.Web
```

### Frontend Setup

```bash
# Install npm dependencies
cd VideoViewer.Web/ClientApp
npm install

# Start React dev server (runs on http://localhost:3000)
npm start
```

The React app automatically proxies API calls to `http://localhost:5000` during development.

## Configuration

### Root Media Directory

Configure the root directory for video/image files in `appsettings.json`:

```json
{
  "VideoViewer": {
    "RootDirectory": "C:\\Videos"
  }
}
```

Alternatively, use `DirectoryConfigService.SetRootDirectory()` at runtime.

## API Endpoints

### File System Browsing
```
GET /api/filesystem?path=subfolder
```
Returns folder structure with HATEOAS links.

### Media Streaming
```
GET /api/media/stream?path=video.mp4
```
Supports HTTP Range requests for seeking.

### Media Info (HEAD)
```
HEAD /api/media/stream?path=video.mp4
```
Returns headers without streaming body.

## Supported Media Formats

### Video
`.mp4, .webm, .ogg, .mov, .avi, .mkv, .flv, .wmv, .m4v, .mpg, .mpeg`

### Image
`.jpg, .jpeg, .png, .gif, .bmp, .webp, .ico, .tiff`

## Development

### Adding a New Media Format

1. Update `SupportedMediaTypes` in `VideoViewer.Core/Models/FileSystemModels.cs`:
   ```csharp
   VideoExtensions.Add(".new_format");
   MimeTypes.Add(".new_format", "video/new-format");
   ```

2. Test with `VideoViewer.Tests/FileSystemServiceTests.cs`

### Extending the API

- Controllers in `VideoViewer.Web/Controllers/`
- Services in `VideoViewer.Core/Services/`
- Models in `VideoViewer.Core/Models/`

### Extending the UI

- Components in `VideoViewer.Web/ClientApp/src/components/`
- API client in `VideoViewer.Web/ClientApp/src/api/`
- State management in `VideoViewer.Web/ClientApp/src/store/`

## Security Considerations

- ✅ **Path Traversal Protection**: All file paths validated against root directory
- ✅ **CORS Policy**: Restricted to localhost by default (configurable in `Program.cs`)
- ✅ **Range Request Validation**: HTTP range boundaries validated
- ✅ **File Type Validation**: Only supported media types served

## Performance

- **Streaming**: Large video files streamed with 64KB chunks
- **Range Requests**: Clients can seek without downloading entire file
- **Caching**: Static media cached for 1 year on client
- **Grid Rendering**: Virtual scrolling ready with responsive layout

## Logging

Logs are written to:
- **Console**: Real-time output during development
- **File**: `logs/videoviewer-YYYY-MM-DD.txt` (daily rolling files)

Enable debug logging in development by checking `appsettings.Development.json`.

## Testing

Run unit tests with:
```bash
dotnet test
```

Tests cover:
- File system scanning
- Media format detection
- Path traversal security
- Directory content retrieval

## Troubleshooting

### "Cannot find module 'zustand'" in React
```bash
cd VideoViewer.Web/ClientApp
npm install
```

### CORS errors when calling API
Ensure backend is running on `http://localhost:5000` and React on `http://localhost:3000`.

### Videos not playing
1. Check that the root directory contains valid video files
2. Verify codec support in your browser
3. Check browser console for fetch errors
4. Ensure Range requests are enabled (`Accept-Ranges` header)

### File not found errors
1. Verify the file path is correct and file exists
2. Check file permissions (app needs read access)
3. Ensure file extension is in `SupportedMediaTypes`

## Future Enhancements

- [ ] Subtitle support (.srt, .vtt)
- [ ] Thumbnail generation for videos
- [ ] Playlist creation and management
- [ ] Media library search/filter
- [ ] User preferences (theme, playback settings)
- [ ] Authentication and multi-user support
- [ ] CloudFlare R2 / AWS S3 backend storage

## License

MIT License - See LICENSE file for details

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss proposed changes.

---

**Created**: December 2025  
**Namespace**: `VideoViewer`  
**Framework**: .NET 10 / ASP.NET Core / React 18
