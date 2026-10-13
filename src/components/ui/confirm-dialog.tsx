"use client";

import * as React from "react";
import { Button } from "./button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "./dialog";

/**
 * Confirmation for destructive actions. Pass `open`/`onOpenChange` to control it,
 * or a `trigger` element to open it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  onConfirm,
  confirmDisabled,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<boolean | void> | boolean | void;
  /** Keeps the confirm button disabled, e.g. until the user types a confirmation phrase. */
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}) {
  const [pending, setPending] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent size="sm" title={title} description={description}>
        {children && <DialogBody>{children}</DialogBody>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            disabled={confirmDisabled}
            onClick={async () => {
              setPending(true);
              try {
                const result = await onConfirm();
                if (result !== false) onOpenChange(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
