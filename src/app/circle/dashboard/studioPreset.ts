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
        moneyProtected: { type: "money-protected", dataMapping: { value: [{ ...f("stopped"), aggregation: "sum" }] } },
        paypalCheck: { type: "paypal-check", dataMapping: { value: [f("paypalCheck")], count: [{ ...f("amount"), aggregation: "count" }] } },
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
        moneyProtected: { xTrack: 0, yTrack: 0, xSpan: 10, ySpan: 8 },
        paypalCheck: { xTrack: 10, yTrack: 0, xSpan: 14, ySpan: 8 },
        filterStatus: { xTrack: 0, yTrack: 8, xSpan: 8, ySpan: 12 },
        filterSender: { xTrack: 8, yTrack: 8, xSpan: 8, ySpan: 12 },
        filterScam: { xTrack: 16, yTrack: 8, xSpan: 8, ySpan: 12 },
        byScamType: { xTrack: 0, yTrack: 20, xSpan: 12, ySpan: 16 },
        heldPerWeek: { xTrack: 12, yTrack: 20, xSpan: 12, ySpan: 16 },
      },
      filter: {
        widget: {
          heldPerWeek: [{ field: f("status"), model: { operator: "isIn", value: ["On hold", "Stopped"] } }],
        },
      },
    },
  ],
} as unknown as AgReportState;
