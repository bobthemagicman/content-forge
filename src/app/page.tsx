import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

export const metadata: Metadata = { title: { absolute: "Content Forge · Sign in" } };

export default function HomePage() {
  return <Landing />;
}
