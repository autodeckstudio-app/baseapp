// A printable service history for one car. Facts come only from the car's own records. No invented text.
export type HistoryRow = { date: string; service: string; status: string; invoice?: string | null };
export type HistoryReportInput = { studioName: string; studioAddress: string; studioPhone: string; carTitle: string; plate: string; rows: HistoryRow[]; generatedOn: string };

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function historyReportHtml(i: HistoryReportInput): string {
  const rows = i.rows.length
    ? i.rows.map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(r.service)}</td><td>${esc(r.status)}</td><td>${esc(r.invoice ?? "")}</td></tr>`).join("")
    : `<tr><td colspan="4">No completed visits yet.</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Service history, ${esc(i.carTitle)}</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#1b1b1f;margin:32px}h1{font-size:22px;margin:0}p{margin:2px 0;color:#555}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #ddd}th{font-size:12px;color:#555;text-transform:uppercase}</style></head><body><h1>${esc(i.carTitle)}</h1><p>${esc(i.plate)}</p><p>Service history from ${esc(i.studioName)}, ${esc(i.studioAddress)}. ${esc(i.studioPhone)}</p><table><thead><tr><th>Date</th><th>Service</th><th>Status</th><th>Invoice</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:20px">Generated ${esc(i.generatedOn)}</p></body></html>`;
}

/** Only delivered visits belong in a history a buyer or insurer might read. */
export function historyRows<J extends { serviceId: string; status: string; sealedAt?: string | null; createdAt: string; id: string }>(jobs: J[], name: (id: string) => string, fmt: (iso: string) => string, invoiceOf: (jobId: string) => string | null): HistoryRow[] {
  return jobs.filter((j) => j.status === "DELIVERED").map((j) => ({ date: fmt(j.sealedAt ?? j.createdAt), service: name(j.serviceId), status: "Delivered", invoice: invoiceOf(j.id) }));
}
