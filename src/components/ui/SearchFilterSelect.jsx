import { useState, useMemo, useRef, useEffect } from 'react';
import { FunnelSimple, CaretDown, Funnel } from '@phosphor-icons/react';
import styles from './SearchFilterSelect.module.css';

/**
 * A unified Searchable Dropdown / Combobox component used across the platform.
 * Supports searchable text inputs (default) and flat label-based triggers (variant="flat").
 */
export default function SearchFilterSelect({
  value,
  options = [],
  onChange,
  placeholder = 'Select...',
  icon: Icon = FunnelSimple,
  emptyValue = 'all',
  fill = false,
  direction = 'down',
  disabled = false,
  variant = 'default', // 'default' (searchable input) or 'flat' (button-like)
  autoFocus = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (variant === 'flat') return options;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query, variant]);

  // Update query state when value changes externally
  useEffect(() => {
    if (variant === 'flat') {
      setQuery('');
      return;
    }
    if (!value || value === emptyValue) {
      setQuery('');
      return;
    }
    if (selectedOption) {
      setQuery(selectedOption.label);
    } else {
      // If no option matches but we have a value, show the value (for raw inputs)
      setQuery(value);
    }
  }, [selectedOption, value, emptyValue, variant]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function handleSelect(option) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  const isFlat = variant === 'flat';
  const hasValue = value && value !== emptyValue;

  return (
    <div 
      className={`${styles.categorySelect} ${fill ? styles.categorySelectFill : ''} ${disabled ? styles.categorySelectDisabled : ''} ${isFlat ? styles.variantFlat : ''}`} 
      ref={rootRef}
    >
      <div className={styles.categoryInputWrap} onClick={() => isFlat && !disabled && setOpen(!open)}>
        <Icon size={16} weight="bold" color={isFlat ? "var(--text-2)" : "var(--text-3)"} />
        
        {isFlat ? (
          <div className={styles.flatLabel}>
            <span>{selectedOption ? selectedOption.label : placeholder}</span>
            <div className={styles.flatArrow}>
              {hasValue ? (
                <Funnel size={14} weight="fill" color="var(--brand)" />
              ) : (
                <CaretDown size={14} weight="bold" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              )}
            </div>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              if (disabled) return;
              const val = event.target.value;
              setQuery(val);
              onChange(val);
              setOpen(true);
            }}
            onFocus={() => !disabled && setOpen(true)}
            placeholder={placeholder}
            readOnly={disabled}
            disabled={disabled}
            className={styles.selectInput}
          />
        )}
      </div>

      {open && !disabled && (
        <div className={`${styles.categoryDropdown} ${direction === 'up' ? styles.categoryDropdownUp : ''}`}>
          {filteredOptions.length > 0 ? filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.categoryOption} ${value === option.value ? styles.categoryOptionActive : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </button>
          )) : (
            <div className={styles.categoryEmpty}>No matches found</div>
          )}
        </div>
      )}
    </div>
  );
}
