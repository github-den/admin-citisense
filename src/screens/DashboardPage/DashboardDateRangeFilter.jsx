import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretLeft, CaretRight } from '@phosphor-icons/react';
import Button from '../../components/ui/Button.jsx';
import styles from './DashboardDateRangeFilter.module.css';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isSameMonth(selection, year, month) {
  return selection?.kind === 'month' && selection.year === year && selection.month === month;
}

function isFutureMonth(year, month) {
  const today = new Date();
  return year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
}

export default function DashboardDateRangeFilter({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list');
  const [viewYear, setViewYear] = useState(() => value?.kind === 'month' ? value.year : new Date().getFullYear());
  const rootRef = useRef(null);
  const today = new Date();

  useEffect(() => {
    if (value?.kind === 'month') {
      setViewYear(value.year);
    }
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setView('list');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const canGoNextYear = viewYear < today.getFullYear();

  return (
    <div className={styles.root} ref={rootRef}>
      <Button
        type="button"
        variant="secondary"
        size="md"
        className={className}
        onClick={() => {
          setOpen((current) => {
            const next = !current;
            if (next) setView('list');
            return next;
          });
        }}
      >
        Date Range
        <CaretDown size={12} weight="bold" />
      </Button>

      {open ? (
        <div className={styles.panel}>
          {view === 'list' ? (
            <div className={styles.list}>
              <button
                type="button"
                className={`${styles.item} ${value?.kind === 'preset' && value.value === 'all' ? styles.itemActive : ''}`}
                onClick={() => {
                  onChange({ kind: 'preset', value: 'all' });
                  setOpen(false);
                  setView('list');
                }}
              >
                All time
              </button>
              <button
                type="button"
                className={`${styles.item} ${value?.kind === 'preset' && value.value === '15d' ? styles.itemActive : ''}`}
                onClick={() => {
                  onChange({ kind: 'preset', value: '15d' });
                  setOpen(false);
                  setView('list');
                }}
              >
                Last 15 days
              </button>
              <button
                type="button"
                className={`${styles.item} ${value?.kind === 'preset' && value.value === '30d' ? styles.itemActive : ''}`}
                onClick={() => {
                  onChange({ kind: 'preset', value: '30d' });
                  setOpen(false);
                  setView('list');
                }}
              >
                Last 30 days
              </button>
              <button
                type="button"
                className={`${styles.item} ${value?.kind === 'month' ? styles.itemActive : ''}`}
                onClick={() => setView('month')}
              >
                Select a month
              </button>
            </div>
          ) : (
            <div className={styles.monthPanel}>
              <div className={styles.header}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setView('list')}
                  aria-label="Back to date range options"
                >
                  <CaretLeft size={14} weight="bold" />
                </button>
                <span className={styles.monthLabel}>{viewYear}</span>
                <div className={styles.yearNavGroup}>
                  <button
                    type="button"
                    className={styles.navBtn}
                    onClick={() => setViewYear((current) => current - 1)}
                    aria-label="Previous year"
                  >
                    <CaretLeft size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className={styles.navBtn}
                    onClick={() => setViewYear((current) => current + 1)}
                    disabled={!canGoNextYear}
                    aria-label="Next year"
                  >
                    <CaretRight size={14} weight="bold" />
                  </button>
                </div>
              </div>

              <div className={styles.monthGrid}>
                {MONTH_SHORT.map((label, month) => {
                  const currentMonth = today.getFullYear() === viewYear && today.getMonth() === month;
                  return (
                    <button
                      key={`${viewYear}-${label}`}
                      type="button"
                      disabled={isFutureMonth(viewYear, month)}
                      className={`${styles.monthCell} ${isSameMonth(value, viewYear, month) ? styles.monthCellActive : ''} ${currentMonth && !isSameMonth(value, viewYear, month) ? styles.monthCellCurrent : ''}`}
                      onClick={() => {
                        onChange({ kind: 'month', year: viewYear, month });
                        setOpen(false);
                        setView('list');
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
