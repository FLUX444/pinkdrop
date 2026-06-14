import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectDropdownOption<Value extends string> {
  value: Value;
  label: string;
}

interface SelectDropdownProps<Value extends string> {
  value: Value;
  options: SelectDropdownOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
  ariaLabel?: string;
}

export function SelectDropdown<Value extends string>({
  value,
  options,
  onChange,
  className = '',
  ariaLabel,
}: SelectDropdownProps<Value>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`admin-promo__dropdown${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="admin-promo__dropdown-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <span>{selected.label}</span>
        <ChevronDown size={16} aria-hidden />
      </button>
      <div className="admin-promo__dropdown-menu" role="listbox" aria-label={ariaLabel}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`admin-promo__dropdown-option${isActive ? ' is-active' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {isActive && <Check size={14} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
