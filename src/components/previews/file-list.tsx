import { TypeIcon } from "@/components/icons";
import type { ContentItem, OtherMeta } from "@/lib/data/types";
import { formatBytes } from "@/lib/format";
import { GlassFrame } from "./frames";

/** The archive's file listing in place of a picture (T113). Capped at 500 entries by ingest. */
export function FileList({ item }: { item: ContentItem }) {
  const meta = item.meta as OtherMeta | undefined;
  const files = meta?.fileList ?? [];
  const more = (meta?.totalFiles ?? files.length) - files.length;
  return (
    <GlassFrame className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-glass-border px-5 py-4">
        <TypeIcon type="OTHER" size={24} className="text-accent" />
        <h2 className="text-h3">What&rsquo;s inside</h2>
      </div>
      {files.length === 0 ? (
        <p className="px-5 py-6 text-text-muted">No file listing for this item.</p>
      ) : (
        <div className="max-h-[480px] overflow-auto" tabIndex={0} role="region" aria-label="File list">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-raised">
              <tr>
                <th scope="col" className="label px-5 py-3 text-left font-normal text-text-muted">
                  Path
                </th>
                <th scope="col" className="label px-5 py-3 text-right font-normal text-text-muted">
                  Size
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.path} className="border-t border-glass-border">
                  <td className="px-5 py-2.5 text-text [overflow-wrap:anywhere]">{f.path}</td>
                  <td className="px-5 py-2.5 text-right text-text-muted tabular-nums whitespace-nowrap">{formatBytes(f.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {more > 0 && <p className="border-t border-glass-border px-5 py-3 text-sm text-text-muted">+{more.toLocaleString("en-US")} more</p>}
        </div>
      )}
    </GlassFrame>
  );
}
