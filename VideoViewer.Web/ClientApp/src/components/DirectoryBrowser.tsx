import React from 'react';
import './styles.css';
import { DirectoryContent, FileSystemItem } from '../store/mediaStore';

interface DirectoryBrowserProps {
  directory: DirectoryContent | null;
  isLoading: boolean;
  error: string | null;
  onNavigate: (path: string) => void;
  onSelectMedia: (item: FileSystemItem) => void;
  onGoBack: () => void;
}

export const DirectoryBrowser: React.FC<DirectoryBrowserProps> = ({
  directory,
  isLoading,
  error,
  onNavigate,
  onSelectMedia,
  onGoBack,
}) => {
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

  const handleBackClick = () => {
    if (directory.path) {
      const parentPath = directory.path.substring(0, directory.path.lastIndexOf('/')) || '';
      onGoBack();
    }
  };

  return (
    <div className="directory-browser">
      <div className="page-header">
        <h1 className="page-title">Video Viewer</h1>
        {directory.path === '' ? (
          <div className="root-name">Root: {directory.name}</div>
        ) : (
          <div className="root-name">Root: {directory.name && directory.name}</div>
        )}
      </div>
      <div className="breadcrumb">
        {/* Breadcrumb: split path into segments and allow navigation */}
        <button onClick={() => onNavigate('')} className="breadcrumb-item">
          Root
        </button>
        {directory.path && directory.path.length > 0 && (
          directory.path.replace(/\\/g, '/').split('/').map((seg, idx, arr) => {
            const cumulative = arr.slice(0, idx + 1).join('/');
            return (
              <React.Fragment key={idx}>
                <span className="breadcrumb-separator">/</span>
                <button onClick={() => onNavigate(cumulative)} className="breadcrumb-item">{seg}</button>
              </React.Fragment>
            );
          })
        )}
      </div>

      <div className="items-grid">
        {directory.items && directory.items.length > 0 ? (
          directory.items.map((item) => (
            <div
              key={item.path}
              className={`item-card ${item.isDirectory ? 'folder' : 'media'}`}
              onClick={() => {
                if (item.isDirectory) {
                  onNavigate(item.path);
                } else {
                  onSelectMedia(item);
                }
              }}
            >
              <div className="item-icon">
                {item.isDirectory ? (
                  <FolderIcon />
                ) : item.mediaType?.startsWith('video/') ? (
                  <VideoIcon />
                ) : item.mediaType?.startsWith('image/') ? (
                  <ImageIcon />
                ) : (
                  <FileIcon />
                )}
              </div>
              <div className="item-name">{item.name}</div>
              {item.size && (
                <div className="item-size">{formatFileSize(item.size)}</div>
              )}
            </div>
          ))
        ) : (
          <div className="no-items">No items in this directory</div>
        )}
      </div>
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
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
