import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, post, patch, qs, money, dateOnly } from "../api.js";
import { Alert, Badge, Empty, Field, Modal, Pagination } from "../ui.jsx";

export default function RecordsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState({ search: "", projectId: "", categoryId: "", status: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    get("/projects/dropdown").then((d) => setProjects(d.data)).catch(() => {});
    get("/categories/dropdown").then((d) => setCategories(d.data)).catch(() => {});
  }, []);

  async function load() {
    setError("");
    try {
      const data = await get(`/financial-records${qs({ ...query, page, pageSize: 10, sortBy: "createdAt", sortDir: "desc" })}`);
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
          <h1 className="admin-title">Financial Records</h1>
          <p className="admin-subtitle">Sales, receivables and their payment progress.</p>
        </div>
        <div className="admin-toolbar__actions">
          <button className="btn btn--gold" onClick={() => setCreating(true)}>
            + New record
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
            placeholder="Code, title or party…"
            value={query.search}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, search: e.target.value });
            }}
          />
        </div>
        <Field label="Project">
          <select
            value={query.projectId}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, projectId: e.target.value });
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select
            value={query.categoryId}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, categoryId: e.target.value });
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={query.status}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, status: e.target.value });
            }}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
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
          <Empty>No financial records found.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title / Party</th>
                  <th>Project</th>
                  <th>Category</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Remaining</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/admin/records/${r.id}`)}>
                    <td>
                      <Link to={`/admin/records/${r.id}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{r.code}</strong>
                      </Link>
                    </td>
                    <td>
                      <div>{r.title}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{r.partyName}</div>
                    </td>
                    <td>{r.project?.name}</td>
                    <td>{r.category?.name}</td>
                    <td className="num">{money(r.totalAmount)}</td>
                    <td className="num">{money(r.paidAmount)}</td>
                    <td className="num">
                      <strong>{money(r.remainingAmount)}</strong>
                    </td>
                    <td>
                      <Badge value={r.status} />
                    </td>
                    <td>{dateOnly(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={meta} onPage={setPage} />
      </div>

      {creating ? (
        <RecordFormModal
          projects={projects}
          categories={categories}
          onClose={() => setCreating(false)}
          onSaved={(record) => {
            setCreating(false);
            navigate(`/admin/records/${record.id}`);
          }}
        />
      ) : null}
    </>
  );
}

export function RecordFormModal({ projects, categories, record, fixedProjectId, onClose, onSaved }) {
  const [form, setForm] = useState(
    record
      ? {
          title: record.title,
          partyName: record.partyName,
          partyPhone: record.partyPhone || "",
          description: record.description || "",
          categoryId: record.categoryId,
          totalAmount: record.totalAmount,
        }
      : { title: "", partyName: "", partyPhone: "", description: "", categoryId: "", totalAmount: "", projectId: "" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let saved;
      if (record) {
        saved = await patch(`/financial-records/${record.id}`, form);
      } else {
        saved = await post("/financial-records", {
          ...form,
          projectId: fixedProjectId || form.projectId,
        });
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={record ? `Edit ${record.code}` : "New financial record"} onClose={onClose} wide>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        {!record && !fixedProjectId ? (
          <Field label="Project" required full>
            <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Title" required full>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Plot GV-A-014 sale" />
        </Field>
        <Field label="Party / buyer name" required>
          <input value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} required />
        </Field>
        <Field label="Party phone">
          <input value={form.partyPhone} onChange={(e) => setForm({ ...form, partyPhone: e.target.value })} placeholder="+880…" />
        </Field>
        <Field label="Category" required>
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Total amount (৳)" required>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.totalAmount}
            onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            required
            placeholder="e.g. 1250000.50"
          />
        </Field>
        <Field label="Description" full>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </Field>
        <div className="field--full btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : record ? "Save changes" : "Create record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
