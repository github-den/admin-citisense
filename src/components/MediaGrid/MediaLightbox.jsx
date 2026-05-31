import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, X } from '@phosphor-icons/react';
import { normalizeMediaItems } from '@core/utils/mediaGrid.js';
import { lockPageScroll } from '@core/utils/lockPageScroll.js';
import styles from './MediaLightbox.module.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.18;

export default function MediaLightbox({ items = [], index = 0, onSelect, onClose }) {
  const mediaItems = useMemo(() => normalizeMediaItems(items), [items]);
  const activeIndex = Math.min(Math.max(index, 0), Math.max(mediaItems.length - 1, 0));
  const activeItem = mediaItems[activeIndex];
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [origin, setOrigin] = useState('50% 50%');
  const [isPlaying, setIsPlaying] = useState(false);
  const overlayRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        selectMedia((activeIndex - 1 + mediaItems.length) % mediaItems.length);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        selectMedia((activeIndex + 1) % mediaItems.length);
      }

      if (event.key === 'Escape') {
        handleClose();
      }
    }

    const unlockPageScroll = lockPageScroll();
    window.addEventListener('keydown', handleKeyDown);
    overlayRef.current?.focus();

    return () => {
      unlockPageScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, mediaItems.length]);

  useEffect(() => {
    setZoom(MIN_ZOOM);
    setOrigin('50% 50%');
    setIsPlaying(false);
  }, [activeIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (activeItem?.type === 'video' && video) {
      video.currentTime = 0;
      video.pause();
      setIsPlaying(false);
    }
  }, [activeItem]);

  useEffect(() => {
    const video = videoRef.current;
    if (activeItem?.type === 'video' && video) {
      if (isPlaying) {
        video.play().catch(() => setIsPlaying(false));
      } else {
        video.pause();
      }
    }
  }, [isPlaying, activeItem]);

  if (!activeItem || !mounted) return null;

  function handleClose() {
    onClose?.({
      index: activeIndex,
      currentTime: 0,
      isPlaying: false,
    });
  }

  function handleWheel(event) {
    if (activeItem.type === 'video') return;
    event.preventDefault();

    const zoomDirection = event.deltaY > 0 ? 1 : -1;
    if ((zoomDirection > 0 && zoom >= MAX_ZOOM) || (zoomDirection < 0 && zoom <= MIN_ZOOM)) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);

    setZoom((current) => {
      const next = current + (zoomDirection > 0 ? ZOOM_STEP : -ZOOM_STEP);
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  }

  function selectMedia(nextIndex) {
    onSelect?.(nextIndex);
  }

  return createPortal(
    <div ref={overlayRef} className={styles.overlay} onMouseDown={handleClose} role="dialog" aria-modal="true" aria-label="Media preview" tabIndex={-1}>
      <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="Close preview">
        <X size={22} weight="bold" />
      </button>

      <div className={styles.stage} onMouseDown={(event) => event.stopPropagation()}>
        {activeItem.type === 'video' ? (
          <div className={styles.videoStageWrap}>
            <video
              ref={videoRef}
              key={activeItem.src}
              className={styles.media}
              src={activeItem.src}
              controls={isPlaying}
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              aria-label={`Video ${activeIndex + 1} of ${mediaItems.length}`}
            />
            {!isPlaying ? (
              <div className={styles.playOverlay} onClick={() => setIsPlaying(true)}>
                <div className={styles.playButton}>
                  <Play size={44} weight="fill" />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <img
            className={[styles.media, zoom > MIN_ZOOM ? styles.mediaZoomed : styles.mediaZoomable].join(' ')}
            src={activeItem.src}
            alt={`Image ${activeIndex + 1} of ${mediaItems.length}`}
            draggable="false"
            onWheel={handleWheel}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: origin,
            }}
          />
        )}
      </div>

      <div className={styles.footer} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.dots} aria-hidden="true">
          {mediaItems.map((item, dotIndex) => (
            <span key={item.id} className={[styles.dot, dotIndex === activeIndex ? styles.dotActive : ''].filter(Boolean).join(' ')} />
          ))}
        </div>

        <div className={styles.thumbnails}>
          {mediaItems.map((item, thumbIndex) => (
            <button
              type="button"
              key={item.id}
              className={[styles.thumbnailButton, thumbIndex === activeIndex ? styles.thumbnailActive : ''].filter(Boolean).join(' ')}
              onClick={(event) => {
                event.stopPropagation();
                selectMedia(thumbIndex);
              }}
              aria-label={`View ${item.type === 'video' ? 'video' : 'image'} ${thumbIndex + 1}`}
            >
              {item.type === 'video' ? (
                <div className={styles.thumbnailVideoWrap}>
                  <video className={styles.thumbnailMedia} src={`${item.src}#t=0.001`} muted preload="metadata" crossOrigin="anonymous" />
                  <div className={styles.thumbnailPlayIcon}><Play size={12} weight="fill" /></div>
                </div>
              ) : (
                <img className={styles.thumbnailMedia} src={item.src} alt={`Thumbnail ${thumbIndex + 1}`} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
