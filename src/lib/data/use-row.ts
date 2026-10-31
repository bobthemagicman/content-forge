"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentType } from "@/lib/content-types";
import { listRow } from "./content";
import type { ContentSummary } from "./types";

export type RowStatus = "loading" | "ready" | "error";

export interface RowState {
  items: ContentSummary[];
  status: RowStatus;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/** Paged items for one content type, newest first (T085). */
export function useRow(type: ContentType, { limit = 20 }: { limit?: number } = {}): RowState {
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [status, setStatus] = useState<RowStatus>("loading");
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loadingMore = useRef(false);

  useEffect(() => {
    let cancelled = false;
    listRow(type, { limit })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextToken(page.nextToken);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [type, limit, attempt]);

  const loadMore = useCallback(() => {
    if (!nextToken || loadingMore.current) return;
    loadingMore.current = true;
    setLoadingMore(true);
    listRow(type, { limit, nextToken })
      .then((page) => {
        setItems((prev) => [...prev, ...page.items]);
        setNextToken(page.nextToken);
      })
      .catch(() => setStatus("error"))
      .finally(() => {
        loadingMore.current = false;
        setLoadingMore(false);
      });
  }, [type, limit, nextToken]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  return { items, status, hasMore: nextToken !== null, isLoadingMore, loadMore, retry };
}
