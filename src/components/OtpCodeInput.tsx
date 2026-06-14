import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OtpCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
}

export function OtpCodeInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  idPrefix = 'otp',
}: OtpCodeInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  useEffect(() => {
    if (!autoFocus || disabled) return;
    inputRefs.current[0]?.focus();
    setActiveIndex(0);
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (value.length === length) {
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  const updateValue = (nextDigits: string[]) => {
    const nextValue = nextDigits.join('').slice(0, length);
    onChange(nextValue);
  };

  const focusCell = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputRefs.current[clamped]?.focus();
    setActiveIndex(clamped);
  };

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      updateValue(nextDigits);
      return;
    }

    const nextDigits = [...digits];
    let cursor = index;

    for (const char of cleaned) {
      if (cursor >= length) break;
      nextDigits[cursor] = char;
      cursor += 1;
    }

    updateValue(nextDigits);
    focusCell(Math.min(cursor, length - 1));
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index - 1] = '';
      updateValue(nextDigits);
      focusCell(index - 1);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(index - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    const nextDigits = Array.from({ length }, (_, index) => pasted[index] ?? '');
    updateValue(nextDigits);
    focusCell(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="otp-input" role="group" aria-label="Код подтверждения">
      {digits.map((digit, index) => (
        <input
          key={`${idPrefix}-${index}`}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          className={`otp-input__cell${activeIndex === index ? ' is-active' : ''}${digit ? ' is-filled' : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Цифра ${index + 1}`}
          onFocus={() => setActiveIndex(index)}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
