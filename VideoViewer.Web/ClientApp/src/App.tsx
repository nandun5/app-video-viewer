import React, { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useLocation, useNavigate } from 'react-router-dom';
import { DirectoryBrowser } from './components/DirectoryBrowser';
import { Breadcrumb } from './components/Breadcrumb';
import { MediaViewer } from './components/MediaViewer';
import { DirectoryContent, FileSystemItem } from './store/mediaStore';
import { fileSystemApi, setPinPromptHandler } from './api/mediaApi';
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
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinPromptResolver = useRef<((pin: string) => void) | null>(null);

  const currentDirectory = browserStack[browserStack.length - 1]?.directory ?? null;
  const currentFolderPath = browserStack[browserStack.length - 1]?.browserPath ?? '';
  const [currentSortedMediaItems, setCurrentSortedMediaItems] = useState<FileSystemItem[]>([]);

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

  const fetchDirectory = React.useCallback(async (path: string) => {
    return await fileSystemApi.getDirectory(path || undefined);
  }, []);

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
    setPinPromptHandler(async (errorMessage) => {
      return new Promise<string>((resolve) => {
        pinPromptResolver.current = resolve;
        setPinError(errorMessage ?? null);
        setPinEntry('');
        setPinDialogOpen(true);
      });
    });

    return () => {
      setPinPromptHandler(null);
    };
  }, []);

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

  useEffect(() => {
    if (!initialized || browserStack.length === 0) {
      return;
    }

    const currentFolderPath = browserStack[browserStack.length - 1].browserPath;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/directory')
      .withAutomaticReconnect()
      .build();

    let mounted = true;

    const start = async () => {
      try {
        await connection.start();
        connection.on('DirectoryChanged', async (relativePath: string) => {
          // Only refresh if change is relevant to the currently visible folder
          if (!mounted) return;

          try {
            const result = await fetchDirectory(currentFolderPath);
            if (result?.type === 'directory') {
              setBrowserStack((stack) => {
                if (stack.length === 0) return stack;
                const lastEntry = stack[stack.length - 1];
                if (lastEntry.browserPath !== currentFolderPath) return stack;
                return [
                  ...stack.slice(0, stack.length - 1),
                  {
                    ...lastEntry,
                    directory: result.data,
                  },
                ];
              });
            }
          } catch (err) {
            console.debug('Directory refresh (SignalR) failed:', err);
          }
        });
      } catch (err) {
        console.debug('SignalR connection failed:', err);
      }
    };

    start();

    return () => {
      mounted = false;
      connection.stop().catch(() => {});
    };
  }, [initialized, browserStack, fetchDirectory]);

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

  const handlePinDigit = (digit: string) => {
    if (pinEntry.length >= 6) return;

    setPinEntry((prev) => {
      const nextPin = prev + digit;
      if (nextPin.length === 6) {
        setPinDialogOpen(false);
        pinPromptResolver.current?.(nextPin);
        pinPromptResolver.current = null;
      }
      return nextPin;
    });
  };

  const handlePinDelete = () => {
    setPinEntry((prev) => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPinEntry('');
    setPinError(null);
  };

  const handlePinCancel = () => {
    setPinDialogOpen(false);
    setPinError(null);
    pinPromptResolver.current?.('');
    pinPromptResolver.current = null;
  };

  const handleNextMedia = () => {
    if (!currentMediaItem) {
      return;
    }

    const mediaFiles = currentSortedMediaItems.length
      ? currentSortedMediaItems
      : currentDirectory?.items.filter((item) => !item.isDirectory) ?? [];

    const index = mediaFiles.findIndex((item) => item.path === currentMediaItem.path);
    if (index >= 0 && index < mediaFiles.length - 1) {
      setCurrentMediaItem(mediaFiles[index + 1]);
    }
  };

  const handlePreviousMedia = () => {
    if (!currentMediaItem) {
      return;
    }

    const mediaFiles = currentSortedMediaItems.length
      ? currentSortedMediaItems
      : currentDirectory?.items.filter((item) => !item.isDirectory) ?? [];

    const index = mediaFiles.findIndex((item) => item.path === currentMediaItem.path);
    if (index > 0) {
      setCurrentMediaItem(mediaFiles[index - 1]);
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
              onSortedMediaChange={setCurrentSortedMediaItems}
            />
          </div>
        ))}
      </div>

      {browserStack.length === 0 && isLoading && (
        <div className="app-fallback">
          <div className="app-fallback-message">Loading...</div>
        </div>
      )}

      {browserStack.length === 0 && !isLoading && error && (
        <div className="app-fallback">
          <div className="app-fallback-message">Error: {error}</div>
        </div>
      )}

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

      {pinDialogOpen && (
        <div className="pin-dialog-overlay">
          <div className="pin-dialog">
            <h2>Enter 6-digit PIN</h2>
            <div className="pin-display">{pinEntry.padEnd(6, '•')}</div>
            {pinError && <div className="pin-error">{pinError}</div>}

            <div className="pin-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button key={digit} onClick={() => handlePinDigit(digit.toString())}>
                  {digit}
                </button>
              ))}
              <button className="pin-action" onClick={handlePinDelete}>
                Del
              </button>
              <button onClick={() => handlePinDigit('0')}>0</button>
              <button className="pin-action" onClick={handlePinClear}>
                Clear
              </button>
            </div>

            <div className="pin-actions">
              <button className="pin-cancel" onClick={handlePinCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
