import React, { useEffect, useRef } from 'react';
import './styles.css';
import { FileSystemItem } from '../store/mediaStore';
import { mediaApi } from '../api/mediaApi';

interface MediaViewerProps {
  item: FileSystemItem;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  item,
  onNext,
  onPrevious,
  onClose,
}) => {
  const isVideo = item.mediaType?.startsWith('video/');
  const isImage = item.mediaType?.startsWith('image/');
  const mediaUrl = item.links?.stream || mediaApi.getMediaUrl(item.path);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          onNext();
          break;
        case 'ArrowLeft':
          onPrevious();
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrevious, onClose]);

  const handleSwipe = (e: React.TouchEvent) => {
    if (!containerRef.current) return;

    const touch = e.touches[0];
    const startX = touch.clientX;

    const handleTouchEnd = (endE: TouchEvent) => {
      const endTouch = endE.changedTouches[0];
      const endX = endTouch.clientX;
      const diff = startX - endX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          onNext();
        } else {
          onPrevious();
        }
      }

      containerRef.current?.removeEventListener('touchend', handleTouchEnd);
    };

    containerRef.current?.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div
      className="media-viewer fullscreen"
      ref={containerRef}
      onTouchStart={handleSwipe}
    >
      <div className="media-container">
        {isVideo && (
          <video
            src={mediaUrl}
            autoPlay
            controls
            playsInline
            // iOS specific attribute to avoid native fullscreen
            webkit-playsinline="true"
            className="media-element"
          />
        )}
        {isImage && (
          <img src={mediaUrl} alt={item.name} className="media-element" />
        )}
      </div>

      <div className="media-controls">
        <button
          className="control-btn prev-btn"
          onClick={onPrevious}
          aria-label="Previous media"
        >
          ←
        </button>

        <div className="media-info">
          <h2>{item.name}</h2>
          <p>{item.mediaType}</p>
        </div>

        <button
          className="control-btn next-btn"
          onClick={onNext}
          aria-label="Next media"
        >
          →
        </button>
      </div>

      <button
        className="control-btn close-btn"
        onClick={onClose}
        aria-label="Close viewer"
      >
        ×
      </button>
    </div>
  );
};
