import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.footerWordmark}>citisense</span>
      <span className={styles.footerSep}>&nbsp;&nbsp;&nbsp;</span>
      <span className={styles.footerText}>© 2026 CitiSense. All Rights Reserved.</span>
      <span className={styles.footerSep}>&nbsp;&nbsp;&nbsp;</span>
      <button type="button" className={styles.footerLink}>Privacy Policy</button>
      <span className={styles.footerSep}>&nbsp;&nbsp;&nbsp;</span>
      <button type="button" className={styles.footerLink}>User Agreement</button>
      <span className={styles.footerSep}>&nbsp;&nbsp;&nbsp;</span>
      <button type="button" className={styles.footerLink}>About CitiSense</button>
    </footer>
  );
}
