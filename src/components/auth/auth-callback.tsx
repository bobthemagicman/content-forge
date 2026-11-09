"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoMark } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { signInErrorCode } from "@/lib/auth/sign-in-error";
import { authClient } from "@/lib/platform/auth";

/**
 * Where the broker returns after Google (T048). Success goes to `/browse/`; a refused account goes to
 * `/?error=domain`, and any other failure to `/?error=signin`.
 */
export function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let done = false;
    const finish = (path: string) => {
      if (done) return;
      done = true;
      router.replace(path);
    };

    // OAuth reports errors in the query string (Cognito puts a trigger's rejection there); read it
    // before the adapter cleans up the URL.
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error_description") ?? params.get("error");
    if (urlError) {
      finish(`/?error=${signInErrorCode(urlError)}`);
      return;
    }

    // This effect runs before AuthProvider's (children first), so the adapter is listening before
    // anything starts the code exchange.
    return authClient().completeSignIn((result) =>
      finish(result.ok ? "/browse/" : `/?error=${signInErrorCode(result.message)}`),
    );
  }, [router]);

  return (
    <div aria-busy="true" className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <LogoMark size={32} />
      <Skeleton className="h-3 w-48 rounded-full" />
      <span className="sr-only" role="status">
        Signing you in…
      </span>
    </div>
  );
}
