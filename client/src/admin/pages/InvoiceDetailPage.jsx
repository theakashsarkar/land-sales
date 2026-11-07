import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get, post, money, dateOnly, dateTime } from "../api.js";
import { Alert, Badge, Empty } from "../ui.jsx";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    get(`/invoices/${id}`)
      .then(setInvoice)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error && !invoice) return <Alert>{error}</Alert>;
  if (!invoice) return <div className="table-empty">Loading…</div>;

  const isReceipt = invoice.type === "RECEIPT";

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <div style={{ marginBottom: 6, fontSize: 13 }}>
            <Link to="/admin/invoices">← All invoices</Link>
          </div>
          <h1 className="admin-title">
            {isReceipt ? "Money Receipt" : "Invoice"} — {invoice.number}
          </h1>
          <p className="admin-subtitle">
            Issued {dateOnly(invoice.issueDate)}
            {invoice.dueDate ? ` · Due ${dateOnly(invoice.dueDate)}` : ""}
          </p>
        </div>
        <div className="admin-toolbar__actions">
          <a className="btn btn--gold" href={`/api/v1/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer" style={{ display: "inline-flex" }}>
            Download PDF
          </a>
          {invoice.status === "ISSUED" ? (
            <button
              className="btn btn--sm btn--danger"
              onClick={async () => {
                const reason = window.prompt("Cancellation reason:");
                if (!reason || reason.trim().length < 3) return;
                try {
                  const res = await post(`/invoices/${invoice.id}/cancel`, { reason });
                  setInvoice(res);
                  setNotice("Invoice cancelled — document preserved.");
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Cancel invoice
            </button>
          ) : null}
        </div>
      </div>

      <Alert kind="error" onDismiss={() => setError("")}>
        {error}
      </Alert>
      <Alert kind="success" onDismiss={() => setNotice("")}>
        {notice}
      </Alert>

      <div className="admin-card" style={{ marginBottom: 26 }}>
        <div className="admin-card__head">
          <h2 className="admin-card__title">Details</h2>
          <Badge value={invoice.status} />
        </div>
        <div className="admin-card__body kv-grid">
          <KV label="Party" value={invoice.partyName} />
          <KV label="Phone" value={invoice.partyPhone || "—"} />
          <KV label="Project" value={`${invoice.projectTitle} (${invoice.projectCode})`} />
          <KV label="Category" value={invoice.categoryTitle} />
          <KV label="Record" value={invoice.recordCode} />
          {invoice.transactionId ? <KV label="Linked payment" value={invoice.transactionId.slice(0, 10) + "…"} /> : null}
          {invoice.cancelledAt ? (
            <>
              <KV label="Cancelled at" value={dateTime(invoice.cancelledAt)} />
              <KV label="Cancel reason" value={invoice.cancelReason} />
            </>
          ) : null}
          {invoice.notes ? <KV label="Notes" value={invoice.notes} /> : null}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__head">
          <h2 className="admin-card__title">Line items</h2>
        </div>
        {invoice.items.length === 0 ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it, i) => (
                  <tr key={it.id}>
                    <td>{i + 1}</td>
                    <td>{it.description}</td>
                    <td className="num">{Number(it.quantity)}</td>
                    <td className="num">{money(it.unitPrice)}</td>
                    <td className="num">{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>
                    Subtotal
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {money(invoice.subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 700, color: "var(--forest)" }}>
                    Total
                  </td>
                  <td className="num" style={{ fontWeight: 700, color: "var(--forest)", fontSize: 15.5 }}>
                    {money(invoice.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function KV({ label, value }) {
  return (
    <div>
      <div className="kv__label">{label}</div>
      <div className="kv__value">{value}</div>
    </div>
  );
}
