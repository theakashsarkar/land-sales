import { useEffect, useState } from "react";
import { get, download, money, qs } from "../api.js";
import { Alert, Empty, Field } from "../ui.jsx";

const REPORTS = [
  { value: "date-wise", label: "Date-wise collections" },
  { value: "user-wise", label: "User-wise collections" },
  { value: "project-wise", label: "Project-wise financials" },
  { value: "category-wise", label: "Category-wise financials" },
  { value: "financial-summary", label: "Financial summary" },
  { value: "transactions", label: "Transaction history" },
];

export default function ReportsPage() {
  const [projects, setProjects] = useState([]);
  const [report, setReport] = useState("date-wise");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [rows, setRows] = useState(null);
  const [columns, setColumns] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get("/projects/dropdown").then((d) => setProjects(d.data)).catch(() => {});
  }, []);

  function baseParams() {
    return { from: from || undefined, to: to || undefined, projectId: projectId || undefined };
  }

  async function run(e) {
    if (e) e.preventDefault();
    setBusy(true);
    setError("");
    setRows(null);
    try {
      const data = await get(`/reports/${report}${qs(baseParams())}`);
      const [cols, result] = renderRows(report, data);
      setColumns(cols);
      setRows(result);
      setTitle(REPORTS.find((r) => r.value === report)?.label || report);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(format) {
    setError("");
    try {
      const stamp = [from || "start", to || "today"].join("_");
      await download(`/reports/${report}${qs({ ...baseParams(), format })}`, `${report}_${stamp}.${format}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <h1 className="admin-title">Reports</h1>
          <p className="admin-subtitle">Financial reporting with PDF and Excel exports.</p>
        </div>
      </div>

      <Alert kind="error" onDismiss={() => setError("")}>
        {error}
      </Alert>

      <form className="filters" onSubmit={run}>
        <Field label="Report">
          <select value={report} onChange={(e) => setReport(e.target.value)}>
            {REPORTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Project">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn btn--primary btn--sm" disabled={busy} type="submit">
          {busy ? "Running…" : "Run report"}
        </button>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => save("pdf")}>
          PDF
        </button>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => save("xlsx")}>
          Excel
        </button>
      </form>

      {rows === null ? (
        <Empty>Pick a report and press “Run report”.</Empty>
      ) : rows.length === 0 ? (
        <Empty>No data for this period.</Empty>
      ) : (
        <div className="admin-card">
          <div className="admin-card__head">
            <h2 className="admin-card__title">{title}</h2>
            {from || to ? (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                {from || "…"} → {to || "…"}
              </span>
            ) : null}
          </div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={c.num ? "num" : ""}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.num ? "num" : ""}>
                        {c.render ? c.render(row[c.key], row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/** Map each report's JSON shape to [columns, rows]. */
function renderRows(report, data) {
  if (report === "date-wise") {
    return [
      [
        { key: "date", label: "Date" },
        { key: "transactionCount", label: "Transactions", num: true },
        { key: "total", label: "Total", num: true, render: money },
      ],
      data.rows,
    ];
  }
  if (report === "user-wise") {
    return [
      [
        { key: "user", label: "Recorded by", render: (_v, row) => row.user.name },
        { key: "user", label: "Email", render: (_v, row) => row.user.email },
        { key: "transactionCount", label: "Transactions", num: true },
        { key: "total", label: "Total", num: true, render: money },
      ],
      data.rows,
    ];
  }
  if (report === "project-wise" || report === "category-wise") {
    const key = report === "project-wise" ? "project" : "category";
    return [
      [
        { key, label: report === "project-wise" ? "Project" : "Category", render: (_v, row) => (report === "project-wise" ? `${row[key].name} (${row[key].code})` : row[key].name) },
        { key: "recordCount", label: "Records", num: true },
        { key: "totalAmount", label: "Total", num: true, render: money },
        { key: "paidAmount", label: "Paid", num: true, render: money },
        { key: "remainingAmount", label: "Remaining", num: true, render: money },
      ],
      data.rows,
    ];
  }
  if (report === "financial-summary") {
    return [
      [
        { key: "method", label: "Method" },
        { key: "count", label: "Transactions", num: true },
        { key: "total", label: "Total", num: true, render: money },
      ],
      [...data.byMethod, { method: "— TOTAL —", count: "", total: data.totals.totalPaidAmount }],
    ];
  }
  // transactions
  return [
    [
      { key: "paidAt", label: "Date", render: (v) => new Date(v).toLocaleDateString("en-GB") },
      { key: "financialRecord", label: "Record", render: (_v, row) => row.financialRecord.code },
      { key: "financialRecord", label: "Project", render: (_v, row) => row.financialRecord.project?.name || "—" },
      { key: "method", label: "Method" },
      { key: "status", label: "Status" },
      { key: "createdBy", label: "Recorded by", render: (_v, row) => row.createdBy.name },
      { key: "amount", label: "Amount", num: true, render: money },
    ],
    data.rows,
  ];
}
