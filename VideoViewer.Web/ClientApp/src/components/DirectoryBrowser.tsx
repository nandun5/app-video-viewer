import React, { useEffect, useRef, useState } from 'react';

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
  const itemsGridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedItemPath(initialSelectedItemPath);
    if (itemsGridRef.current) {
      itemsGridRef.current.scrollTop = initialScrollTop;
    }
  }, [directory?.path, initialScrollTop, initialSelectedItemPath]);

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
        {directory.path === '' ? (
          <div className="root-name">Root: {directory.name}</div>
        ) : (
          <div className="root-name">Root: {directory.name}</div>
        )}
      </div>

      <div className="items-grid" ref={itemsGridRef}>
        {directory.items && directory.items.length > 0 ? (
          directory.items.map((item) => (
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
          ) : item.mediaType?.startsWith('video/') ? (
            item.links?.thumbnail ? (
              <img
                src={item.links.thumbnail}
                loading="lazy"
                alt={item.name}
                className="video-thumbnail"
              />
            ) : (
              <VideoIcon />
            )
          ) : item.mediaType?.startsWith('image/') ? (
            <ImageIcon />
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