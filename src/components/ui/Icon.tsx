import type { SVGProps } from 'react';

export type IconName =
  | 'analytics'
  | 'bell'
  | 'board'
  | 'chevronDown'
  | 'chevronRight'
  | 'close'
  | 'dashboard'
  | 'eye'
  | 'eyeOff'
  | 'menu'
  | 'moon'
  | 'sun';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IconName;
  label?: string;
}

const paths: Record<IconName, JSX.Element> = {
  analytics: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  board: <path d="M4 4h6v16H4zM14 4h6v9h-6zM14 17h6v3h-6z" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  dashboard: <path d="M4 4h7v7H4zM15 4h5v7h-5zM4 15h7v5H4zM15 15h5v5h-5z" />,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="m3 3 18 18M10.6 6.1Q11.3 6 12 6c6 0 9.5 6 9.5 6a18 18 0 0 1-2.1 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  moon: <path d="M20 15.3A9 9 0 0 1 8.7 4 9 9 0 1 0 20 15.3Z" />,
  sun: <path d="M12 3V1m0 22v-2m9-9h2M1 12h2m16.4-7.4 1.4-1.4M3.2 20.8l1.4-1.4m14.8 0 1.4 1.4M3.2 3.2l1.4 1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" />,
};

export function Icon({ name, label, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      fill="none"
      height="20"
      role={label ? 'img' : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
