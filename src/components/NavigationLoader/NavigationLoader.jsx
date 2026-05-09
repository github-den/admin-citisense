'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './NavigationLoader.module.css';

const TRIGGER_EVENT = 'citisense-admin:trigger-loader';

export default function NavigationLoader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const triggerLoader = () => setActive(true);
    window.addEventListener(TRIGGER_EVENT, triggerLoader);
    return () => window.removeEventListener(TRIGGER_EVENT, triggerLoader);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => {
      setActive(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [active, pathname, searchParams]);

  useEffect(() => {
    if (!active) return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className={styles.loader} role="status" aria-label="Loading page">
      <div className={styles.brandedContent}>
        <h1 className={styles.wordmark}>citisense</h1>
        <p className={styles.tagline}>ADMIN WORKSPACE</p>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} />
      </div>
    </div>
  );
}

export function triggerAdminNavigationLoader() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TRIGGER_EVENT));
}
