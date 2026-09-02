"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertDialog, type AlertDialogTone } from "@/components/ui/AlertDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/i18n/context";

type ConfirmTone = "default" | "danger" | "warning";

type AlertOptions = {
  title?: string;
  message: string;
  tone?: AlertDialogTone;
  confirmLabel?: string;
};

type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type AlertState = AlertOptions & {
  resolve: () => void;
};

type ConfirmState = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

type DialogContextValue = {
  alert: (options: string | AlertOptions) => Promise<void>;
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function normalizeAlertOptions(options: string | AlertOptions): AlertOptions {
  return typeof options === "string" ? { message: options } : options;
}

function normalizeConfirmOptions(options: string | ConfirmOptions): ConfirmOptions {
  return typeof options === "string" ? { description: options } : options;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const alert = useCallback((options: string | AlertOptions) => {
    const normalized = normalizeAlertOptions(options);
    return new Promise<void>((resolve) => {
      setAlertState({ ...normalized, resolve });
    });
  }, []);

  const confirm = useCallback((options: string | ConfirmOptions) => {
    const normalized = normalizeConfirmOptions(options);
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...normalized, resolve });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((current) => {
      current?.resolve();
      return null;
    });
  }, []);

  const closeConfirm = useCallback((confirmed: boolean) => {
    setConfirmState((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AlertDialog
        open={Boolean(alertState)}
        title={alertState?.title}
        description={alertState?.message ?? ""}
        tone={alertState?.tone}
        confirmLabel={alertState?.confirmLabel}
        onClose={closeAlert}
      />
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? t("common.confirmTitle")}
        description={confirmState?.description ?? ""}
        confirmLabel={confirmState?.confirmLabel ?? t("common.confirm")}
        cancelLabel={confirmState?.cancelLabel}
        tone={confirmState?.tone}
        onCancel={() => closeConfirm(false)}
        onConfirm={() => closeConfirm(true)}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return context;
}
