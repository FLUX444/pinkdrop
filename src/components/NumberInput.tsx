import { useCallback, useRef, type InputHTMLAttributes } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

function parseStep(step: InputHTMLAttributes<HTMLInputElement>['step']) {
  const value = Number(step ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function NumberInput({ className = '', step, min, max, onChange, ...props }: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const stepValue = parseStep(step);

  const adjustValue = useCallback(
    (direction: 1 | -1) => {
      const input = inputRef.current;
      if (!input || props.disabled || props.readOnly) return;

      const current = Number(input.value);
      const base = Number.isFinite(current) ? current : 0;
      let next = base + direction * stepValue;

      const minValue = min != null ? Number(min) : null;
      const maxValue = max != null ? Number(max) : null;
      if (minValue != null && Number.isFinite(minValue)) next = Math.max(minValue, next);
      if (maxValue != null && Number.isFinite(maxValue)) next = Math.min(maxValue, next);

      input.value = String(next);
      onChange?.({
        target: input,
        currentTarget: input,
      } as React.ChangeEvent<HTMLInputElement>);
    },
    [max, min, onChange, props.disabled, props.readOnly, stepValue]
  );

  return (
    <div className={`number-input${className ? ` ${className}` : ''}`}>
      <input
        ref={inputRef}
        type="number"
        className="number-input__field"
        step={step}
        min={min}
        max={max}
        onChange={onChange}
        {...props}
      />
      <div className="number-input__spin" aria-hidden>
        <button
          type="button"
          className="number-input__btn"
          tabIndex={-1}
          disabled={props.disabled || props.readOnly}
          onClick={() => adjustValue(1)}
          aria-label="Увеличить"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="number-input__btn"
          tabIndex={-1}
          disabled={props.disabled || props.readOnly}
          onClick={() => adjustValue(-1)}
          aria-label="Уменьшить"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}
