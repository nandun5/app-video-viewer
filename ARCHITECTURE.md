# System Architecture & Data Flow

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         User's Browser                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         React 18 Single Page Application                │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ DirectoryBrowser Component (Grid View)           │  │  │
│  │  │  - Displays folders as icons                     │  │  │
│  │  │  - Displays videos as icons                      │  │  │
│  │  │  - Displays images as icons                      │  │  │
│  │  │  - Shows file sizes                              │  │  │
│  │  │  - Breadcrumb navigation                         │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          ↓                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │   MediaViewer Component (Fullscreen)             │  │  │
│  │  │  - HTML5 Video Player                            │  │  │
│  │  │  - Image Display                                 │  │  │
│  │  │  - Keyboard Navigation (←/→/ESC)                 │  │  │
│  │  │  - Touch Swipe Support                           │  │  │
│  │  │  - Navigation Controls                           │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          ↓                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Zustand Store (Global State)                     │  │  │
│  │  │  - currentPath: string                           │  │  │
│  │  │  - currentDirectory: DirectoryContent            │  │  │
│  │  │  - currentMediaItem: FileSystemItem              │  │  │
│  │  │  - mediaItems: FileSystemItem[]                  │  │  │
│  │  │  - isLoading: boolean                            │  │  │
│  │  │  - error: string | null                          │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          ↓                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ Axios HTTP Client                                │  │  │
│  │  │  - fileSystemApi.getDirectory()                  │  │  │
│  │  │  - mediaApi.getMediaUrl()                        │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTP/HTTPS
               │ (http://localhost:5000)
               ↓
┌──────────────────────────────────────────────────────────────┐
│              ASP.NET Core 10 Web API Backend                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Program.cs - Startup & Configuration                  │  │
│  │  - Register DI services                              │  │
│  │  - Configure CORS policy                             │  │
│  │  - Setup Serilog logging                             │  │
│  │  - Enable Swagger                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Controllers - HTTP Endpoints                          │  │
│  │                                                        │  │
│  │ FileSystemController                                  │  │
│  │  ├─ GET /api/filesystem → DirectoryContent (JSON)    │  │
│  │  └─ GET /api/filesystem/{path} → FileSystemItem      │  │
│  │                                                        │  │
│  │ MediaController                                       │  │
│  │  ├─ GET /api/media/stream → Binary Stream (206)      │  │
│  │  └─ HEAD /api/media/stream → Headers Only            │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Services Layer (Business Logic)                       │  │
│  │                                                        │  │
│  │ FileSystemService                                     │  │
│  │  ├─ GetDirectoryContentAsync(path)                    │  │
│  │  │   └─ Returns DirectoryContent with HATEOAS links   │  │
│  │  └─ GetFileItemAsync(path)                            │  │
│  │      └─ Returns FileSystemItem metadata               │  │
│  │                                                        │  │
│  │ MediaService                                          │  │
│  │  ├─ GetMediaStreamAsync(path, range)                  │  │
│  │  │   └─ Returns file stream with seeking              │  │
│  │  └─ GetMediaInfoAsync(path)                           │  │
│  │      └─ Returns mime type + size                      │  │
│  │                                                        │  │
│  │ DirectoryConfigService                                │  │
│  │  ├─ GetRootDirectory()                                │  │
│  │  └─ SetRootDirectory(path)                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Security Layer                                         │  │
│  │                                                        │  │
│  │ Path Validation                                        │  │
│  │  ├─ All paths must be under root directory            │  │
│  │  ├─ Check via Path.GetFullPath()                       │  │
│  │  └─ Throw UnauthorizedAccessException on traversal     │  │
│  │                                                        │  │
│  │ File Type Validation                                   │  │
│  │  ├─ Only .mp4, .jpg, .png, etc. served               │  │
│  │  └─ Check extension against SupportedMediaTypes       │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Models & Domain Objects                               │  │
│  │                                                        │  │
│  │ FileSystemItem                                         │  │
│  │  ├─ name, path, isDirectory                            │  │
│  │  ├─ mediaType, size, modified                          │  │
│  │  └─ links (HATEOAS)                                    │  │
│  │                                                        │  │
│  │ DirectoryContent                                       │  │
│  │  ├─ name, path, isDirectory                            │  │
│  │  ├─ items: FileSystemItem[]                            │  │
│  │  └─ links (HATEOAS)                                    │  │
│  │                                                        │  │
│  │ SupportedMediaTypes                                    │  │
│  │  ├─ VideoExtensions                                    │  │
│  │  ├─ ImageExtensions                                    │  │
│  │  └─ MimeTypes                                          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────┬───────────────────────────────────────────────┘
               │ File System Access
               │ (Read-only)
               ↓
┌──────────────────────────────────────────────────────────────┐
│                    Local File System                          │
│  C:\Videos\                                                  │
│   ├── Folder1\                                               │
│   │   ├── video1.mp4                                         │
│   │   └── image1.jpg                                         │
│   ├── Folder2\                                               │
│   ├── video2.mkv                                             │
│   └── image2.png                                             │
└──────────────────────────────────────────────────────────────┘
```

## User Interaction Flow

```
START
  │
  ├─→ App Opens (http://localhost:3000)
  │   │
  │   ├─→ useEffect triggers
  │   │   │
  │   │   └─→ API: GET /api/filesystem
  │   │       Response: DirectoryContent (root folder)
  │   │
  │   └─→ Store: setCurrentDirectory(root)
  │       Zustand state updated
  │
  ├─→ User sees grid of folders/media icons
  │
  ├─→ User clicks FOLDER
  │   │
  │   ├─→ Action: onNavigate(folder_path)
  │   │   │
  │   │   ├─→ Store: setCurrentPath(folder_path)
  │   │   │
  │   │   └─→ useEffect triggers (dependency: currentPath)
  │   │       │
  │   │       └─→ API: GET /api/filesystem?path=folder_path
  │   │           Response: DirectoryContent (subfolder)
  │   │
  │   └─→ Store: setCurrentDirectory(subfolder)
  │
  ├─→ User clicks VIDEO or IMAGE
  │   │
  │   ├─→ Action: onSelectMedia(item)
  │   │   │
  │   │   └─→ Store: setCurrentMediaItem(item)
  │   │
  │   ├─→ MediaViewer component renders (fullscreen)
  │   │   │
  │   │   └─→ <video> or <img>
  │   │       src = `/api/media/stream?path=...`
  │   │
  │   ├─→ Browser requests stream
  │   │   │
  │   │   ├─→ API: GET /api/media/stream?path=item.path
  │   │   │   │
  │   │   │   └─→ Media Controller
  │   │   │       ├─ Checks Range header
  │   │   │       ├─ Returns 206 (or 200)
  │   │   │       ├─ Sets Content-Range header
  │   │   │       └─ Streams file in chunks
  │   │   │
  │   │   └─→ Browser renders video/image
  │   │
  │   ├─→ User presses RIGHT ARROW
  │   │   │
  │   │   └─→ Action: goToNextMedia()
  │   │       │
  │   │       └─→ Store: currentMediaIndex++
  │   │           setCurrentMediaItem(mediaItems[index])
  │   │
  │   ├─→ MediaViewer updates
  │   │   │
  │   │   └─→ src updates → loads next media
  │   │
  │   ├─→ User swipes LEFT (touch)
  │   │   │
  │   │   └─→ onTouchStart/onTouchEnd handlers
  │   │       │
  │   │       └─→ Action: goToNextMedia()
  │   │
  │   ├─→ User presses ESC
  │   │   │
  │   │   └─→ Action: onClose()
  │   │       │
  │   │       └─→ Store: setCurrentMediaItem(null)
  │   │
  │   └─→ DirectoryBrowser component renders
  │
  └─→ LOOP back to "User clicks FOLDER" or "User clicks VIDEO"

END
```

## API Request/Response Flow

### GET /api/filesystem?path=subfolder

```
Request:
  GET /api/filesystem?path=subfolder
  Host: localhost:5001
  Authorization: (none - public endpoint)

Response (200 OK):
  Content-Type: application/json

  {
    "name": "subfolder",
    "path": "subfolder",
    "isDirectory": true,
    "items": [
      {
        "name": "video1.mp4",
        "path": "subfolder/video1.mp4",
        "isDirectory": false,
        "mediaType": "video/mp4",
        "size": 1048576,
        "modified": "2025-12-17T12:00:00Z",
        "links": {
          "view": "/api/media/stream?path=subfolder%2Fvideo1.mp4",
          "thumbnail": "/api/media/stream?path=subfolder%2Fvideo1.mp4"
        }
      },
      {
        "name": "image1.jpg",
        "path": "subfolder/image1.jpg",
        "isDirectory": false,
        "mediaType": "image/jpeg",
        "size": 524288,
        "modified": "2025-12-17T11:30:00Z",
        "links": {
          "view": "/api/media/stream?path=subfolder%2Fimage1.jpg",
          "thumbnail": "/api/media/stream?path=subfolder%2Fimage1.jpg"
        }
      }
    ],
    "links": {
      "self": "/api/filesystem?path=subfolder",
      "root": "/api/filesystem"
    }
  }
```

### GET /api/media/stream?path=subfolder/video1.mp4 (with Range)

```
Request:
  GET /api/media/stream?path=subfolder%2Fvideo1.mp4
  Host: localhost:5001
  Range: bytes=0-1048575

Response (206 Partial Content):
  Accept-Ranges: bytes
  Content-Range: bytes 0-1048575/5242880
  Content-Length: 1048576
  Content-Type: video/mp4
  Cache-Control: public, max-age=31536000

  [binary video data - 1048576 bytes]
```

## Directory Structure Visualization

```
Root Directory (configured in appsettings.json)
│
├── 📁 Family Vacation
│   ├── 🎬 beach_day.mp4
│   ├── 🎬 swimming.mp4
│   ├── 🖼️ sunset.jpg
│   └── 🖼️ family_photo.png
│
├── 📁 Movies
│   ├── 🎬 movie1.mkv
│   ├── 🎬 movie2.mp4
│   └── 📁 Subtitles
│       ├── 📄 movie1.srt
│       └── 📄 movie2.srt
│
├── 📁 Screenshots
│   ├── 🖼️ screen1.png
│   ├── 🖼️ screen2.bmp
│   └── 🖼️ screen3.webp
│
├── 🎬 tutorial.webm
├── 🎬 interview.mov
├── 🖼️ logo.ico
└── 🖼️ banner.gif
```

## Technology Stack Interactions

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Browser Environment                                    │
│  ├─ HTML5 Canvas / Video / Image tags                  │
│  ├─ JavaScript ES2020+                                 │
│  ├─ TypeScript (compile-time type checking)            │
│  ├─ React 18 (component framework)                     │
│  ├─ Zustand (lightweight state management)             │
│  ├─ Axios (HTTP client)                                │
│  ├─ CSS3 (Grid, Flexbox, Media Queries)                │
│  └─ Webpack/Babel (bundling & transpilation)           │
│
└──────────────┬──────────────────────────────────────────┘
               │
       HTTPS REST API
               │
┌──────────────▼──────────────────────────────────────────┐
│                                                         │
│  .NET 10 Runtime                                        │
│  ├─ ASP.NET Core (web framework)                        │
│  ├─ Kestrel (HTTP server)                               │
│  ├─ Dependency Injection (IoC container)                │
│  ├─ System.IO (file access)                             │
│  ├─ System.Net (HTTP headers)                           │
│  ├─ Serilog (structured logging)                        │
│  ├─ LINQ (query API responses)                          │
│  └─ OpenAPI/Swagger (API documentation)                 │
│
└──────────────┬──────────────────────────────────────────┘
               │
        File System Read
               │
┌──────────────▼──────────────────────────────────────────┐
│                                                         │
│  Operating System                                       │
│  ├─ File I/O                                            │
│  ├─ Directory enumeration                               │
│  ├─ Stream I/O                                          │
│  ├─ Permission checks                                   │
│  └─ Disk access                                         │
│
└─────────────────────────────────────────────────────────┘
```

---

**Architecture Diagram Created**: December 17, 2025  
**Namespace**: VideoViewer  
**Framework**: .NET 10 / React 18  
**API Compliance**: Richardson Maturity Level 4 (HATEOAS)
