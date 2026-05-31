import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Play, Trash } from '@phosphor-icons/react';
import { normalizeMediaItems } from '@core/utils/mediaGrid.js';
import MediaLightbox from './MediaLightbox.jsx';
import styles from './MediaGrid.module.css';

export default function MediaCarousel({
  items = [],
  maxItems = 10,
  className = '',
  initialState = null,
  onOpen,
  onRemove,
  paused = false,
}) {
  const mediaItems = useMemo(() => normalizeMediaItems(items, maxItems), [items, maxItems]);
  const [activeIndex, setActiveIndex] = useState(initialState?.index ?? 0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const total = mediaItems.length;
  const activeItem = mediaItems[Math.min(activeIndex, Math.max(total - 1, 0))];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.6 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (activeItem?.type === 'video' && videoRef.current) {
      if (!paused && isIntersecting) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
  }, [activeItem, paused, isIntersecting]);

  useEffect(() => {
    setIsPlaying(false);
  }, [activeIndex]);

  if (!activeItem) return null;

  function goPrevious(event) {
    event?.stopPropagation?.();
    setActiveIndex((current) => (current - 1 + total) % total);
  }

  function goNext(event) {
    event?.stopPropagation?.();
    setActiveIndex((current) => (current + 1) % total);
  }

  function handleFullscreen(event) {
    event?.stopPropagation?.();
    setLightboxIndex(activeIndex);
    onOpen?.({ index: activeIndex, item: activeItem });
  }

  return (
    <div
      ref={containerRef}
      className={[styles.carousel, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={`Attached media (${total} items)`}
    >
      <div className={styles.carouselContent}>
        <div
          className={styles.blurBg}
          style={{ backgroundImage: `url(${activeItem.src})` }}
          aria-hidden="true"
        />

        <div className={styles.carouselMediaButton}>
          {activeItem.type === 'video' ? (
            <div className={styles.videoWrapper}>
              <video
                ref={videoRef}
                key={activeItem.src}
                className={styles.media}
                src={activeItem.src}
                controls
                playsInline
                muted
                preload="auto"
                crossOrigin="anonymous"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                aria-label="Video attachment"
              />
              {!isPlaying ? (
                <div className={styles.playOverlay} onClick={() => videoRef.current?.play()}>
                  <div className={styles.playButton}>
                    <Play size={44} weight="fill" />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.imageWrapper} onClick={handleFullscreen}>
              <img
                className={[styles.media, styles.clickable].join(' ')}
                src={activeItem.src}
                alt={`Attachment ${activeIndex + 1}`}
              />
            </div>
          )}
        </div>
      </div>

      {onRemove ? (
        <button
          type="button"
          className={styles.removeBtn}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(activeItem.id);
            setActiveIndex((current) => Math.max(0, Math.min(current, total - 2)));
          }}
          aria-label="Remove media"
        >
          <Trash size={14} />
        </button>
      ) : null}

      {total > 1 ? (
        <>
          <button type="button" className={`${styles.carouselControl} ${styles.carouselPrevious}`} onClick={goPrevious}>
            <span className={styles.carouselControlIcon}><CaretLeft size={18} weight="bold" /></span>
          </button>
          <button type="button" className={`${styles.carouselControl} ${styles.carouselNext}`} onClick={goNext}>
            <span className={styles.carouselControlIcon}><CaretRight size={18} weight="bold" /></span>
          </button>
          <div className={styles.carouselDots} aria-hidden="true">
            {mediaItems.map((item, index) => (
              <span
                key={item.id}
                className={`${styles.carouselDot} ${index === activeIndex ? styles.carouselDotActive : ''}`}
              />
            ))}
          </div>
        </>
      ) : null}

      {lightboxIndex != null ? (
        <MediaLightbox
          items={mediaItems}
          index={lightboxIndex}
          onSelect={(nextIndex) => {
            setActiveIndex(nextIndex);
            setLightboxIndex(nextIndex);
          }}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}
