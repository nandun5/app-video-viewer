import React, { useEffect, useRef, useState, useMemo } from 'react';

import './styles.css';
import { DirectoryContent, FileSystemItem } from '../store/mediaStore';

interface DirectoryBrowserProps {
  directory: DirectoryContent | null;
  browserPath: string;
  initialScrollTop: number;
  initialSelectedItemPath: string | null;
  isLoading: boolean;
  error: string | null;
  onNavigate: (
    path: string,
    sourceBrowserPath: string,
    selectedChildPath: string | null,
    scrollTop: number
  ) => void;
  onSelectMedia: (
    item: FileSystemItem,
    sourceBrowserPath: string,
    scrollTop: number
  ) => void;
}

export const DirectoryBrowser: React.FC<DirectoryBrowserProps> = ({
  directory,
  browserPath,
  initialScrollTop,
  initialSelectedItemPath,
  isLoading,
  error,
  onNavigate,
  onSelectMedia,
}) => {
  const [selectedItemPath, setSelectedItemPath] = useState<string | null>(initialSelectedItemPath);
  const [sortType, setSortType] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 3; // default to date descending
    }

    try {
      const saved = window.localStorage.getItem(`video-viewer-sort:${browserPath || 'root'}`);
      const parsed = saved ? parseInt(saved, 10) : NaN;
      return Number.isInteger(parsed) ? parsed : 3;
    } catch {
      return 3;
    }
  });
  const itemsGridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedItemPath(initialSelectedItemPath);
    if (itemsGridRef.current) {
      itemsGridRef.current.scrollTop = initialScrollTop;
    }
  }, [directory?.path, initialScrollTop, initialSelectedItemPath]);

  useEffect(() => {
    if (!directory) {
      return;
    }

    try {
      const saved = window.localStorage.getItem(`video-viewer-sort:${browserPath || 'root'}`);
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 3) {
        setSortType(parsed);
      } else {
        setSortType(3);
      }
    } catch {
      setSortType(3);
    }
  }, [browserPath, directory]);

  useEffect(() => {
    if (!directory) {
      return;
    }

    try {
      window.localStorage.setItem(`video-viewer-sort:${browserPath || 'root'}`, sortType.toString());
    } catch {
      // ignore storage errors
    }
  }, [browserPath, directory, sortType]);

  const sortedItems = useMemo(() => {
    if (!directory?.items) return [];
    
    return [...directory.items].sort((a, b) => {
      // Directories always come first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      switch (sortType) {
        case 0: // Name ascending
          return a.name.localeCompare(b.name);
        case 1: // Name descending
          return b.name.localeCompare(a.name);
        case 2: // Date ascending
          return new Date(a.modified).getTime() - new Date(b.modified).getTime();
        case 3: // Date descending
          return new Date(b.modified).getTime() - new Date(a.modified).getTime();
        default:
          return 0;
      }
    });
  }, [directory?.items, sortType]);

  const handleSortToggle = () => {
    setSortType((prev) => (prev + 1) % 4);
  };

  if (isLoading) {
    return (
      <div className="directory-browser">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="directory-browser">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  if (!directory) {
    return <div className="directory-browser">No directory selected</div>;
  }

  return (
    <div className="directory-browser">
      <div className="page-header">
        <h1 className="page-title">Video Viewer</h1>
        <button className="sort-button" onClick={handleSortToggle} title="Toggle sort order">
          <SortIcon sortType={sortType} />
        </button>
        {directory.path === '' ? (
          <div className="root-name">Root: {directory.name}</div>
        ) : (
          <div className="root-name">Root: {directory.name}</div>
        )}
      </div>

      <div className="items-grid" ref={itemsGridRef}>
        {sortedItems && sortedItems.length > 0 ? (
          sortedItems.map((item) => (
            <div
              key={item.path}
              className={`item-card ${item.isDirectory ? 'folder' : 'media'} ${
                item.path === selectedItemPath ? 'selected' : ''
              }`}
              onClick={() => {
                const scrollTop = itemsGridRef.current?.scrollTop ?? 0;
                setSelectedItemPath(item.path);
                if (item.isDirectory) {
                  onNavigate(item.path, browserPath, item.path, scrollTop);
                } else {
                  onSelectMedia(item, browserPath, scrollTop);
                }
              }}
            >
              <ItemIcon item={item} />

              <div className="item-name">{item.name}</div>

              {item.size && <div className="item-size">{formatFileSize(item.size)}</div>}
            </div>
          ))
        ) : (
          <div className="no-items">No items in this directory</div>
        )}
      </div>
    </div>
  );
};

const ItemIcon: React.FC<{ item: FileSystemItem }> = ({ item }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // stop observing once visible
        }
      },
      {
        // threshold: 0.1,
        // rootMargin: '150px', // preload before visible
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="item-icon">
      {isVisible && (
        <>
          {item.isDirectory ? (
            <FolderIcon />
          ) : item.mediaType?.startsWith('video/') || item.mediaType?.startsWith('image/') ? (
            item.links?.thumbnail ? (
              <img
                src={item.links.thumbnail}
                loading="lazy"
                alt={item.name}
                className={item.mediaType?.startsWith('video/') ? "video-thumbnail" : "image-thumbnail"}
              />
            ) : item.mediaType?.startsWith('video/') ? (
              <VideoIcon />
            ) : (
              <ImageIcon />
            )
          ) : (
            <FileIcon />
          )}
        </>
      )}
    </div>
  );
};

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 4l2 4h-3l2-4M17 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5M3 5v14h18V5H3m6 9l5-3.5L17 14V7l-5 3.5L9 7v7z" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
  </svg>
);

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2v16c0 1.1.89 2 1.99 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 16H7v-2h6v2zm3-4H7v-2h9v2z" />
  </svg>
);

const SortIcon: React.FC<{ sortType: number }> = ({ sortType }) => {
  const getSortLabel = () => {
    switch (sortType) {
      case 0: return 'Name ↑';
      case 1: return 'Name ↓';
      case 2: return 'Date ↑';
      case 3: return 'Date ↓';
      default: return 'Sort';
    }
  };

  return (
    <div className="sort-icon">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
      </svg>
      <span className="sort-label">{getSortLabel()}</span>
    </div>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
    ' ' +
    sizes[i]
  );
}