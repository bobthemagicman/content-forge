"use client";

// Completes the OAuth redirect even though this page never imports `signInWithRedirect`.
import "aws-amplify/auth/enable-oauth-listener";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoMark } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { configureAmplify } from "@/lib/auth/amplify-config";
import { signInErrorCode } from "@/lib/auth/sign-in-error";

/**
 * Where Cognito returns after Google (T048). Success goes to `/browse/`; a refused account goes to
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

    // Cognito reports a trigger rejection in the query string; read it before Amplify cleans up the URL.
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error_description") ?? params.get("error");
    if (urlError) {
      finish(`/?error=${signInErrorCode(urlError)}`);
      return;
    }

    // This effect runs before AuthProvider's (children first), so the listener is attached before
    // configureAmplify() starts the code exchange.
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") finish("/browse/");
      else if (payload.event === "signInWithRedirect_failure") {
        finish(`/?error=${signInErrorCode(payload.data?.error?.message)}`);
      }
    });
    configureAmplify();
    // fetchAuthSession() waits for an in-flight redirect, so it settles the outcome even if the Hub
    // event fired first.
    fetchAuthSession().then(
      ({ tokens }) => finish(tokens ? "/browse/" : "/?error=signin"),
      () => finish("/?error=signin"),
    );
    return stop;
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
