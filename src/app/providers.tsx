"use client";

import { useRouter } from "next/navigation";
import { RouterProvider } from "react-aria-components";
import { Toaster } from "@/components/ui/toast";
import { SessionProvider } from "@/lib/auth/session";

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <RouterProvider navigate={router.push}>
      <SessionProvider>{children}</SessionProvider>
      <Toaster />
    </RouterProvider>
  );
}
