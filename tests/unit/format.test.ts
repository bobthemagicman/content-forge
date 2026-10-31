import { describe, expect, it } from "vitest";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [2048, "2.0 KB"],
    [48.2 * 1024 * 1024, "48.2 MB"],
    [412 * 1024 * 1024, "412 MB"],
    [1.42 * 1024 ** 3, "1.4 GB"],
  ])("%d → %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe("formatDuration", () => {
  it.each([
    [15, "0:15"],
    [84, "1:24"],
    [3725, "1:02:05"],
  ])("%d s → %s", (sec, text) => {
    expect(formatDuration(sec)).toBe(text);
  });
});

it("formats dates in UTC", () => {
  expect(formatDate("2025-03-14")).toBe("Mar 14, 2025");
});
