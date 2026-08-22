import { createPortal } from 'react-dom';
import { useId, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { useAccessibleOverlay } from './useAccessibleOverlay';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  description?: string;
  closeOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  description,
  closeOnBackdrop = true,
  initialFocusRef,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  useAccessibleOverlay(open, onClose, drawerRef, initialFocusRef);

  if (!open) return null;

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay/60 backdrop-blur-sm" onMouseDown={handleBackdrop}>
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="h-full w-full overflow-y-auto border-l bg-elevated p-5 shadow-2xl sm:max-w-sm"
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold" id={titleId}>{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground" id={descriptionId}>{description}</p> : null}
          </div>
          <Button aria-label="Close drawer" onClick={onClose} size="icon" variant="ghost">
            <Icon name="close" />
          </Button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
