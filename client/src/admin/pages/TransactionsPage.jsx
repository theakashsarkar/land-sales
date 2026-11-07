import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post, qs, money, dateTime } from "../api.js";
import { Alert, Badge, Empty, Field, Modal, Pagination } from "../ui.jsx";

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState({ search: "", projectId: "", method: "", status: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [voiding, setVoiding] = useState(null);

  useEffect(() => {
    get("/projects/dropdown").then((d) => setProjects(d.data)).catch(() => {});
  }, []);

  async function load() {
    setError("");
    try {
      const data = await get(`/transactions${qs({ ...query, page, pageSize: 10 })}`);
      setRows(data.data);
      setMeta(data.meta);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page]);

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <h1 className="admin-title">Transactions</h1>
          <p className="admin-subtitle">Every payment across projects. Corrections void — nothing is deleted.</p>
        </div>
      </div>

      <Alert kind="error" onDismiss={() => setError("")}>
        {error}
      </Alert>
      <Alert kind="success" onDismiss={() => setNotice("")}>
        {notice}
      </Alert>

      <div className="filters">
        <div className="field field--grow">
          <label>Search</label>
          <input
            placeholder="Reference, note, record code…"
            value={query.search}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, search: e.target.value });
            }}
          />
        </div>
        <Field label="Project">
          <select value={query.projectId} onChange={(e) => { setPage(1); setQuery({ ...query, projectId: e.target.value }); }}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Method">
          <select value={query.method} onChange={(e) => { setPage(1); setQuery({ ...query, method: e.target.value }); }}>
            <option value="">All</option>
            {["CASH", "BANK", "CHEQUE", "ONLINE", "OTHER"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={query.status} onChange={(e) => { setPage(1); setQuery({ ...query, status: e.target.value }); }}>
            <option value="">All</option>
            <option value="VALID">Valid</option>
            <option value="VOID">Void</option>
          </select>
        </Field>
        <Field label="From">
          <input type="date" value={query.dateFrom} onChange={(e) => { setPage(1); setQuery({ ...query, dateFrom: e.target.value }); }} />
        </Field>
        <Field label="To">
          <input type="date" value={query.dateTo} onChange={(e) => { setPage(1); setQuery({ ...query, dateTo: e.target.value }); }} />
        </Field>
      </div>

      <div className="admin-card">
        {rows.length === 0 ? (
          <Empty>No transactions found.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Paid at</th>
                  <th>Record</th>
                  <th>Party</th>
                  <th>Project</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                  <th className="num">Amount</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>{dateTime(t.paidAt)}</td>
                    <td>
                      <Link to={`/admin/records/${t.financialRecord.id}`}>{t.financialRecord.code}</Link>
                    </td>
                    <td>{t.financialRecord.partyName}</td>
                    <td>{t.financialRecord.project?.name}</td>
                    <td>
                      <Badge value={t.method} />
                    </td>
                    <td>{t.reference || "—"}</td>
                    <td>
                      <Badge value={t.status} />
                    </td>
                    <td>{t.createdBy?.name}</td>
                    <td className="num">{money(t.amount)}</td>
                    <td>
                      <div className="admin-table__actions">
                        {t.status === "VALID" ? (
                          <button className="btn btn--sm btn--danger" onClick={() => setVoiding(t)}>
                            Void
                          </button>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{t.voidReason || "—"}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </div>

      {voiding ? (
        <VoidModal
          tx={voiding}
          onClose={() => setVoiding(null)}
          onSaved={() => {
            setVoiding(null);
            setNotice("Payment voided.");
            load();
          }}
        />
      ) : null}
    </>
  );
}

function VoidModal({ tx, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/transactions/${tx.id}/void`, { reason });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Void payment (${money(tx.amount)})`} onClose={onClose}>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        <Field label="Reason" required full>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} rows={2} />
        </Field>
        <div className="field--full btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Keep payment
          </button>
          <button className="btn btn--danger" disabled={busy}>
            {busy ? "Voiding…" : "Void payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
