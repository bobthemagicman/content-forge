"use client";

import { useRouter } from "next/navigation";
import { RouterProvider } from "react-aria-components";
import { Toaster } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { DemoSessionProvider } from "@/lib/auth/demo-session";
import { DEMO_MODE } from "@/lib/config";

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
}

// AuthProvider configures Amplify itself (T030), so nothing here depends on call order.
const SessionProvider = DEMO_MODE ? DemoSessionProvider : AuthProvider;

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <RouterProvider navigate={router.push}>
      <SessionProvider>{children}</SessionProvider>
      <Toaster />
    </RouterProvider>
  );
}
