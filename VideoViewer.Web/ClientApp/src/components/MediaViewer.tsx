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
  const [zoomMode, setZoomMode] = useState<0 | 1 | 2>(0);
  const [isPanning, setIsPanning] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    setPanX(0);
    setPanY(0);
    setIsPanning(false);
    setMediaStatus('loading');
    setBufferedPercent(0);
    setIsPlaybackReady(false);
    hasAutoPlayedRef.current = false;
    lastTapRef.current = 0;

    if (!isImage) {
      resetZoom();
      return;
    }

    resetZoom();
  }, [item, isImage]);

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
    setZoomMode(0);
  };

  const applyZoomMode = (mode: 0 | 1 | 2) => {
    if (mode === 0) {
      resetZoom();
      return;
    }

    if (mode === 1) {
      const zoom = getZoomScale();
      setZoomScale(zoom);
      setPanX(0);
      setPanY(0);
      setIsZoomed(true);
      setZoomMode(1);
      return;
    }

    setZoomScale(1);
    setPanX(0);
    setPanY(0);
    setIsZoomed(true);
    setZoomMode(2);
  };

  const cycleZoomMode = () => {
    setZoomMode((prev) => {
      const nextMode = prev === 0 ? 1 : prev === 1 ? 2 : 0;
      applyZoomMode(nextMode as 0 | 1 | 2);
      return nextMode as 0 | 1 | 2;
    });
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
      cycleZoomMode();
      lastTapRef.current = 0;
    }
  };

  const handleImageDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    cycleZoomMode();
  };

  const getImageStyle = () => {
    const img = imgRef.current;
    const isActualSizeMode = zoomMode === 2;

    const baseStyle: React.CSSProperties = {
      transform: `scale(${zoomScale}) translate(${panX}px, ${panY}px)`,
      transformOrigin: 'center center',
    };

    if (!isActualSizeMode || !img) {
      return baseStyle;
    }

    return {
      ...baseStyle,
      width: `${img.naturalWidth || img.clientWidth || 0}px`,
      height: `${img.naturalHeight || img.clientHeight || 0}px`,
      maxWidth: 'none',
      maxHeight: 'none',
      objectFit: 'contain',
    };
  };

  const handleImageLoad = () => {
    if (!isImage) {
      return;
    }

    setMediaStatus('ready');

    if (zoomMode === 1) {
      setZoomScale(getZoomScale());
      setPanX(0);
      setPanY(0);
    } else if (zoomMode === 2) {
      setZoomScale(1);
      setPanX(0);
      setPanY(0);
    }
  };

  const handleMediaError = () => {
    setMediaStatus('error');
  };

  const updateBufferedProgress = (video: HTMLVideoElement | null) => {
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      setBufferedPercent(0);
      return;
    }

    let bufferedEnd = 0;
    for (let index = 0; index < video.buffered.length; index += 1) {
      bufferedEnd = Math.max(bufferedEnd, video.buffered.end(index));
    }

    const nextPercent = Math.min(100, Math.max(0, (bufferedEnd / video.duration) * 100));
    setBufferedPercent(nextPercent);

    const bufferThreshold = Math.min(8, Math.max(2, video.duration * 0.12));
    if (!hasAutoPlayedRef.current && video.readyState >= 2 && bufferedEnd >= bufferThreshold) {
      hasAutoPlayedRef.current = true;
      setIsPlaybackReady(false);
      setMediaStatus('loading');
      video.muted = true;
      void video.play()
        .then(() => {
          setMediaStatus('ready');
          setIsPlaybackReady(true);
        })
        .catch(() => {
          video.muted = true;
          void video.play().catch(() => {
            setMediaStatus('ready');
            setIsPlaybackReady(true);
          });
        });
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
            playsInline
            preload="metadata"
            loop={btnState === 0}

            // iOS specific attribute to avoid native fullscreen
            webkit-playsinline="true"
            className="media-element"
            onMouseEnter={() => setShowControls(true)}   // desktop hover
            onMouseLeave={() => setShowControls(false)}
            onTouchEnd={handleVideoTouch}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              updateBufferedProgress(e.currentTarget);
            }}
            onCanPlay={() => updateBufferedProgress(videoRef.current)}
            onProgress={(e) => updateBufferedProgress(e.currentTarget)}
            onPlaying={() => {
              setMediaStatus('ready');
              setIsPlaybackReady(true);
            }}
            onWaiting={() => setMediaStatus('loading')}
            onError={handleMediaError}
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
            onDoubleClick={handleImageDoubleClick}
          >
            <img
              ref={imgRef}
              src={mediaUrl}
              alt={item.name}
              className="media-element image-zoomable"
              draggable={false}
              onLoad={handleImageLoad}
              onError={handleMediaError}
              style={getImageStyle()}
            />
          </div>
        )}
      </div>

      {((mediaStatus === 'loading' || mediaStatus === 'error') && (isVideo || isImage)) && (
        <div className={`media-status-bar ${mediaStatus}`} role="status" aria-live="polite">
          <div className="media-progress-track" aria-hidden="true">
            <div className="media-progress-fill" style={{ width: `${isVideo ? bufferedPercent : 100}%` }} />
          </div>
          <span className="media-status-dot" />
          <span>
            {mediaStatus === 'loading' && (isVideo ? `Buffering ${Math.round(bufferedPercent)}%` : 'Loading image…')}
            {mediaStatus === 'error' && 'Unable to load media'}
          </span>
        </div>
      )}

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
