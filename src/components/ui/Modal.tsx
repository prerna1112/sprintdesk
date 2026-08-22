import { createPortal } from 'react-dom';
import { useId, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { useAccessibleOverlay } from './useAccessibleOverlay';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  closeOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  closeOnBackdrop = true,
  initialFocusRef,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useAccessibleOverlay(open, onClose, dialogRef, initialFocusRef);

  if (!open) return null;

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-overlay/60 p-4 backdrop-blur-sm"
      onMouseDown={handleBackdrop}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border bg-elevated p-6 shadow-2xl"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold" id={titleId}>{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground" id={descriptionId}>{description}</p> : null}
          </div>
          <Button aria-label="Close dialog" onClick={onClose} size="icon" variant="ghost">
            <Icon name="close" />
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
