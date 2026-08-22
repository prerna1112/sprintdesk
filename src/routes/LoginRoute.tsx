import { Link } from 'react-router-dom';
import { RouteShell } from './RouteShell';

export default function LoginRoute() {
  return (
    <RouteShell
      eyebrow="SprintDesk"
      title="Welcome back"
      description="Authentication will be implemented in its dedicated feature slice."
    >
      <Link
        className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
        to="/dashboard"
      >
        Preview dashboard
      </Link>
    </RouteShell>
  );
}
