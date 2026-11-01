"use client";

import Image from "next/image";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import type { ContentItem } from "@/lib/data/types";
import { BrowserFrame, PhoneFrame } from "./frames";

const tab =
  "label flex h-10 cursor-pointer items-center rounded-full px-5 text-text outline-none transition-colors duration-200 " +
  "data-hovered:bg-glass-hover data-selected:bg-primary data-selected:text-on-primary " +
  "data-focus-visible:outline-2 data-focus-visible:outline-offset-3 data-focus-visible:outline-focus";

/** Desktop and Mobile screenshots behind a segmented control (T108). */
export function ScreenshotGallery({ item }: { item: ContentItem }) {
  const [desktop, mobile] = item.previewKeys ?? [];
  if (!desktop) return null;
  return (
    <Tabs className="flex flex-col gap-5">
      <TabList aria-label="Screenshot size" className="glass inline-flex gap-1 self-start rounded-full p-1">
        <Tab id="desktop" className={tab}>
          Desktop
        </Tab>
        {mobile && (
          <Tab id="mobile" className={tab}>
            Mobile
          </Tab>
        )}
      </TabList>
      <TabPanel id="desktop" className="outline-none">
        <BrowserFrame path={item.demoEntryPath ? `/demo/${item.demoEntryPath}` : item.slug}>
          <Image
            src={desktop}
            alt={`${item.title} preview 1, desktop`}
            width={1440}
            height={900}
            sizes="(min-width: 1024px) 66vw, 100vw"
            priority
            className="block h-auto w-full"
          />
        </BrowserFrame>
      </TabPanel>
      {mobile && (
        <TabPanel id="mobile" className="outline-none">
          <PhoneFrame>
            <Image src={mobile} alt={`${item.title} preview 2, mobile`} width={390} height={844} sizes="300px" className="block h-auto w-full" />
          </PhoneFrame>
        </TabPanel>
      )}
    </Tabs>
  );
}
