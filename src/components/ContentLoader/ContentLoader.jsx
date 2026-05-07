import styles from './ContentLoader.module.css';

export default function ContentLoader({ overlay = false, label = 'Loading page' }) {
  return (
    <div className={overlay ? styles.overlay : styles.standalone} aria-label={label} role="status">
      <div className={styles.loaderCard}>
        <div className={styles.logoWrap}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>citisense</span>
          </div>
          <div className={styles.logoSub}>Citizen Feedback Platform</div>
        </div>
        <div className={styles.brandLockup}>
          <div className={styles.brandSub}>Loading civic workspace</div>
        </div>
      </div>
    </div>
  );
}
