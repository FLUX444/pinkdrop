import type { SupportThread } from '../types';

interface EscalationTicketPickerProps {
  threads: SupportThread[];
  value: string;
  onChange: (threadId: string) => void;
}

function getThreadLabel(thread: SupportThread) {
  const user = thread.userName || thread.userEmail || thread.userPhone || 'Клиент';
  const parts = [`#${thread.ticketNumber}`, user];
  if (thread.orderId) parts.push(`заказ ${thread.orderId}`);
  if (thread.productName) parts.push(thread.productName);
  return parts.join(' · ');
}

export function EscalationTicketPicker({ threads, value, onChange }: EscalationTicketPickerProps) {
  return (
    <div className="escalation-ticket-picker">
      <div className="escalation-ticket-picker__head">
        <span className="escalation-ticket-picker__label">Прикрепить обращение клиента</span>
        <span className="mono escalation-ticket-picker__hint">опционально</span>
      </div>
      <div className="escalation-ticket-picker__options" role="listbox" aria-label="Выбор обращения">
        <button
          type="button"
          className={`escalation-ticket-picker__option${value === '' ? ' is-active' : ''}`}
          onClick={() => onChange('')}
        >
          <span className="escalation-ticket-picker__option-title">Без прикрепления</span>
          <span className="escalation-ticket-picker__option-meta">Обычное сообщение админу</span>
        </button>
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={`escalation-ticket-picker__option${value === thread.id ? ' is-active' : ''}`}
            onClick={() => onChange(thread.id)}
          >
            <span className="escalation-ticket-picker__option-title">
              #{thread.ticketNumber} · {thread.userName || thread.userEmail || thread.userPhone || 'Клиент'}
            </span>
            <span className="escalation-ticket-picker__option-meta">{getThreadLabel(thread)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
