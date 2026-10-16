import { themeQuartz } from "ag-grid-community";

// Concept tokens until Plan 4's DESIGN.md: large type, high contrast, calm evergreen accent.
export const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 16,
  headerFontSize: 16,
  rowHeight: 56,
  headerHeight: 48,
  accentColor: "#1E5A47",
  foregroundColor: "#14201B",
  backgroundColor: "#FFFFFF",
  headerBackgroundColor: "#F4F6F4",
  borderColor: "#D9DFDB",
  wrapperBorderRadius: 20,
  borderRadius: 14,
});

// Phones: tighter cell padding so Status, When, To and Amount fit side by side.
export const gridThemeNarrow = gridTheme.withParams({ cellHorizontalPadding: 8 });
