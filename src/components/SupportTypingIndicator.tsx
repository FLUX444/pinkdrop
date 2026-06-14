interface SupportTypingIndicatorProps {
  label?: string;
}

export function SupportTypingIndicator({ label = 'печатает' }: SupportTypingIndicatorProps) {
  return (
    <div className="support-typing" role="status" aria-live="polite">
      <span className="support-typing__label">{label}</span>
      <span className="support-typing__dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
