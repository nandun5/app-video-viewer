import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DirectoryBrowser } from './components/DirectoryBrowser';
import { MediaViewer } from './components/MediaViewer';
import { useMediaViewerStore, FileSystemItem } from './store/mediaStore';
import { fileSystemApi } from './api/mediaApi';
import './App.css';

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentPath,
    currentDirectory,
    currentMediaItem,
    isLoading,
    error,
    setCurrentPath,
    setCurrentDirectory,
    setCurrentMediaItem,
    setIsLoading,
    setError,
    goToNextMedia,
    goToPreviousMedia,
  } = useMediaViewerStore();

  // Initialize from URL on mount - extract folder and optional media file
  useEffect(() => {
    const pathFromUrl = location.pathname === '/' ? '' : location.pathname.slice(1);
    
    // Split path into folder and potential media file
    const lastSlashIndex = pathFromUrl.lastIndexOf('/');
    let folderPath = pathFromUrl;
    let potentialMediaFile = '';
    
    if (lastSlashIndex !== -1) {
      folderPath = pathFromUrl.substring(0, lastSlashIndex);
      potentialMediaFile = pathFromUrl.substring(lastSlashIndex + 1);
    } else if (pathFromUrl && pathFromUrl.includes('.')) {
      // Single segment with extension - treat as media file in root
      potentialMediaFile = pathFromUrl;
      folderPath = '';
    }
    
    // Set the folder path (not the media file)
    setCurrentPath(folderPath);
  }, []);

  // After directory loads, check if URL path includes a media file
  useEffect(() => {
    if (currentDirectory && currentDirectory.items.length > 0) {
      let pathFromUrl = location.pathname === '/' ? '' : location.pathname.slice(1);
      
      // Get the last segment of the path
      const lastSlashIndex = pathFromUrl.lastIndexOf('/');
      const potentialFileName = lastSlashIndex === -1 ? pathFromUrl : pathFromUrl.substring(lastSlashIndex + 1);
      const folderPath = lastSlashIndex === -1 ? '' : pathFromUrl.substring(0, lastSlashIndex);
      
      // Check if the last segment matches a media file in the current directory
      if (potentialFileName) {
        const mediaItem = currentDirectory.items.find(
          item => item.name === decodeURIComponent(potentialFileName) && !item.isDirectory
        );
        
        if (mediaItem && folderPath === currentPath) {
          // Fetch full file metadata via API to get all links (parent, previous, next, etc.)
          loadFileMetadata(pathFromUrl);
          return;
        }
      }
      
      // If we got here and currently have a media item but path changed, clear it
      if (currentMediaItem && !pathFromUrl.endsWith(currentMediaItem.name)) {
        setCurrentMediaItem(null);
      }
    }
  }, [currentDirectory, location.pathname]);

  // Sync URL pathname when current path changes
  useEffect(() => {
    const newPath = currentPath ? `/${currentPath}` : '/';
    if (location.pathname !== newPath && !currentMediaItem) {
      console.log('Updating URL to media path from #2');
      navigate(newPath, { replace: true });
    }
  }, [currentPath]);

  // Sync URL path when media item changes (include media file in path)
  useEffect(() => {
    if (currentMediaItem) {
      console.log(currentMediaItem);
      const folderPath = currentPath ? `/${currentPath}` : '';
      const mediaPath = `${folderPath}/${encodeURIComponent(currentMediaItem.name)}`;
      console.log('Navigating to media path:', mediaPath);
      console.log('Current pathname:', location.pathname);
      if (location.pathname?.trim() !== mediaPath?.trim()) {
        console.log('Updating URL to media path from #1');
        navigate(mediaPath, { replace: true });
      }
    }
  }, [currentMediaItem]);

  // Load directory when path changes
  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fileSystemApi.getDirectory(path);
      if (!result) {
        if (path) {
          setCurrentPath('');
          console.log('Directory not found, going to root');
          navigate('/', { replace: true });
        }
      } else if (result.type === 'directory') {
        setCurrentDirectory(result.data);
        setCurrentMediaItem(null);
      } else {
        // Server returned file metadata for the requested path.
        const file = result.data;
        // Load parent directory so UI can show the containing folder
        const lastSlash = file.path ? file.path.lastIndexOf('/') : -1;
        const parent = lastSlash >= 0 ? file.path.substring(0, lastSlash) : '';
        const parentResult = await fileSystemApi.getDirectory(parent || undefined);
        if (parentResult && parentResult.type === 'directory') {
          setCurrentDirectory(parentResult.data);
        } else {
          setCurrentDirectory(null);
        }
        setCurrentMediaItem(file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
      setCurrentDirectory(null);
      // On error, try to go to root if we were in a subfolder
      if (path) {
        setCurrentPath('');
        console.log('Error loading directory, going to root');
        navigate('/', { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadFileMetadata = async (filePath: string) => {
    try {
      const result = await fileSystemApi.getDirectory(filePath);
      if (result && result.type === 'file') {
        setCurrentMediaItem(result.data);
      }
    } catch (err) {
      console.error('Error loading file metadata:', err);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentMediaItem(null);
    setCurrentPath(path);
  };

  const handleSelectMedia = (item: FileSystemItem) => {
    setCurrentMediaItem(item);
  };

  const handleGoBack = () => {
    if (currentMediaItem) {
      setCurrentMediaItem(null);
    } else if (currentPath) {
      const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '';
      handleNavigate(parentPath);
    }
  };

  // Navigate to a file link returned by the API (e.g. "/api/filesystem/path%2Fto%2Ffile.mp4")
  function navigateToFileLink(apiLink: string) {
    console.log('Navigating to file link:', apiLink);
    const prefix = '/api/filesystem/';
    let encoded = apiLink;
    if (apiLink.startsWith(prefix)) {
      encoded = apiLink.substring(prefix.length);
    }
    const decoded = decodeURIComponent(encoded);
    const segments = decoded.split('/').map(s => encodeURIComponent(s)).join('/');
    // Navigate to client route which will trigger loading and opening the file
    console.log('Updating URL to media path from #3');
    navigate(`/${segments}`);
  }

  return (
    <div className="app-container">
      {currentMediaItem && (
        <MediaViewer
          item={currentMediaItem}
          onNext={() => {
            const nextLink = currentMediaItem?.links?.next;
            if (nextLink) {
              navigateToFileLink(nextLink);
            } else {
              goToNextMedia();
            }
          }}
          onPrevious={() => {
            const prevLink = currentMediaItem?.links?.previous;
            if (prevLink) {
              navigateToFileLink(prevLink);
            } else {
              goToPreviousMedia();
            }
          }}
          onClose={() => {
            // If API provided a parent link, navigate to it; otherwise just close viewer
            const parentLink = currentMediaItem?.links?.parent;
            if (parentLink) {
              // parentLink is like /api/filesystem/{encodedPath}
              const prefix = '/api/filesystem/';
              if (parentLink.startsWith(prefix)) {
                const encoded = parentLink.substring(prefix.length);
                const decoded = decodeURIComponent(encoded);
                setCurrentMediaItem(null);
                setCurrentPath(decoded);
                return;
              }
            }
            setCurrentMediaItem(null);
          }}
        />
      )}
      {!currentMediaItem && (
        <DirectoryBrowser
          directory={currentDirectory}
          isLoading={isLoading}
          error={error}
          onNavigate={handleNavigate}
          onSelectMedia={handleSelectMedia}
          onGoBack={handleGoBack}
        />
      )}
    </div>
  );
}

export default App;
