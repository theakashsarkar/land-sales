import { useEffect, useState } from "react";
import { get, patch, post, qs, dateOnly } from "../api.js";
import { Alert, Badge, Empty, Field, Modal, Pagination, confirmThen } from "../ui.jsx";

export default function CategoriesPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [query, setQuery] = useState({ search: "", isActive: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  async function load() {
    setError("");
    try {
      const data = await get(`/categories${qs({ ...query, page, pageSize: 10 })}`);
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

  async function toggleStatus(c) {
    try {
      await patch(`/categories/${c.id}/status`, { isActive: !c.isActive });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <h1 className="admin-title">Categories</h1>
          <p className="admin-subtitle">Transaction categories such as plot sale, installment, fees.</p>
        </div>
        <div className="admin-toolbar__actions">
          <button className="btn btn--gold" onClick={() => setEditing({ name: "", description: "" })}>
            + New category
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
            placeholder="Category name…"
            value={query.search}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, search: e.target.value });
            }}
          />
        </div>
        <Field label="Status">
          <select
            value={query.isActive}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, isActive: e.target.value });
            }}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
      </div>

      <div className="admin-card">
        {rows.length === 0 ? (
          <Empty>No categories yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.description || "—"}</td>
                    <td>
                      <Badge value={c.isActive ? "ACTIVE" : "CANCELLED"} />
                    </td>
                    <td>{dateOnly(c.createdAt)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="btn btn--outline btn--sm" onClick={() => setEditing(c)}>
                          Edit
                        </button>
                        <button className="btn btn--sm btn--danger" onClick={confirmThen(`Change status of ${c.name}?`, () => toggleStatus(c))}>
                          {c.isActive ? "Deactivate" : "Activate"}
                        </button>
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

      {editing ? (
        <CategoryFormModal
          category={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </>
  );
}

function CategoryFormModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState(
    category ? { name: category.name, description: category.description || "" } : { name: "", description: "" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (category) await patch(`/categories/${category.id}`, form);
      else await post("/categories", form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={category ? `Edit ${category.name}` : "New category"} onClose={onClose}>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        <Field label="Name" required full>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Description" full>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </Field>
        <div className="field--full btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
