import React, { useEffect, useRef, useState } from 'react';
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
  const videoRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowRight':
          onNext();
          break;
        case 'ArrowLeft':
          onPrevious();
          break;
        case 'Escape':
          onClose();
          break;
        case 'Space':
          togglePlay();
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

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    video.paused ? video.play() : video.pause();
  };
  const [showControls, setShowControls] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const lastTapRef = useRef(0);

  const handleTouch = () => {
    togglePlay();
    // const now = Date.now();
    // const DOUBLE_TAP_DELAY = 300; // ms
    // if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
    //   // Double tap detected
    //   setShowControls((prev) => !prev);
    // }
    // lastTapRef.current = now;
  };

  const [btnState, setBtnState] = useState(0); // 0, 1, 2

  const nextBtnState = () => {
    setBtnState((prev) => (prev + 1) % 3);
  };

  const onFullscreen = () => {
    const video = videoRef.current;

    if (!video) return;

    // Safari
    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    } 
    // Standard fullscreen API
    else if (video.requestFullscreen) {
      video.requestFullscreen();
    } 
    // IE11
    else if (video.msRequestFullscreen) {
      video.msRequestFullscreen();
    }  
  };
  return (
    <div
      className="media-viewer fullscreen"
      ref={containerRef}
      // onDoubleClick={onClose}
      // onTouchStart={handleSwipe} 
    >
      <div className="media-container">
        {isVideo && (
          <video
            ref={videoRef}
            src={mediaUrl}
            autoPlay
            playsInline
            preload="metadata"
            loop={btnState === 0}

            // iOS specific attribute to avoid native fullscreen
            webkit-playsinline="true"
            className="media-element"
            onMouseEnter={() => setShowControls(true)}   // desktop hover
            onMouseLeave={() => setShowControls(false)}
            onTouchEnd={handleTouch} 
            onLoadedMetadata={(e) =>
              setDuration(e.currentTarget.duration)
            }
            onTimeUpdate={(e) =>
              setCurrent(e.currentTarget.currentTime)
            }
            onEnded={() => {
              if (btnState === 1) {
                onNext();
              }
            }}
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
        <button
          className="control-btn next-btn"
          onClick={onNext}
          aria-label="Next media"
        >
          →
        </button>
        <button
          className="control-btn"
          onClick={onFullscreen}
          aria-label="Fullscreen"
        >
          ⛶
        </button>
        <button
          className="control-btn"
          onClick={nextBtnState}>
          {btnState === 0 && "↻"}
          {btnState === 1 && "⏭"}
          {btnState === 2 && "⏹"}
        </button>
        <button
          className="control-btn"
          onClick={onClose}
          aria-label="Close viewer"
        >
          ×
        </button>

        <div className="media-info">
          <h2>{item.name}</h2>
          <p>{item.mediaType}</p>
          <p>{formatTime(current)} / {formatTime(duration)}</p>
        </div>

        <a
          href={mediaUrl}
          download={item.name}
          className="control-btn next-btn"
          aria-label="Download video"
        >
          ↓
        </a>
      </div>
    </div>
  );
};
