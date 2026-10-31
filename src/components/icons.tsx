// Lucide icons (ISC license, https://lucide.dev), inlined so the app doesn't need the package.
// Stroke 1.75 per MASTER.md. Decorative by default (aria-hidden); give a label where one is needed.

import type { SVGProps } from "react";
import type { ContentType } from "@/lib/content-types";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function icon(paths: React.ReactNode, displayName: string) {
  function Icon({ size = 20, strokeWidth = 1.75, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
        {...props}
      >
        {paths}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

export const LayoutTemplateIcon = icon(
  <>
    <rect width="18" height="7" x="3" y="3" rx="1" />
    <rect width="9" height="7" x="3" y="14" rx="1" />
    <rect width="5" height="7" x="16" y="14" rx="1" />
  </>,
  "LayoutTemplateIcon",
);
export const PresentationIcon = icon(
  <>
    <path d="M2 3h20" />
    <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
    <path d="m7 21 5-5 5 5" />
  </>,
  "PresentationIcon",
);
export const FilmIcon = icon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M7 3v18M3 7.5h4M3 12h18M3 16.5h4M17 3v18M17 7.5h4M17 16.5h4" />
  </>,
  "FilmIcon",
);
export const ImageIcon = icon(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </>,
  "ImageIcon",
);
export const LayersIcon = icon(
  <>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </>,
  "LayersIcon",
);
export const PackageIcon = icon(
  <>
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </>,
  "PackageIcon",
);
export const ChevronLeftIcon = icon(<path d="m15 18-6-6 6-6" />, "ChevronLeftIcon");
export const ChevronRightIcon = icon(<path d="m9 18 6-6-6-6" />, "ChevronRightIcon");
export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />, "ArrowRightIcon");
export const DownloadIcon = icon(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, "DownloadIcon");
export const ExternalLinkIcon = icon(
  <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  "ExternalLinkIcon",
);
export const ExpandIcon = icon(<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />, "ExpandIcon");
export const XIcon = icon(<path d="M18 6 6 18M6 6l12 12" />, "XIcon");
export const PlusIcon = icon(<path d="M5 12h14M12 5v14" />, "PlusIcon");
export const MinusIcon = icon(<path d="M5 12h14" />, "MinusIcon");
export const AlertCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </>,
  "AlertCircleIcon",
);
export const InfoIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </>,
  "InfoIcon",
);
export const MenuIcon = icon(<path d="M4 6h16M4 12h16M4 18h16" />, "MenuIcon");
export const LogOutIcon = icon(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />, "LogOutIcon");
export const FileIcon = icon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </>,
  "FileIcon",
);
export const SearchXIcon = icon(
  <>
    <path d="m13.5 8.5-5 5M8.5 8.5l5 5" />
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
  "SearchXIcon",
);
export const InboxIcon = icon(
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
  "InboxIcon",
);
export const LoaderIcon = icon(<path d="M21 12a9 9 0 1 1-6.219-8.56" />, "LoaderIcon");

export function PlayIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <path d="M7 4v16l13-8z" fill="currentColor" />
    </svg>
  );
}

export function GoogleLogo({ size = 18 }: { size?: number }) {
  // Google's full-color "G", as required by the sign-in branding guidelines.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <defs>
        <linearGradient id="cf-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#AFFC41" />
          <stop offset="1" stopColor="#F2A524" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#cf-logo)" />
      <rect x="12" y="12" width="12" height="12" rx="3" fill="#0B0710" />
    </svg>
  );
}

const TYPE_ICONS: Record<ContentType, ReturnType<typeof icon>> = {
  WEBSITE_TEMPLATE: LayoutTemplateIcon,
  POWERPOINT_TEMPLATE: PresentationIcon,
  VIDEO: FilmIcon,
  IMAGE: ImageIcon,
  TEXTURE: LayersIcon,
  OTHER: PackageIcon,
};

export function TypeIcon({ type, ...props }: IconProps & { type: ContentType }) {
  const Icon = TYPE_ICONS[type];
  return <Icon {...props} />;
}
