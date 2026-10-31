import { InfoIcon } from "@/components/icons";

/** Says plainly that this build runs on demo data, so nobody mistakes it for the real library. */
export function BetaNotice() {
  return (
    <div className="container-page pt-4">
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <InfoIcon size={16} className="shrink-0 text-callout" />
        Beta preview: the catalog is sample data, sign-in is simulated, and downloads are turned off.
      </p>
    </div>
  );
}
