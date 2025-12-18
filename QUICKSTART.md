# Quick Start Guide

## Initial Setup (One-time)

### 1. Install Prerequisites
```bash
# .NET 10 SDK from https://dotnet.microsoft.com/download/dotnet/10.0
# Node.js 18+ from https://nodejs.org/

# Verify installations
dotnet --version
node --version
npm --version
```

### 2. Restore Dependencies
```bash
# Navigate to project root
cd app-video-viewer

# Restore .NET packages
dotnet restore

# Install React dependencies
cd VideoViewer.Web/ClientApp
npm install
cd ../..
```

## Running the Application

### Terminal 1: Backend API Server
```bash
# From project root
dotnet run --project VideoViewer.Web

# Expected output:
# info: Microsoft.Hosting.Lifetime[14]
#       Now listening on: http://localhost:5000
```

### Terminal 2: React Dev Server
```bash
# From project root
cd VideoViewer.Web/ClientApp
npm start

# Expected output:
# On Your Network: http://[YOUR_IP]:3000
# Local: http://localhost:3000
```

### Open Browser
- **React App**: http://localhost:3000
- **Swagger API Docs**: http://localhost:5000/swagger
- **Health Check**: http://localhost:5000/health

## Configuration

### Set Root Video Directory
Edit `VideoViewer.Web/appsettings.json`:

```json
{
  "VideoViewer": {
    "RootDirectory": "C:\\Path\\To\\Your\\Videos"
  }
}
```

## Development Workflow

### Adding a New API Endpoint

1. **Create controller method** in `VideoViewer.Web/Controllers/`
2. **Add service method** in `VideoViewer.Core/Services/`
3. **Add model** in `VideoViewer.Core/Models/`
4. **Add unit tests** in `VideoViewer.Tests/`
5. **Test in Swagger** at http://localhost:5000/swagger

### Adding a React Component

1. **Create component** in `VideoViewer.Web/ClientApp/src/components/`
2. **Add styles** to component or `components/styles.css`
3. **Update store** in `store/mediaStore.ts` if needed
4. **Import in App.tsx** and render

### Running Tests

```bash
# Backend tests
dotnet test

# React tests (if configured)
cd VideoViewer.Web/ClientApp
npm test
```

## Debugging

### Backend Debugging (.NET)
- Set breakpoints in Visual Studio or VS Code
- Run: `dotnet run --project VideoViewer.Web`
- Attach debugger when prompted

### Frontend Debugging (React)
- Open Chrome DevTools: F12 or Ctrl+Shift+I
- Use React Developer Tools extension
- Check Network tab for API calls
- View logs in browser Console

### Check Logs
```bash
# Tail real-time logs
tail -f VideoViewer.Web/logs/videoviewer-*.txt

# Or in PowerShell
Get-Content VideoViewer.Web/logs/videoviewer-*.txt -Wait
```

## Common Commands

```bash
# Build everything
dotnet build

# Clean build outputs
dotnet clean

# Run specific project
dotnet run --project VideoViewer.Web

# Build release version
dotnet build --configuration Release

# Publish for deployment
dotnet publish -c Release -o ./publish
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS error in React | Ensure backend runs on http://localhost:5000 |
| "Cannot find module" | Run `npm install` in `ClientApp` folder |
| Videos won't play | Check file format is in `SupportedMediaTypes` |
| 404 on API call | Verify backend is running and endpoint exists |
| Port already in use | Kill process: `lsof -i :5000` (Mac/Linux) or use netstat (Windows) |

## Project Structure Reference

```
VideoViewer/
├── VideoViewer.sln              # Open in Visual Studio/VS Code
├── README.md                    # Full documentation
├── .github/
│   └── copilot-instructions.md # AI agent guide (THIS FILE!)
├── VideoViewer.Web/             # Web API + React frontend
│   ├── Controllers/             # API endpoints
│   ├── Program.cs               # Startup configuration
│   ├── ClientApp/               # React application
│   │   ├── src/
│   │   │   ├── components/      # React components
│   │   │   ├── store/           # Zustand state management
│   │   │   ├── api/             # API client utilities
│   │   │   └── App.tsx
│   │   └── package.json
│   └── appsettings.json         # Configuration
├── VideoViewer.Core/            # Shared business logic
│   ├── Models/                  # Data models
│   └── Services/                # Business services
└── VideoViewer.Tests/           # Unit tests
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `VideoViewer.Web/Program.cs` | Dependency injection, middleware setup |
| `VideoViewer.Core/Services/FileSystemService.cs` | Folder scanning logic |
| `VideoViewer.Core/Services/MediaService.cs` | Video streaming logic |
| `VideoViewer.Web/ClientApp/src/store/mediaStore.ts` | React state |
| `VideoViewer.Web/ClientApp/src/App.tsx` | Main React component |
| `.github/copilot-instructions.md` | This AI guide |

## Environment Variables

None required by default. All config is in `appsettings.json`.

For Docker: Set `ASPNETCORE_ENVIRONMENT=Production` before running.

---

**For detailed architecture and patterns, see `.github/copilot-instructions.md`**
