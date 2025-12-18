# AI Coding Agent Instructions - Video Viewer Application

## Project Overview
This is a **web-based video/image viewer** built with **.NET 10** and **React.js**. The root namespace is `VideoViewer`. Videos and images are served from a configurable local directory. The application uses Git for version control and follows .NET development conventions (build outputs in `bin/` and `obj/`, packages managed via NuGet).

## Architecture & Key Components

### Project Structure
- **VideoViewer.Web**: ASP.NET Core Web API + React frontend (SPA)
- **VideoViewer.Core**: Shared models, services, domain logic
- **VideoViewer.Tests**: Unit and integration tests

### Core Services & Data Flow
- **FileSystemService**: Scans configured directory, returns folder/file structure
- **MediaService**: Serves video/image files as streams with proper MIME types
- **DirectoryConfigService**: Manages configurable root directory setting
- Data flow: React UI → API endpoints → Services → File System → HTTP response (streaming/JSON)
- React handles client-side navigation between folders and media playback

### Tech Stack
- **Backend**: ASP.NET Core 10, REST API (Richardson Maturity Level 4)
- **Frontend**: React 18+, TypeScript, Responsive design
- **Styling**: CSS with black theme
- **State Management**: React Context API or Zustand

## Development Workflows

### Initial Setup
```bash
# Install .NET 10 SDK
# Create solution and projects
dotnet new sln -n VideoViewer
dotnet new webapi -n VideoViewer.Web
dotnet new classlib -n VideoViewer.Core
dotnet new xunit -n VideoViewer.Tests
# Add projects to solution
dotnet sln add VideoViewer.Web/VideoViewer.Web.csproj
dotnet sln add VideoViewer.Core/VideoViewer.Core.csproj
dotnet sln add VideoViewer.Tests/VideoViewer.Tests.csproj
```

### Building
```bash
dotnet build
```

### Running
```bash
# Backend runs on http://localhost:5000 (or port in launchSettings.json)
dotnet run --project VideoViewer.Web
# React dev server (from VideoViewer.Web/ClientApp): npm start
```

### Testing
```bash
dotnet test
```

### Adding NuGet Dependencies
```bash
dotnet add package <PackageName>
# Common packages: Microsoft.Extensions.Configuration, Serilog, etc.
```

## Conventions & Patterns

## API Endpoints (Richardson Maturity Level 4)

### File System Structure Endpoint
```
GET /api/filesystem?path=/optional/subfolder
Response: 200 OK
{
  "name": "folder_name",
  "path": "/absolute/path",
  "isDirectory": true,
  "items": [
    {
      "name": "video.mp4",
      "path": "/absolute/path/video.mp4",
      "isDirectory": false,
      "mediaType": "video/mp4",
      "size": 1024000,
      "thumbnail": "/api/media/thumbnail?path=/absolute/path/video.mp4"
    }
  ]
}
```

### Media Streaming Endpoint
```
GET /api/media/stream?path=/absolute/path/file.mp4
Response: 206 Partial Content (supports Range requests)
Content-Type: video/mp4
[binary stream]
```

### HATEOAS & Resource Links
All responses include `_links` with next/previous navigation for media items in folder context. Self-documenting API through link relations.

## Conventions & Patterns

### Naming
- **Classes**: PascalCase, verb+noun (e.g., `VideoPlayer`, `FileLoader`)
- **Methods**: PascalCase with clear action names (e.g., `LoadVideo`, `PlayVideo`)
- **Private fields**: `_camelCase` prefix with underscore
- **Constants**: `UPPER_SNAKE_CASE` in static classes

### File Organization
- Keep service logic separate from UI code
- Use dependency injection for services (constructor injection)
- Place tests in `*.Tests` project parallel to source project

### Error Handling
- Use custom exceptions for domain-specific errors (e.g., `VideoFormatNotSupportedException`)
- Log through a unified logger (expected pattern: inject `ILogger` or similar)
- Avoid silent failures; log and propagate meaningful errors

## Integration Points

### Video Codec Support
- Document supported formats in README
- Use standard .NET media APIs or external libraries (FFmpeg bindings, LibVLC, etc.)
- Test codec compatibility explicitly

### File I/O
- Use `System.IO` for file operations
- Validate file paths and handle missing files gracefully
- Consider async I/O for large files

### Configuration
- Store settings in `appsettings.json` or user preferences store
- Externalize magic numbers (timeouts, buffer sizes, etc.)

## Common Tasks

### Adding a New Video Format Support
1. Create format-specific handler in a service
2. Register handler in dependency injection container
3. Add unit tests for codec parsing
4. Update documentation

### Implementing Playback Controls
1. Define command interfaces in Models
2. Implement in service layer
3. Wire UI events to commands via dependency injection
4. Test state transitions

### Debugging Tips
- Enable debug logging via configuration
- Use breakpoints on video load and playback events
- Check file access permissions for local videos
- Verify codec availability on target platform

## Testing Strategy

- **Unit Tests**: Test video metadata parsing, playback logic in isolation
- **Integration Tests**: Test file loading + playback command pipeline
- **Manual**: Video formats, subtitle support, playlist scenarios

## References
- Start with `Program.cs` or main entry point to understand bootstrapping
- Check `package*.json` equivalents (`.csproj` files) for dependencies
- Look for existing `README.md` for project-specific context

## Frontend Patterns (React)

### State Management with Zustand
State is managed in `VideoViewer.Web/ClientApp/src/store/mediaStore.ts`. Actions include:
- `setCurrentDirectory()` - Loads a folder and extracts media files
- `goToNextMedia()` / `goToPreviousMedia()` - Navigation within media list
- `setCurrentMediaItem()` - Opens a video/image in fullscreen viewer

### Component Structure
- **DirectoryBrowser**: Main grid view for folders and media items
- **MediaViewer**: Fullscreen player with keyboard/touch swipe support
- Touch swipe (left/right) navigates between media; keyboard arrows do the same

### API Client Pattern
`VideoViewer.Web/ClientApp/src/api/mediaApi.ts` exports:
- `fileSystemApi.getDirectory()` - Returns `DirectoryContent` with items and HATEOAS links
- `mediaApi.getMediaUrl()` - Returns streaming URL
- All URLs are properly encoded for special characters

### Responsive Design
- Grid uses `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`
- Mobile breakpoints at 768px and 480px
- Video/image scaling with `max-width: 100%; max-height: 100%; object-fit: contain`

## Backend Patterns (.NET)

### Service Layer
All business logic lives in `VideoViewer.Core/Services/`:
- **FileSystemService**: Scans directories, filters by media type, validates paths
- **MediaService**: Opens file streams with range support
- **DirectoryConfigService**: Manages configurable root path (singleton)

### Path Security
Every file operation:
1. Combines with root directory
2. Resolves full path with `Path.GetFullPath()`
3. Validates resolved path starts with root using `StringComparison.OrdinalIgnoreCase`
4. Throws `UnauthorizedAccessException` on traversal attempt

### HTTP Range Requests
`MediaController.Stream()` checks `Request.Headers.Range`, returns 206 Partial Content with:
- `Content-Range: bytes start-end/total`
- `Accept-Ranges: bytes` header
- Maintains stream position for seeks

### HATEOAS Links
All directory items include `Links` dict with:
- Folders: `{ "view": "/api/filesystem?path=..." }`
- Media: `{ "view": "/api/media/stream?path=...", "thumbnail": "..." }`
- Root navigation: `{ "self": "...", "root": "/api/filesystem" }`

---
*Last updated: 2025-12-17*
