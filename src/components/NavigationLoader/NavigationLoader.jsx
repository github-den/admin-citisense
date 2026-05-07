'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './NavigationLoader.module.css';

export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loading: authLoading } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const triggerLoader = () => setIsNavigating(true);
    const stopLoader = () => setIsNavigating(false);

    window.addEventListener('citicontrol:trigger-loader', triggerLoader);
    window.addEventListener('citicontrol:stop-loader', stopLoader);
    return () => {
      window.removeEventListener('citicontrol:trigger-loader', triggerLoader);
      window.removeEventListener('citicontrol:stop-loader', stopLoader);
    };
  }, []);

  useEffect(() => {
    // When the pathname or search changes, it means we have arrived.
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  const active = authLoading || isNavigating;

  useEffect(() => {
    if (active) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      };
    }
  }, [active]);

  if (!active) return null;

  return (
    <div className={styles.loader} role="status" aria-label="Loading">
      <div className={styles.brandedContent}>
        <h1 className={styles.wordmark}>citisense</h1>
        <p className={styles.tagline}>CITIZEN FEEDBACK PLATFORM</p>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} />
      </div>
    </div>
  );
}
