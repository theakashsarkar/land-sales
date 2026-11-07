import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get, post, patch, qs, money, dateOnly, dateTime } from "../api.js";
import { Alert, Badge, Empty, Field, Modal, Pagination, confirmThen } from "../ui.jsx";
import { RecordFormModal } from "./RecordsPage.jsx";

export default function RecordDetailPage() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [payments, setPayments] = useState([]);
  const [payMeta, setPayMeta] = useState(null);
  const [payPage, setPayPage] = useState(1);
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [voiding, setVoiding] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [r, p, h] = await Promise.all([
        get(`/financial-records/${id}`),
        get(`/financial-records/${id}/transactions${qs({ page: payPage, pageSize: 8 })}`),
        get(`/financial-records/${id}/history`),
      ]);
      setRecord(r);
      setPayments(p.data);
      setPayMeta(p.meta);
      setHistory(h.data);
    } catch (e) {
      setError(e.message);
    }
  }, [id, payPage]);

  useEffect(() => {
    load();
    get("/projects/dropdown").then((d) => setProjects(d.data)).catch(() => {});
    get("/categories/dropdown").then((d) => setCategories(d.data)).catch(() => {});
  }, [load]);

  async function toggleStatus() {
    try {
      const next = record.status === "ACTIVE" ? "CANCELLED" : "ACTIVE";
      await patch(`/financial-records/${id}/status`, { status: next });
      setNotice(`Record ${next === "CANCELLED" ? "cancelled" : "reactivated"}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !record) return <Alert>{error}</Alert>;
  if (!record) return <div className="table-empty">Loading record…</div>;

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <div style={{ marginBottom: 6, fontSize: 13 }}>
            <Link to="/admin/records">← All records</Link>
          </div>
          <h1 className="admin-title">
            {record.code} — {record.title}
          </h1>
          <p className="admin-subtitle">
            {record.partyName} · {record.project?.name} · {record.category?.name}
          </p>
        </div>
        <div className="admin-toolbar__actions">
          <button className="btn btn--gold" onClick={() => setPaying(true)} disabled={record.status !== "ACTIVE"}>
            + Record payment
          </button>
          <button className="btn btn--outline btn--sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn btn--sm btn--danger" onClick={confirmThen(`Set status to ${record.status === "ACTIVE" ? "CANCELLED" : "ACTIVE"}?`, toggleStatus)}>
            {record.status === "ACTIVE" ? "Cancel record" : "Reactivate"}
          </button>
        </div>
      </div>

      <Alert kind="error" onDismiss={() => setError("")}>
        {error}
      </Alert>
      <Alert kind="success" onDismiss={() => setNotice("")}>
        {notice}
      </Alert>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Total amount</div>
          <div className="stat-card__value">{money(record.totalAmount)}</div>
          <div className="stat-card__hint">Created {dateOnly(record.createdAt)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Paid</div>
          <div className="stat-card__value">{money(record.paidAmount)}</div>
          <div className="stat-card__hint">{record.paymentCount} valid payment(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Remaining</div>
          <div className="stat-card__value">{money(record.remainingAmount)}</div>
          <div className="stat-card__hint">
            <Badge value={record.status} />
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 26 }}>
        <div className="admin-card__head">
          <h2 className="admin-card__title">Payments</h2>
        </div>
        {payments.length === 0 ? (
          <Empty>No payments recorded yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Paid at</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                  <th className="num">Amount</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((t) => (
                  <tr key={t.id}>
                    <td>{dateTime(t.paidAt)}</td>
                    <td>
                      <Badge value={t.method} />
                    </td>
                    <td>{t.reference || "—"}</td>
                    <td>{t.note || "—"}</td>
                    <td>
                      <Badge value={t.status} />
                    </td>
                    <td>{t.createdBy?.name}</td>
                    <td className="num">{money(t.amount)}</td>
                    <td>
                      <div className="admin-table__actions">
                        {t.status === "VALID" ? (
                          <>
                            <button
                              className="btn btn--outline btn--sm"
                              onClick={confirmThen(`Issue a receipt for ${money(t.amount)}?`, async () => {
                                try {
                                  const res = await post("/invoices/receipts", { transactionId: t.id });
                                  setNotice(`Receipt ${res.number} issued.`);
                                  load();
                                } catch (e) {
                                  setError(e.message);
                                }
                              })}
                            >
                              Receipt
                            </button>
                            <button className="btn btn--sm btn--danger" onClick={() => setVoiding(t)}>
                              Void
                            </button>
                          </>
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
        <Pagination meta={payMeta} onPage={setPayPage} />
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">Change history</h2>
        </div>
        {history.length === 0 ? (
          <Empty>No changes recorded.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Field</th>
                  <th>Old value</th>
                  <th>New value</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{dateTime(h.createdAt)}</td>
                    <td>
                      <Badge value={h.action === "CREATED" ? "VALID" : "VOID"} />
                      <span style={{ marginLeft: 8, fontWeight: 600 }}>{h.action}</span>
                    </td>
                    <td>{h.field || "—"}</td>
                    <td style={{ maxWidth: 220, wordBreak: "break-word" }}>{h.oldValue || "—"}</td>
                    <td style={{ maxWidth: 220, wordBreak: "break-word" }}>{h.newValue || "—"}</td>
                    <td>{h.actor?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paying ? (
        <PaymentModal
          record={record}
          onClose={() => setPaying(false)}
          onSaved={() => {
            setPaying(false);
            setNotice("Payment recorded.");
            load();
          }}
        />
      ) : null}

      {voiding ? (
        <VoidModal
          tx={voiding}
          onClose={() => setVoiding(null)}
          onSaved={() => {
            setVoiding(null);
            setNotice("Payment voided — balance updated.");
            load();
          }}
        />
      ) : null}

      {editing ? (
        <RecordFormModal
          record={record}
          categories={categories}
          projects={projects}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice("Record updated.");
            load();
          }}
        />
      ) : null}
    </>
  );
}

function PaymentModal({ record, onClose, onSaved }) {
  const [form, setForm] = useState({ amount: "", method: "CASH", reference: "", note: "", paidAt: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/financial-records/${record.id}/payments`, {
        amount: form.amount,
        method: form.method,
        reference: form.reference || undefined,
        note: form.note || undefined,
        paidAt: form.paidAt || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record payment — ${record.code}`} onClose={onClose}>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        <Field label="Amount (৳)" required>
          <input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required autoFocus />
        </Field>
        <Field label="Method" required>
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {["CASH", "BANK", "CHEQUE", "ONLINE", "OTHER"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference / receipt no" full>
          <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Bank txn id, receipt number — blocks duplicate submission" />
        </Field>
        <Field label="Paid at">
          <input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
        </Field>
        <Field label="Note">
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. 1st installment" />
        </Field>
        <div className="field--full btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : "Record payment"}
          </button>
        </div>
      </form>
    </Modal>
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
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} rows={2} placeholder="Why is this payment being voided? The row is preserved in history." />
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
