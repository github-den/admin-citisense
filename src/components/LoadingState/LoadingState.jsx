import { useEffect } from 'react';
import styles from './LoadingState.module.css';

export default function LoadingState({ type = 'card', count = 3 }) {
  useEffect(() => {
    // If it's a full-page loader, we hide the scrollbar
    const isFullPage = !['card', 'list', 'inline'].includes(type);
    if (isFullPage) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      };
    }
  }, [type]);

  if (type === 'card') {
    return (
      <div className={styles.cardGrid}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={styles.cardSkeleton}>
            <div className={styles.cardHeader}>
              <div className={styles.avatar} />
              <div className={styles.headerText}>
                <div className={styles.title} />
                <div className={styles.subtitle} />
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.line} />
              <div className={styles.line} />
              <div className={styles.lineShort} />
            </div>
            <div className={styles.cardActions}>
              <div className={styles.action} />
              <div className={styles.action} />
              <div className={styles.action} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className={styles.list}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={styles.listItem}>
            <div className={styles.listAvatar} />
            <div className={styles.listContent}>
              <div className={styles.line} />
              <div className={styles.lineShort} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'inline') {
    return (
      <div className={styles.inline}>
        <div className={styles.spinner} />
        <span className={styles.text}>Loading...</span>
      </div>
    );
  }

  return (
    <div className={styles.fullPage}>
      <div className={styles.spinner} />
    </div>
  );
}
