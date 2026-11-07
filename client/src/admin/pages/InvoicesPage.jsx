import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, post, qs, money, dateOnly } from "../api.js";
import { Alert, Badge, Empty, Field, Modal, Pagination, confirmThen } from "../ui.jsx";

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [query, setQuery] = useState({ search: "", type: "", status: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setError("");
    try {
      const data = await get(`/invoices${qs({ ...query, page, pageSize: 10 })}`);
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
          <h1 className="admin-title">Invoices & Receipts</h1>
          <p className="admin-subtitle">Issued documents are historical — they never change once issued.</p>
        </div>
        <div className="admin-toolbar__actions">
          <button className="btn btn--gold" onClick={() => setCreating(true)}>
            + New invoice
          </button>
        </div>
      </div>

      <Alert kind="error" onDismiss={() => setError("")}>
        {error}
      </Alert>

      <div className="filters">
        <div className="field field--grow">
          <label>Search</label>
          <input
            placeholder="Number, party or record code…"
            value={query.search}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, search: e.target.value });
            }}
          />
        </div>
        <Field label="Type">
          <select value={query.type} onChange={(e) => { setPage(1); setQuery({ ...query, type: e.target.value }); }}>
            <option value="">All</option>
            <option value="INVOICE">Invoices</option>
            <option value="RECEIPT">Receipts</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={query.status} onChange={(e) => { setPage(1); setQuery({ ...query, status: e.target.value }); }}>
            <option value="">All</option>
            <option value="ISSUED">Issued</option>
            <option value="CANCELLED">Cancelled</option>
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
          <Empty>No invoices or receipts issued yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Party</th>
                  <th>Record</th>
                  <th>Issue date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/admin/invoices/${inv.id}`)}>
                    <td>
                      <Link to={`/admin/invoices/${inv.id}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{inv.number}</strong>
                      </Link>
                    </td>
                    <td>
                      <Badge value={inv.type === "RECEIPT" ? "BANK" : "SUPER_ADMIN"} />
                      <span style={{ marginLeft: 6 }}>{inv.type}</span>
                    </td>
                    <td>{inv.partyName}</td>
                    <td>{inv.recordCode}</td>
                    <td>{dateOnly(inv.issueDate)}</td>
                    <td>
                      <Badge value={inv.status} />
                    </td>
                    <td className="num">{money(inv.total)}</td>
                    <td>
                      <div className="admin-table__actions" onClick={(e) => e.stopPropagation()}>
                        <a className="btn btn--outline btn--sm" href={`/api/v1/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" style={{ display: "inline-flex" }}>
                          PDF
                        </a>
                        {inv.status === "ISSUED" ? (
                          <button
                            className="btn btn--sm btn--danger"
                            onClick={confirmThen(`Cancel ${inv.number}? The document is preserved as cancelled.`, async () => {
                              const reason = window.prompt("Cancellation reason:");
                              if (!reason || reason.trim().length < 3) return;
                              try {
                                await post(`/invoices/${inv.id}/cancel`, { reason });
                                load();
                              } catch (e) {
                                setError(e.message);
                              }
                            })}
                          >
                            Cancel
                          </button>
                        ) : null}
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

      {creating ? (
        <InvoiceFormModal
          onClose={() => setCreating(false)}
          onSaved={(inv) => {
            setCreating(false);
            navigate(`/admin/invoices/${inv.id}`);
          }}
        />
      ) : null}
    </>
  );
}

function InvoiceFormModal({ onClose, onSaved }) {
  const [projects, setProjects] = useState([]);
  const [records, setRecords] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [recordId, setRecordId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: "1", unitPrice: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get("/projects/dropdown").then((d) => setProjects(d.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) {
      setRecords([]);
      setRecordId("");
      return;
    }
    get(`/financial-records${qs({ projectId, status: "ACTIVE", pageSize: 100, sortBy: "createdAt", sortDir: "desc" })}`)
      .then((d) => setRecords(d.data))
      .catch(() => setRecords([]));
  }, [projectId]);

  const total = items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

  function setItem(i, key, value) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const inv = await post("/invoices", {
        financialRecordId: recordId,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unitPrice: it.unitPrice,
        })),
      });
      onSaved(inv);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New invoice" onClose={onClose} wide>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        <Field label="Project" required>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Financial record" required>
          <select value={recordId} onChange={(e) => setRecordId(e.target.value)} required disabled={!projectId}>
            <option value="">{projectId ? "Select record…" : "Pick a project first…"}</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.partyName} (remaining {money(r.remainingAmount)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Appears on the PDF" />
        </Field>

        <div className="field--full">
          <label style={{ marginBottom: 8, display: "block" }}>
            Line items <em>*</em>
          </label>
          {items.map((it, i) => (
            <div key={i} className="btn-row" style={{ marginBottom: 10 }}>
              <input
                style={{ flex: 3 }}
                placeholder="Description"
                value={it.description}
                onChange={(e) => setItem(i, "description", e.target.value)}
                required
              />
              <input
                style={{ flex: 1 }}
                type="number"
                step="1"
                min="1"
                placeholder="Qty"
                value={it.quantity}
                onChange={(e) => setItem(i, "quantity", e.target.value)}
                required
              />
              <input
                style={{ flex: 1.4 }}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Unit price ৳"
                value={it.unitPrice}
                onChange={(e) => setItem(i, "unitPrice", e.target.value)}
                required
              />
              {items.length > 1 ? (
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setItems([...items, { description: "", quantity: "1", unitPrice: "" }])}>
            + Add line
          </button>
          <div style={{ marginTop: 12, fontWeight: 700, textAlign: "right", fontSize: 16 }}>
            Total: {money(String(total))}
          </div>
        </div>

        <div className="field--full btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Issuing…" : "Issue invoice"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
