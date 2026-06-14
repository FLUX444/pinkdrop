import type { RefObject } from 'react';
import type { AlertDialogOptions, ConfirmDialogOptions } from '../context/AppDialogContext';

type DialogRequest =
  | ({ type: 'confirm'; id: number } & ConfirmDialogOptions)
  | ({ type: 'alert'; id: number } & AlertDialogOptions);

interface AppDialogProps {
  dialog: DialogRequest;
  confirmButtonRef: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
  onAlertOk: () => void;
}

export function AppDialog({
  dialog,
  confirmButtonRef,
  onConfirm,
  onCancel,
  onAlertOk,
}: AppDialogProps) {
  const isConfirm = dialog.type === 'confirm';
  const isDanger = isConfirm && dialog.variant === 'danger';

  return (
    <div
      className="modal-overlay app-dialog-overlay"
      onClick={isConfirm ? onCancel : onAlertOk}
      role="presentation"
    >
      <div
        className={`app-dialog${isDanger ? ' app-dialog--danger' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
      >
        <span className="mono app-dialog__tag">{isConfirm ? 'CONFIRM' : 'NOTICE'}</span>
        <h2 id="app-dialog-title" className="app-dialog__title">
          {dialog.title ?? (isConfirm ? 'Подтвердите действие' : 'Уведомление')}
        </h2>
        <p id="app-dialog-message" className="app-dialog__message">
          {dialog.message}
        </p>

        <div className="app-dialog__actions">
          {isConfirm ? (
            <>
              <button type="button" className="btn btn--secondary" onClick={onCancel}>
                {dialog.cancelLabel ?? 'Отмена'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={`btn ${isDanger ? 'btn--danger' : 'btn--primary'}`}
                onClick={onConfirm}
              >
                {dialog.confirmLabel ?? 'Подтвердить'}
              </button>
            </>
          ) : (
            <button
              ref={confirmButtonRef}
              type="button"
              className="btn btn--primary app-dialog__ok"
              onClick={onAlertOk}
            >
              {dialog.okLabel ?? 'Понятно'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
