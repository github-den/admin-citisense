import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretLeft } from '@phosphor-icons/react';
import Button from '../../components/ui/Button.jsx';
import DateRangePicker from '../../components/ui/DateRangePicker.jsx';
import {
  createCustomAdminDateRange,
  createPresetAdminDateRange,
} from '@core/lib/adminDateRange.js';
import styles from './DashboardDateRangeFilter.module.css';

const DEFAULT_PRESET_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '15d', label: 'Last 15 days' },
  { value: '30d', label: 'Last 30 days' },
];

export default function DashboardDateRangeFilter({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list');
  const rootRef = useRef(null);
  const selection = value ?? createPresetAdminDateRange('all');

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
        Select date range
        <CaretDown size={12} weight="bold" />
      </Button>

      {open ? (
        <div className={styles.panel}>
          {view === 'list' ? (
            <div className={styles.list}>
              {DEFAULT_PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.item} ${selection.kind === 'preset' && selection.value === option.value ? styles.itemActive : ''}`}
                  onClick={() => {
                    onChange(createPresetAdminDateRange(option.value));
                    setOpen(false);
                    setView('list');
                  }}
                >
                  {option.label}
                </button>
              ))}

              <button
                type="button"
                className={`${styles.item} ${selection.kind === 'custom' ? styles.itemActive : ''}`}
                onClick={() => setView('custom')}
              >
                Select date range
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
                <span className={styles.monthLabel}>Select date range</span>
                <div className={styles.yearNavGroup} aria-hidden="true" />
              </div>

              <DateRangePicker
                inline
                embedded
                value={selection.kind === 'custom' ? selection : { start: null, end: null }}
                onChange={(nextRange) => {
                  onChange(createCustomAdminDateRange(nextRange.start, nextRange.end));
                }}
                onComplete={(nextRange) => {
                  if ((nextRange.start && nextRange.end) || (!nextRange.start && !nextRange.end)) {
                    setOpen(false);
                    setView('list');
                  }
                }}
                placeholder="Select date range"
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
