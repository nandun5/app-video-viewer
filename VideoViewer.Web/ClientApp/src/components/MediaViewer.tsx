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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const panStartRef = useRef({ pointerId: 0, startX: 0, startY: 0, originX: 0, originY: 0 });

  const [zoomScale, setZoomScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    setZoomScale(1);
    setPanX(0);
    setPanY(0);
    setIsZoomed(false);
    setIsPanning(false);
  }, [item]);

  const getZoomScale = () => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return 1;

    const containerRect = container.getBoundingClientRect();
    const imageWidth = img.clientWidth;
    const imageHeight = img.clientHeight;
    if (imageWidth === 0 || imageHeight === 0) return 1;

    const isLandscape = imageWidth >= imageHeight;
    const scale = isLandscape
      ? containerRect.height / imageHeight
      : containerRect.width / imageWidth;

    return Math.max(1, Number(scale.toFixed(2)));
  };

  const resetZoom = () => {
    setZoomScale(1);
    setPanX(0);
    setPanY(0);
    setIsZoomed(false);
  };

  const clampPan = (x: number, y: number) => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return { x, y };

    const maxX = Math.max(0, (img.clientWidth * zoomScale - container.clientWidth) / 2);
    const maxY = Math.max(0, (img.clientHeight * zoomScale - container.clientHeight) / 2);

    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY),
    };
  };

  const handleImagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isZoomed) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: panX,
      originY: panY,
    };
  };

  const handleImagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || panStartRef.current.pointerId !== e.pointerId) return;

    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    const nextX = panStartRef.current.originX + dx;
    const nextY = panStartRef.current.originY + dy;
    const clamped = clampPan(nextX, nextY);

    setPanX(clamped.x);
    setPanY(clamped.y);
  };

  const handleImagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current.pointerId !== e.pointerId) return;
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleImageTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    const elapsed = now - lastTapRef.current;
    lastTapRef.current = now;

    if (elapsed < 300) {
      e.preventDefault();
      if (isZoomed) {
        resetZoom();
      } else {
        const zoom = getZoomScale();
        setZoomScale(zoom);
        setPanX(0);
        setPanY(0);
        setIsZoomed(true);
      }
      lastTapRef.current = 0;
    }
  };

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

  const handleVideoTouch = () => {
    togglePlay();
  };

  const [btnState, setBtnState] = useState(0); // 0, 1, 2

  const nextBtnState = () => {
    setBtnState((prev) => (prev + 1) % 3);
  };

  const onFullscreen = () => {
    if (isImage) {
      if (isZoomed) {
        resetZoom();
      } else {
        const zoom = getZoomScale();
        setZoomScale(zoom);
        setPanX(0);
        setPanY(0);
        setIsZoomed(true);
      }
      return;
    }

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
            onTouchEnd={handleVideoTouch}
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
          <div
            className="image-zoom-wrapper"
            onPointerDown={handleImagePointerDown}
            onPointerMove={handleImagePointerMove}
            onPointerUp={handleImagePointerUp}
            onPointerCancel={handleImagePointerUp}
            onTouchStart={(e) => e.preventDefault()}
            onTouchEnd={handleImageTouchEnd}
          >
            <img
              ref={imgRef}
              src={mediaUrl}
              alt={item.name}
              className="media-element image-zoomable"
              draggable={false}
              style={{
                transform: `scale(${zoomScale}) translate(${panX}px, ${panY}px)`,
                transformOrigin: 'center center',
              }}
            />
          </div>
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
