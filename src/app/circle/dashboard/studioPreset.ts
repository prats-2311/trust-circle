import type { AgReportState } from "ag-studio";

// Field ids are namespaced by the data source id ("payments") once they are in state.
const f = (id: string) => ({ id: `payments.${id}` });

export const STUDIO_SOURCE_ID = "payments";

export const studioPreset: AgReportState = {
  selectedPageId: "overview",
  pages: [
    {
      id: "overview",
      widgets: {
        filterStatus: { type: "list-filter", dataMapping: { value: [f("status")] }, format: { title: { text: "Status", enabled: true } } },
        filterSender: { type: "list-filter", dataMapping: { value: [f("sender")] }, format: { title: { text: "Sender", enabled: true } } },
        filterScam: { type: "list-filter", dataMapping: { value: [f("scamType")] }, format: { title: { text: "Scam type", enabled: true } } },
        byScamType: {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: [f("scamType")], valueKey: [{ ...f("amount"), aggregation: "count" }] },
          format: { title: { text: "Payments by scam type", enabled: true } },
        },
        heldPerWeek: {
          type: "column-chart-grouped",
          dataMapping: { categoryKey: [f("week")], valueKey: [{ ...f("amount"), aggregation: "sum" }] },
          format: { title: { text: "Amount held per week", enabled: true } },
        },
      },
      widgetLayout: {
        filterStatus: { xTrack: 0, yTrack: 0, xSpan: 8, ySpan: 13 },
        filterSender: { xTrack: 8, yTrack: 0, xSpan: 8, ySpan: 13 },
        filterScam: { xTrack: 16, yTrack: 0, xSpan: 8, ySpan: 13 },
        byScamType: { xTrack: 0, yTrack: 13, xSpan: 12, ySpan: 16 },
        heldPerWeek: { xTrack: 12, yTrack: 13, xSpan: 12, ySpan: 16 },
      },
      filter: {
        widget: {
          heldPerWeek: [{ field: f("status"), model: { operator: "isIn", value: ["On hold", "Stopped"] } }],
        },
      },
    },
  ],
} as unknown as AgReportState;
