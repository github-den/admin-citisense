import React, { useEffect, useState } from 'react';
import { WarningCircle, CheckCircle, X } from '@phosphor-icons/react';
import styles from './Toast.module.css';

export default function Toast({ message, type = 'error', duration = 2000, onExited }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onExited, 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onExited]);

  if (!message) return null;

  const Icon = type === 'success' ? CheckCircle : WarningCircle;

  return (
    <div className={`${styles.toast} ${visible ? styles.toastIn : styles.toastOut} ${styles[type]}`}>
      <Icon size={18} weight="fill" />
      <span>{message}</span>
      <button className={styles.close} onClick={() => setVisible(false)}>
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
