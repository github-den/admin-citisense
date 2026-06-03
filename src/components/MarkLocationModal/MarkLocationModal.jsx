import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Target, WarningCircle, X } from '@phosphor-icons/react';
import styles from './MarkLocationModal.module.css';

const URDANETA_CENTER = { latitude: 15.9772, longitude: 120.5722, zoom: 14 };

const URDANETA_BOUNDS = {
  minLat: 15.93,
  maxLat: 16.02,
  minLng: 120.52,
  maxLng: 120.62,
};

function isWithinUrdaneta(lat, lng) {
  return lat >= URDANETA_BOUNDS.minLat && lat <= URDANETA_BOUNDS.maxLat &&
         lng >= URDANETA_BOUNDS.minLng && lng <= URDANETA_BOUNDS.maxLng;
}

export default function MarkLocationModal({ open, onClose, initialLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(initialLocation || null);

  useEffect(() => {
    if (open) {
      setSelectedLocation(initialLocation || null);
    }
  }, [open, initialLocation]);

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      if (!open) return;

      const L = await import('leaflet/dist/leaflet-src.esm.js');
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [URDANETA_CENTER.latitude, URDANETA_CENTER.longitude],
        zoom: URDANETA_CENTER.zoom,
        minZoom: 12,
        maxZoom: 18,
        scrollWheelZoom: false,
        dragging: false,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      mapRef.current = map;

      function updateMarkerIcon(lat, lng) {
        const isOutside = !isWithinUrdaneta(lat, lng);
        
        let pinSvg;
        if (isOutside) {
          pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" fill="none">
            <circle cx="16" cy="28" r="12" fill="#fff" stroke="#ef4444" stroke-width="2.5"/>
            <line x1="7.5" y1="19.5" x2="24.5" y2="36.5" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
          </svg>`;
        } else {
          pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" fill="none">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 14.4 24.7 15.02 25.3a1.33 1.33 0 001.96 0C17.6 40.7 32 26.5 32 16 32 7.163 24.837 0 16 0zm0 22a6 6 0 110-12 6 6 0 010 12z" fill="#ef4444" stroke="#fff" stroke-width="2.5"/>
            <circle cx="16" cy="16" r="4" fill="#fff"/>
          </svg>`;
        }
        
        if (markerRef.current) {
          markerRef.current.setIcon(L.divIcon({
            className: '',
            html: `<div class="${styles.mapMarker}">${pinSvg}</div>`,
            iconSize: [32, 42],
            iconAnchor: [16, 42],
          }));
        }
      }

      if (initialLocation) {
        const marker = L.marker([initialLocation.latitude, initialLocation.longitude], {
          draggable: false,
          icon: L.divIcon({
            className: '',
            html: '',
            iconSize: [32, 42],
            iconAnchor: [16, 42],
          }),
        }).addTo(map);

        markerRef.current = marker;
        updateMarkerIcon(initialLocation.latitude, initialLocation.longitude);
        map.setView([initialLocation.latitude, initialLocation.longitude], 15);
      }
    }

    mountMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [open, initialLocation]);

  if (!open) return null;

  function handleClose() {
    onClose();
  }

  return createPortal(
    <div className={styles.overlay} onMouseDown={handleClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Target size={20} weight="fill" className={styles.headerIcon} />
            <h2 className={styles.title}>Marked Location</h2>
          </div>
          <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
            <X size={20} weight="bold" />
          </button>
        </div>

        <p className={styles.subtitle}>
          This is the location marked by the citizen for this feedback.
        </p>

        <div className={styles.mapContainer}>
          <div ref={containerRef} className={styles.map} />
        </div>

        {selectedLocation && (
          <div className={styles.locationInfo}>
            {!isWithinUrdaneta(selectedLocation.latitude, selectedLocation.longitude) ? (
              <>
                <WarningCircle size={14} weight="fill" className={styles.warningIcon} />
                <span className={styles.warningText}>
                  Location is outside Urdaneta City.
                </span>
              </>
            ) : (
              <>
                <MapPin size={14} weight="fill" />
                <span>
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </span>
              </>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.confirmButton} onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    typeof document !== 'undefined' ? document.body : null,
  );
}