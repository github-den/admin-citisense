import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretLeft } from '@phosphor-icons/react';
import Button from './Button.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import {
  createCustomAdminDateRange,
  createPresetAdminDateRange,
  isDefaultAdminDateRange,
} from '@core/lib/adminDateRange.js';
import styles from '../../screens/DashboardPage/DashboardDateRangeFilter.module.css';

const DEFAULT_PRESET_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

export default function AdminDateRangeFilter({
  value,
  onChange,
  className = '',
  align = 'end',
  label = 'Date Range',
  customLabel = 'Select a date range',
  customTitle = 'Select a date range',
  presetOptions = DEFAULT_PRESET_OPTIONS,
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list');
  const rootRef = useRef(null);
  const selection = value ?? createPresetAdminDateRange('all');
  const isActive = !isDefaultAdminDateRange(selection);

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
        {label}
        <CaretDown size={12} weight="bold" />
      </Button>

      {open ? (
        <div className={`${styles.panel} ${align === 'end' ? styles.panelEnd : ''}`}>
          {view === 'list' ? (
            <div className={styles.list}>
              {presetOptions.map((option) => (
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
                onClick={() => {
                  if (selection.kind !== 'custom') onChange(createCustomAdminDateRange());
                  setView('custom');
                }}
              >
                {customLabel}
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
                <span className={styles.monthLabel}>{customTitle}</span>
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
                placeholder={customTitle}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
