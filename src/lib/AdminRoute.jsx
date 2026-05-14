import { Navigate } from 'react-router-dom';
import { isDeveloperModeEnabled } from '@/api/client';

/**
 * Local-only "developer mode" gate.
 *
 * NOTE: This is NOT a security boundary. Incognito is a local-first
 * privacy app — there is no remote authority to enforce role-based access.
 * The previous implementation defaulted every user to `role: 'admin'` and
 * gated developer-only diagnostic pages on a client-side role check, which
 * provided zero real protection.
 *
 * The new model:
 *   - All users carry `role: 'user'` (informational only).
 *   - Diagnostic / developer pages require `developerMode = true`, which the
 *     user must explicitly enable from Settings → Advanced.
 *   - Anything that handles secrets requires the encrypted vault to be
 *     unlocked (see `vault.js`).
 *
 * See `docs/THREAT_MODEL.md` for the full reasoning.
 */
export default function AdminRoute({ children }) {
  if (!isDeveloperModeEnabled()) return <Navigate to="/" replace />;
  return children;
}
