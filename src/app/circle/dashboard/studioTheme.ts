import { studioTheme } from "ag-studio";

// Our design tokens (src/app/globals.css), with the literal as a fallback.
const ink = "var(--color-ink, #14201b)";
const ink2 = "var(--color-ink-2, #3f4b46)";
const line = "var(--color-line, #d9dfdb)";
const surface = "var(--color-surface, #ffffff)";
const ground = "var(--color-ground, #f4f6f4)";
const evergreen = "var(--color-evergreen, #1e5a47)";

// Chart series: evergreen, held blue, caution brown, blocked red, ink-3 grey.
const series = ["#1e5a47", "#2c5c8f", "#6e4300", "#a2302a", "#4a5651"];
const palette: Record<string, string> = {};
for (let i = 1; i <= 20; i++) {
  const c = series[(i - 1) % series.length]!;
  palette[`chartPaletteFills${i}Color`] = c;
  palette[`chartPaletteStrokes${i}Color`] = c;
}

export const theme = studioTheme.withParams({
  accentColor: evergreen,
  backgroundColor: surface,
  foregroundColor: ink,
  textColor: ink,
  subtleTextColor: ink2,
  borderColor: line,
  fontFamily: "var(--font-sans)",
  borderRadius: 12,
  studioWrapperBackgroundColor: ground,
  studioWrapperBorder: "none",
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioCanvasBackgroundColor: ground,
  studioCanvasBorder: "none",
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: "none",
  studioCanvasFontFamily: "var(--font-sans)",
  studioWidgetBackgroundColor: surface,
  studioWidgetBorder: "none",
  studioWidgetBorderRadius: "var(--radius-panel, 20px)",
  studioWidgetShadow: "none",
  studioWidgetTitleFontFamily: "var(--font-sans)",
  studioWidgetTitleFontSize: 22,
  studioWidgetTitleFontWeight: 800,
  studioWidgetTitleTextColor: ink,
  chartAccentColor: evergreen,
  chartFontFamily: "var(--font-sans)",
  chartTextColor: ink,
  chartSubtleTextColor: ink2,
  chartBorderColor: line,
  chartAxisLineColor: line,
  ...palette,
} as never);
