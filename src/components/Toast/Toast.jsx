'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, WarningCircle, XCircle, Info, X } from '@phosphor-icons/react';
import styles from './Toast.module.css';

const TOAST_TYPES = {
  success: { Icon: CheckCircle, className: styles.success },
  error: { Icon: XCircle, className: styles.error },
  warning: { Icon: WarningCircle, className: styles.warning },
  info: { Icon: Info, className: styles.info },
};

let toastCount = 0;

export function showToast(message, type = 'info', duration = 4000) {
  const id = ++toastCount;
  const event = new CustomEvent('toast', { detail: { id, message, type, duration } });
  window.dispatchEvent(event);
  return id;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (event) => {
      const { id, message, type, duration } = event.detail;
      setToasts((prev) => [...prev, { id, message, type, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    };

    window.addEventListener('toast', handleToast);
    return () => window.removeEventListener('toast', handleToast);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className={styles.container} role="alert" aria-live="polite">
      {toasts.map((toast) => {
        const { Icon, className } = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
        return (
          <div key={toast.id} className={[styles.toast, className].join(' ')}>
            <Icon size={20} weight="fill" className={styles.icon} aria-hidden="true" />
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              className={styles.close}
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              <X size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
