import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails on any WCAG 2.1 A/AA violation on the page, or inside `context` (a CSS selector) (SC-007). */
export async function expectNoA11yViolations(page: Page, context?: string): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (context) builder = builder.include(context);
  const { violations } = await builder.analyze();
  const summary = violations.map((v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, "accessibility violations").toEqual([]);
}
