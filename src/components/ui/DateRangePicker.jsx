import { useEffect, useRef, useState } from 'react';
import { CalendarBlank, CaretLeft, CaretRight, Funnel, X } from '@phosphor-icons/react';
import styles from './DateRangePicker.module.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEAR_PAGE = 12;

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isBetween(date, start, end) {
  if (!start || !end || !date) return false;
  const value = date.getTime();
  const startTime = Math.min(start.getTime(), end.getTime());
  const endTime = Math.max(start.getTime(), end.getTime());
  return value > startTime && value < endTime;
}

function formatDateRangeLabel(start, end) {
  if (!start && !end) return null;

  const formatDate = (date) => date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (start && !end) return formatDate(start);
  if (isSameDay(start, end)) return formatDate(start);
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function isAfterToday(date) {
  const today = new Date();
  if (date.getFullYear() > today.getFullYear()) return true;
  if (date.getFullYear() < today.getFullYear()) return false;
  if (date.getMonth() > today.getMonth()) return true;
  if (date.getMonth() < today.getMonth()) return false;
  return date.getDate() > today.getDate();
}

function isMonthAfterToday(year, month) {
  const today = new Date();
  return year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth());
}

function isYearAfterToday(year) {
  return year > new Date().getFullYear();
}

function YearPicker({ currentYear, onSelect }) {
  const todayYear = new Date().getFullYear();
  const [page, setPage] = useState(Math.floor(currentYear / YEAR_PAGE) * YEAR_PAGE);
  const years = Array.from({ length: YEAR_PAGE }, (_, index) => page + index);
  const canGoNext = page + YEAR_PAGE - 1 < todayYear;

  return (
    <div>
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} onClick={() => setPage((value) => value - YEAR_PAGE)}>
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className={styles.monthLabel}>{page} - {Math.min(page + YEAR_PAGE - 1, todayYear)}</span>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => setPage((value) => value + YEAR_PAGE)}
          disabled={!canGoNext}
          style={!canGoNext ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      <div className={styles.pickGrid}>
        {years.map((year) => {
          const future = isYearAfterToday(year);
          return (
            <button
              key={year}
              type="button"
              disabled={future}
              className={[
                styles.pickCell,
                year === currentYear ? styles.pickCellActive : '',
                year === todayYear ? styles.pickCellToday : '',
                future ? styles.pickCellDisabled : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (!future) onSelect(year);
              }}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthPicker({ currentMonth, currentYear, onSelect, onYearClick, onPrevYear, onNextYear }) {
  const today = new Date();
  const canGoNextYear = currentYear < today.getFullYear();

  return (
    <div>
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} onClick={onPrevYear}>
          <CaretLeft size={14} weight="bold" />
        </button>
        <button type="button" className={styles.headerTextBtn} onClick={onYearClick} title="Pick year">
          {currentYear}
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={onNextYear}
          disabled={!canGoNextYear}
          style={!canGoNextYear ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      <div className={styles.pickGrid}>
        {MONTH_SHORT.map((name, index) => {
          const active = index === currentMonth;
          const isToday = index === today.getMonth() && currentYear === today.getFullYear();
          const future = isMonthAfterToday(currentYear, index);
          return (
            <button
              key={name}
              type="button"
              disabled={future}
              className={[
                styles.pickCell,
                active ? styles.pickCellActive : '',
                isToday && !active ? styles.pickCellToday : '',
                future ? styles.pickCellDisabled : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (!future) onSelect(index);
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({
  value,
  onChange,
  onComplete,
  placeholder = 'Date posted',
  inline = false,
  embedded = false,
  className = '',
  panelClassName = '',
}) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('day');
  const [viewYear, setViewYear] = useState((value?.start ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((value?.start ?? today).getMonth());
  const [hovered, setHovered] = useState(null);
  const rootRef = useRef(null);

  const start = value?.start ?? null;
  const end = value?.end ?? null;
  const hasValue = Boolean(start || end);
  const label = formatDateRangeLabel(start, end);

  useEffect(() => {
    if (!start) return;
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
  }, [start]);

  useEffect(() => {
    if (inline) return undefined;

    function handleMouseDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setView('day');
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [inline]);

  function emitChange(nextValue) {
    onChange(nextValue);
    if ((nextValue.start && nextValue.end) || (!nextValue.start && !nextValue.end)) {
      onComplete?.(nextValue);
    }
  }

  function handleDayClick(day) {
    const clicked = new Date(viewYear, viewMonth, day);
    if (isAfterToday(clicked)) return;

    if (!start || (start && end)) {
      emitChange({ start: clicked, end: null });
      return;
    }

    const nextValue = clicked < start
      ? { start: clicked, end: start }
      : { start, end: clicked };

    emitChange(nextValue);

    if (!inline) {
      setOpen(false);
      setView('day');
    }
  }

  function clearDates(event) {
    event?.stopPropagation?.();
    emitChange({ start: null, end: null });
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
      return;
    }
    setViewMonth((month) => month - 1);
  }

  function nextMonth() {
    if ((viewYear === today.getFullYear() && viewMonth >= today.getMonth()) || viewYear > today.getFullYear()) return;

    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
      return;
    }
    setViewMonth((month) => month + 1);
  }

  const isNextMonthFuture = (viewYear === today.getFullYear() && viewMonth >= today.getMonth())
    || viewYear > today.getFullYear();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  const panel = (
    <div className={[styles.panel, inline ? styles.panelInline : '', embedded ? styles.panelEmbedded : '', panelClassName].filter(Boolean).join(' ')}>
      {view === 'year' ? (
        <YearPicker
          currentYear={viewYear}
          onSelect={(year) => {
            setViewYear(year);
            setView('month');
          }}
        />
      ) : null}

      {view === 'month' ? (
        <MonthPicker
          currentMonth={viewMonth}
          currentYear={viewYear}
          onSelect={(month) => {
            setViewMonth(month);
            setView('day');
          }}
          onYearClick={() => setView('year')}
          onPrevYear={() => setViewYear((year) => year - 1)}
          onNextYear={() => {
            if (viewYear < today.getFullYear()) setViewYear((year) => year + 1);
          }}
        />
      ) : null}

      {view === 'day' ? (
        <>
          <div className={styles.header}>
            <button type="button" className={styles.navBtn} onClick={prevMonth}>
              <CaretLeft size={14} weight="bold" />
            </button>

            <div className={styles.headerLabels}>
              <button type="button" className={styles.headerTextBtn} onClick={() => setView('month')} title="Pick month">
                {MONTH_NAMES[viewMonth]}
              </button>
              <button type="button" className={styles.headerTextBtn} onClick={() => setView('year')} title="Pick year">
                {viewYear}
              </button>
            </div>

            <button
              type="button"
              className={styles.navBtn}
              onClick={nextMonth}
              disabled={isNextMonthFuture}
              style={isNextMonthFuture ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
            >
              <CaretRight size={14} weight="bold" />
            </button>
          </div>

          <div className={styles.dayHeaders}>
            {DAY_NAMES.map((dayName) => <span key={dayName} className={styles.dayName}>{dayName}</span>)}
          </div>

          <div className={styles.grid}>
            {cells.map((day, index) => {
              if (!day) return <span key={`blank-${index}`} />;

              const date = new Date(viewYear, viewMonth, day);
              const future = isAfterToday(date);
              const startSelected = isSameDay(date, start);
              const endSelected = isSameDay(date, end);
              const safeHovered = hovered && !isAfterToday(hovered) ? hovered : null;
              const inRange = isBetween(date, start, safeHovered ?? end);
              const todayMatch = isSameDay(date, today);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={future}
                  className={[
                    styles.day,
                    startSelected || endSelected ? styles.daySelected : '',
                    inRange ? styles.dayInRange : '',
                    todayMatch && !startSelected && !endSelected ? styles.dayToday : '',
                    future ? styles.dayDisabled : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => {
                    if (!future && start && !end) setHovered(date);
                  }}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleDayClick(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {view === 'day' && (start || end) ? (
        <div className={styles.footer}>
          <span className={styles.footerRange}>
            {label ?? (start ? 'Select end date...' : '')}
          </span>
          {start && end ? (
            <button type="button" className={styles.clearLink} onClick={clearDates}>Clear</button>
          ) : null}
        </div>
      ) : null}

      {view === 'day' && start && !end ? (
        <div className={styles.footer}>
          <span className={styles.footerHint}>Select end date...</span>
        </div>
      ) : null}
    </div>
  );

  if (inline) {
    return (
      <div className={[styles.root, className].filter(Boolean).join(' ')} ref={rootRef}>
        {panel}
      </div>
    );
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${hasValue ? styles.triggerActive : ''}`}
        onClick={() => {
          setOpen((value) => !value);
          setView('day');
        }}
      >
        <CalendarBlank size={16} weight="bold" color={hasValue ? 'var(--brand)' : 'var(--text-3)'} />
        <span className={styles.triggerLabel}>{label ?? placeholder}</span>
        {hasValue ? (
          <button type="button" className={styles.clearBtn} onClick={clearDates} title="Clear dates" aria-label="Clear dates">
            <X size={13} weight="bold" />
          </button>
        ) : (
          <Funnel size={14} weight="bold" color="var(--text-3)" />
        )}
      </button>

      {open ? panel : null}
    </div>
  );
}
