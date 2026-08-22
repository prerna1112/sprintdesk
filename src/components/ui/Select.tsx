import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    'aria-describedby': callerDescribedBy,
    'aria-invalid': callerInvalid,
    children,
    className,
    error,
    hint,
    id: providedId,
    label,
    placeholder,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [callerDescribedBy, hintId, errorId]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold text-foreground" htmlFor={id}>
        {label}
      </label>
      <select
        aria-describedby={describedBy}
        aria-invalid={error ? true : callerInvalid}
        className={cn(
          'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-danger focus-visible:ring-danger',
          className,
        )}
        id={id}
        ref={ref}
        {...props}
      >
        {placeholder ? (
          <option disabled value="">
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      {hint ? <p className="text-xs text-muted-foreground" id={hintId}>{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-danger" id={errorId}>{error}</p> : null}
    </div>
  );
});
