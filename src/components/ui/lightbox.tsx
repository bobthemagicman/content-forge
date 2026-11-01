"use client";

import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { XIcon } from "@/components/icons";
import { IconButton } from "./icon-button";

/**
 * Dialog / lightbox (MASTER.md): raised panel over a blurred scrim, focus trapped and returned to
 * the trigger, Escape and the close button dismiss it.
 */
export function Lightbox({
  isOpen,
  onOpenChange,
  title,
  toolbar,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-scrim p-4 backdrop-blur-[8px] md:p-8"
    >
      <Modal className="flex max-h-full w-full max-w-[min(1400px,100%)] outline-none">
        <Dialog className="flex max-h-[calc(100dvh-64px)] w-full flex-col overflow-hidden rounded-xl border border-glass-border bg-raised outline-none">
          {({ close }) => (
            <>
              <div className="flex items-center gap-3 border-b border-glass-border px-4 py-3">
                <Heading slot="title" className="font-display min-w-0 flex-1 truncate text-h3 text-text-strong">
                  {title}
                </Heading>
                {toolbar}
                <IconButton aria-label="Close" onPress={close}>
                  <XIcon size={20} />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">{children}</div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
