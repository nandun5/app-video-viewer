import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DirectoryBrowser } from './components/DirectoryBrowser';
import { Breadcrumb } from './components/Breadcrumb';
import { MediaViewer } from './components/MediaViewer';
import { DirectoryContent, FileSystemItem } from './store/mediaStore';
import { fileSystemApi } from './api/mediaApi';
import './App.css';

type BrowserStackEntry = {
  directory: DirectoryContent;
  browserPath: string;
  savedScrollTop: number;
  selectedItemPath: string | null;
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [browserStack, setBrowserStack] = useState<BrowserStackEntry[]>([]);
  const [currentMediaItem, setCurrentMediaItem] = useState<FileSystemItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const currentDirectory = browserStack[browserStack.length - 1]?.directory ?? null;
  const currentFolderPath = browserStack[browserStack.length - 1]?.browserPath ?? '';

  const normalizePath = (path: string) =>
    path.replace(/\\/g, '/').replace(/^\/+/g, '').replace(/\/+$/g, '');

  const decodePath = (path: string) => decodeURIComponent(normalizePath(path));

  const encodePath = (path: string) =>
    normalizePath(path)
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');

  const getPathSegments = (path: string) =>
    normalizePath(path)
      .split('/')
      .filter(Boolean);

  const fetchDirectory = async (path: string) => {
    return await fileSystemApi.getDirectory(path || undefined);
  };

  const loadDirectoryStack = async (folderPath: string) => {
    const rootResult = await fetchDirectory('');
    if (!rootResult || rootResult.type !== 'directory') {
      throw new Error('Root directory could not be loaded');
    }

    const rootEntry: BrowserStackEntry = {
      directory: rootResult.data,
      browserPath: '',
      savedScrollTop: 0,
      selectedItemPath: null,
    };

    const stack: BrowserStackEntry[] = [rootEntry];
    let currentPath = '';

    for (const segment of getPathSegments(folderPath)) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const directoryResult = await fetchDirectory(currentPath);
      if (!directoryResult || directoryResult.type !== 'directory') {
        throw new Error(`Directory not found: ${currentPath}`);
      }
      stack.push({
        directory: directoryResult.data,
        browserPath: normalizePath(directoryResult.data.path),
        savedScrollTop: 0,
        selectedItemPath: null,
      });
    }

    return stack;
  };

  const loadInitialStack = async () => {
    const rawPath = location.pathname === '/' ? '' : location.pathname.slice(1);
    const decodedPath = decodePath(rawPath);

    setIsLoading(true);
    setError(null);

    try {
      if (!decodedPath) {
        const stack = await loadDirectoryStack('');
        setBrowserStack(stack);
        return;
      }

      const initialResult = await fetchDirectory(decodedPath);
      if (!initialResult) {
        throw new Error('Initial path could not be loaded');
      }

      if (initialResult.type === 'file') {
        const parentPath = decodedPath.substring(0, decodedPath.lastIndexOf('/')) || '';
        const stack = await loadDirectoryStack(parentPath);
        setBrowserStack(stack);
        setCurrentMediaItem(initialResult.data);
      } else {
        const stack = await loadDirectoryStack(decodedPath);
        setBrowserStack(stack);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load initial path');
      setBrowserStack([]);
      setCurrentMediaItem(null);
    } finally {
      setIsLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    loadInitialStack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildLocationPath = () => {
    if (currentMediaItem) {
      const prefix = currentFolderPath ? `/${encodePath(currentFolderPath)}` : '';
      return `${prefix}/${encodeURIComponent(currentMediaItem.name)}`;
    }

    return currentFolderPath ? `/${encodePath(currentFolderPath)}` : '/';
  };

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const targetPath = buildLocationPath();
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserStack, currentMediaItem, initialized]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const targetPath = buildLocationPath();
    if (location.pathname !== targetPath) {
      loadInitialStack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const openDirectory = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchDirectory(normalizePath(path));
      if (!result || result.type !== 'directory') {
        throw new Error('Directory not found');
      }
      setBrowserStack((stack) => [
        ...stack,
        {
          directory: result.data,
          browserPath: normalizePath(result.data.path),
          savedScrollTop: 0,
          selectedItemPath: null,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open directory');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToStackPath = async (path: string) => {
    const normalizedPath = normalizePath(path);
    const existingIndex = browserStack.findIndex(
      (entry) => entry.browserPath === normalizedPath
    );

    if (existingIndex !== -1) {
      setBrowserStack((stack) => stack.slice(0, existingIndex + 1));
      return;
    }

    await openDirectory(normalizedPath);
  };

  const openFileFromApiPath = async (decodedFilePath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const normalizedFilePath = normalizePath(decodedFilePath);
      const parentPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/')) || '';
      await navigateToStackPath(parentPath);

      const result = await fetchDirectory(normalizedFilePath);
      if (!result || result.type !== 'file') {
        throw new Error('File not found');
      }
      setCurrentMediaItem(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open media item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = async (
    path: string,
    sourceBrowserPath: string,
    selectedChildPath: string | null,
    scrollTop: number
  ) => {
    const normalizedPath = normalizePath(path);
    const normalizedSource = normalizePath(sourceBrowserPath);

    setBrowserStack((stack) =>
      stack.map((entry) =>
        entry.browserPath === normalizedSource
          ? {
              ...entry,
              savedScrollTop: scrollTop,
              selectedItemPath: selectedChildPath,
            }
          : entry
      )
    );

    if (normalizedPath === normalizePath(currentFolderPath)) {
      return;
    }

    await navigateToStackPath(normalizedPath);
  };

  const handleSelectMedia = (
    item: FileSystemItem,
    sourceBrowserPath: string,
    scrollTop: number
  ) => {
    setBrowserStack((stack) =>
      stack.map((entry) =>
        entry.browserPath === normalizePath(sourceBrowserPath)
          ? {
              ...entry,
              savedScrollTop: scrollTop,
              selectedItemPath: item.path,
            }
          : entry
      )
    );
    setCurrentMediaItem(item);
  };

  const handleBreadcrumbNavigate = async (path: string) => {
    await navigateToStackPath(path);
    setCurrentMediaItem(null);
  };

  const handleCloseMedia = () => {
    setCurrentMediaItem(null);
  };

  const handleNextMedia = async () => {
    if (!currentMediaItem) {
      return;
    }

    const nextLink = currentMediaItem.links?.next;
    if (nextLink) {
      await navigateToFileLink(nextLink);
      return;
    }

    if (currentDirectory) {
      const mediaFiles = currentDirectory.items.filter((item) => !item.isDirectory);
      const index = mediaFiles.findIndex((item) => item.path === currentMediaItem.path);
      if (index >= 0 && index < mediaFiles.length - 1) {
        setCurrentMediaItem(mediaFiles[index + 1]);
      }
    }
  };

  const handlePreviousMedia = async () => {
    if (!currentMediaItem) {
      return;
    }

    const prevLink = currentMediaItem.links?.previous;
    if (prevLink) {
      await navigateToFileLink(prevLink);
      return;
    }

    if (currentDirectory) {
      const mediaFiles = currentDirectory.items.filter((item) => !item.isDirectory);
      const index = mediaFiles.findIndex((item) => item.path === currentMediaItem.path);
      if (index > 0) {
        setCurrentMediaItem(mediaFiles[index - 1]);
      }
    }
  };

  const navigateToFileLink = async (apiLink: string) => {
    const prefix = '/api/filesystem/';
    const encoded = apiLink.startsWith(prefix) ? apiLink.substring(prefix.length) : apiLink;
    const decoded = decodeURIComponent(encoded);
    await openFileFromApiPath(decoded);
  };

  return (
    <div className="app-container">
      <div className="browser-stack">
        {browserStack.map((entry, index) => (
          <div
            key={entry.browserPath || 'root'}
            className="directory-browser-layer"
            style={{ zIndex: index }}
          >
            <DirectoryBrowser
              directory={entry.directory}
              browserPath={entry.browserPath}
              initialScrollTop={entry.savedScrollTop}
              initialSelectedItemPath={entry.selectedItemPath}
              isLoading={isLoading && index === browserStack.length - 1}
              error={index === browserStack.length - 1 ? error : null}
              onNavigate={handleNavigate}
              onSelectMedia={handleSelectMedia}
            />
          </div>
        ))}
      </div>

      {!currentMediaItem && browserStack.length > 0 && (
        <Breadcrumb
          stack={browserStack.map((entry) => ({
            browserPath: entry.browserPath,
            name: entry.directory.name,
          }))}
          onNavigate={handleBreadcrumbNavigate}
        />
      )}

      {currentMediaItem && (
        <MediaViewer
          item={currentMediaItem}
          onNext={handleNextMedia}
          onPrevious={handlePreviousMedia}
          onClose={handleCloseMedia}
        />
      )}
    </div>
  );
}

export default App;
