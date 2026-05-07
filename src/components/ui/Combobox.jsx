import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Combobox.module.css';

export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  allLabel = placeholder,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  const normalizedOptions = useMemo(
    () => [...options].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [options],
  );

  const selectedLabel = value || '';

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return normalizedOptions;
    return normalizedOptions.filter((option) => option.toLowerCase().includes(needle));
  }, [normalizedOptions, query]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selectedLabel ? styles.value : styles.placeholder}>
          {selectedLabel || placeholder}
        </span>
        <CaretDown size={14} weight="bold" className={styles.caret} />
      </button>

      {open && (
        <div className={styles.panel}>
          <label className={styles.searchRow}>
            <MagnifyingGlass size={15} weight="bold" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}`}
            />
          </label>

          <div className={styles.list}>
            <button
              type="button"
              className={[styles.option, !value ? styles.optionActive : ''].filter(Boolean).join(' ')}
              onClick={() => {
                onChange?.('');
                setOpen(false);
                setQuery('');
              }}
            >
              {allLabel}
            </button>
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                className={[styles.option, value === option ? styles.optionActive : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  onChange?.(option);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
