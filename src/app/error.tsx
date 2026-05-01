"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Server-error boundary. Renders when a server component throws.
 * Logs the error to the browser console for the developer; surfaces a
 * short user-facing message + a `digest` the operator can grep server
 * logs for. Stack traces are intentionally NOT shown — they leak
 * filesystem paths and library internals.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error.tsx]", error);
  }, [error]);

  return (
    <main className="login-shell">
      <div className="login-card text-center">
        <header>
          <h1 style={{ color: "var(--heading)" }}>Something went wrong</h1>
          <p style={{ color: "var(--faint)" }}>
            The page hit an unexpected error.
            {error.digest ? (
              <>
                {" "}Reference: <code className="font-mono text-xs">{error.digest}</code>
              </>
            ) : null}
          </p>
        </header>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn-primary">Retry</button>
          <Link href="/" className="btn-outline">Go home</Link>
        </div>
      </div>
    </main>
  );
}
