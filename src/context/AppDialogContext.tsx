import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppDialog } from '../components/AppDialog';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

export interface AlertDialogOptions {
  title?: string;
  message: string;
  okLabel?: string;
}

type DialogRequest =
  | ({
      id: number;
      type: 'confirm';
      resolve: (value: boolean) => void;
    } & ConfirmDialogOptions)
  | ({
      id: number;
      type: 'alert';
      resolve: () => void;
    } & AlertDialogOptions);

interface AppDialogContextValue {
  confirm: (options: string | ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: string | AlertDialogOptions) => Promise<void>;
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const idRef = useRef(0);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: string | ConfirmDialogOptions) => {
    const payload = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      idRef.current += 1;
      setDialog({
        id: idRef.current,
        type: 'confirm',
        title: payload.title,
        message: payload.message,
        confirmLabel: payload.confirmLabel,
        cancelLabel: payload.cancelLabel,
        variant: payload.variant ?? 'default',
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: string | AlertDialogOptions) => {
    const payload = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>((resolve) => {
      idRef.current += 1;
      setDialog({
        id: idRef.current,
        type: 'alert',
        title: payload.title,
        message: payload.message,
        okLabel: payload.okLabel,
        resolve,
      });
    });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!dialog || dialog.type !== 'confirm') return;
    dialog.resolve(true);
    closeDialog();
  }, [closeDialog, dialog]);

  const handleCancel = useCallback(() => {
    if (!dialog || dialog.type !== 'confirm') return;
    dialog.resolve(false);
    closeDialog();
  }, [closeDialog, dialog]);

  const handleAlertOk = useCallback(() => {
    if (!dialog || dialog.type !== 'alert') return;
    dialog.resolve();
    closeDialog();
  }, [closeDialog, dialog]);

  useEffect(() => {
    if (!dialog) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dialog.type === 'confirm') handleCancel();
        else handleAlertOk();
      }
      if (event.key === 'Enter') {
        if (dialog.type === 'confirm') handleConfirm();
        else handleAlertOk();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    confirmButtonRef.current?.focus();

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, handleAlertOk, handleCancel, handleConfirm]);

  return (
    <AppDialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && (
        <AppDialog
          dialog={dialog}
          confirmButtonRef={confirmButtonRef}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onAlertOk={handleAlertOk}
        />
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) throw new Error('useAppDialog must be used within AppDialogProvider');
  return ctx;
}
