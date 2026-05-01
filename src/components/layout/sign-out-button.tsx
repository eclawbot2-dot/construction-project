import { LogOut } from "lucide-react";

/**
 * Sign-out posts to /api/auth/sign-out-clean which (a) clears the
 * NextAuth session via signOut() and (b) deletes our app-specific
 * cookies (cx.tenant / cx.actor / cx.superAdmin) so a subsequent
 * sign-in on the same browser doesn't inherit the previous user's
 * tenant or impersonation context.
 *
 * Server-rendered as a plain form so it works without JavaScript and
 * avoids importing next-auth/react in the sidebar bundle.
 */
export function SignOutButton() {
  return (
    <form action="/api/auth/sign-out-clean" method="post">
      <button type="submit" className="btn-outline w-full justify-center text-xs">
        <LogOut className="mr-2 h-3.5 w-3.5" />
        Sign out
      </button>
    </form>
  );
}
