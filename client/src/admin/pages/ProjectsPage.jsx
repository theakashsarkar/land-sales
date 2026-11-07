import { useEffect, useState } from "react";
import { get, patch, post, put, del, qs, dateOnly } from "../api.js";
import { Alert, Badge, Empty, Field, Modal, Pagination, confirmThen } from "../ui.jsx";

export default function ProjectsPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [query, setQuery] = useState({ search: "", isActive: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);

  async function load() {
    setError("");
    try {
      const data = await get(`/projects${qs({ ...query, page, pageSize: 10 })}`);
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

  async function toggleStatus(p) {
    try {
      await patch(`/projects/${p.id}/status`, { isActive: !p.isActive });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <h1 className="admin-title">Projects</h1>
          <p className="admin-subtitle">Land projects and staff access.</p>
        </div>
        <div className="admin-toolbar__actions">
          <button className="btn btn--gold" onClick={() => setEditing({ name: "", code: "", description: "", location: "" })}>
            + New project
          </button>
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
            placeholder="Name or code…"
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
          <Empty>No projects yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.description ? (
                        <div style={{ color: "var(--muted)", fontSize: 12.5, maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.description}
                        </div>
                      ) : null}
                    </td>
                    <td>{p.code}</td>
                    <td>{p.location || "—"}</td>
                    <td>
                      <Badge value={p.isActive ? "ACTIVE" : "CANCELLED"} />
                    </td>
                    <td>{dateOnly(p.createdAt)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="btn btn--outline btn--sm" onClick={() => setAssigning(p)}>
                          Users
                        </button>
                        <button className="btn btn--outline btn--sm" onClick={() => setEditing(p)}>
                          Edit
                        </button>
                        <button className="btn btn--sm btn--danger" onClick={confirmThen(`Change status of ${p.name}?`, () => toggleStatus(p))}>
                          {p.isActive ? "Deactivate" : "Activate"}
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
        <ProjectFormModal
          project={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {assigning ? (
        <AssignUsersModal
          project={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            setNotice("Project access updated.");
          }}
        />
      ) : null}
    </>
  );
}

function ProjectFormModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState(
    project
      ? { name: project.name, code: project.code, description: project.description || "", location: project.location || "" }
      : { name: "", code: "", description: "", location: "" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (project) await patch(`/projects/${project.id}`, form);
      else await post("/projects", form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={project ? `Edit ${project.name}` : "New project"} onClose={onClose}>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        <Field label="Name" required>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Code" required>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            placeholder="e.g. GVT"
            pattern="[A-Za-z0-9_\-]{2,20}"
          />
        </Field>
        <Field label="Location" full>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Purbachal, Dhaka" />
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

function AssignUsersModal({ project, onClose }) {
  const [assigned, setAssigned] = useState([]);
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [current, users] = await Promise.all([get(`/projects/${project.id}/users`), get("/users/dropdown")]);
      setAssigned(current.data);
      setAvailable(users.data.filter((u) => !current.data.some((c) => c.id === u.id)));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addUser() {
    if (!selected) return;
    try {
      await post(`/projects/${project.id}/users`, { userIds: [selected] });
      setSelected("");
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeUser(userId) {
    try {
      await del(`/projects/${project.id}/users/${userId}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function replaceAll(userIds) {
    try {
      await put(`/projects/${project.id}/users`, { userIds });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Modal title={`Access — ${project.name}`} onClose={onClose} wide>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <div className="filters">
        <Field label="Add user" full>
          <div className="btn-row">
            <select style={{ flex: 1 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a user…</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            <button className="btn btn--primary btn--sm" onClick={addUser} disabled={!selected}>
              Add
            </button>
          </div>
        </Field>
      </div>

      {assigned.length === 0 ? (
        <Empty>No users assigned — regular users cannot see this project's finances.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Assigned</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>{u.email}</td>
                  <td>{dateOnly(u.assignedAt)}</td>
                  <td>
                    <div className="admin-table__actions">
                      <button className="btn btn--sm btn--danger" onClick={confirmThen(`Remove ${u.name} from ${project.name}?`, () => removeUser(u.id))}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12.5 }}>
        Tip: removing everyone? Use the button below to sync the list to exactly one or more users.
        <div className="btn-row" style={{ marginTop: 8 }}>
          {assigned.length > 0 ? (
            <button className="btn btn--outline btn--sm" onClick={confirmThen("Replace assignments with only… pick none to clear all.", () => replaceAll([]))}>
              Clear all access
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
