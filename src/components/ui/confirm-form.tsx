"use client";

import { useId } from "react";

/**
 * Wraps a form submission with a native confirm() prompt. Use for any
 * action that's hard to reverse — clearing a key, switching primary
 * mode, deleting a resource, force-deleting old audit events, etc.
 *
 * Renders <form> with onSubmit that bails out unless the user clicks
 * OK on the prompt. Children are passed through (typically a button +
 * any hidden inputs).
 */
export function ConfirmForm({
  action,
  method = "post",
  message,
  className,
  children,
}: {
  action: string;
  method?: "post" | "get";
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <form
      id={id}
      action={action}
      method={method}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
