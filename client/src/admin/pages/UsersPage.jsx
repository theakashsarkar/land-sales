import { useEffect, useState } from "react";
import { get, patch, post, qs, dateOnly } from "../api.js";
import { Alert, Badge, Empty, Field, Modal, Pagination, confirmThen } from "../ui.jsx";

const EMPTY_FORM = { name: "", email: "", password: "", role: "USER" };

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [query, setQuery] = useState({ search: "", role: "", isActive: "" });
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null); // null | {} | user
  const [passwordFor, setPasswordFor] = useState(null);

  async function load() {
    setError("");
    try {
      const data = await get(`/users${qs({ ...query, page, pageSize: 10 })}`);
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

  async function toggleStatus(u) {
    try {
      await patch(`/users/${u.id}/status`, { isActive: !u.isActive });
      setNotice(`${u.name} ${u.isActive ? "deactivated" : "activated"}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <h1 className="admin-title">Users</h1>
          <p className="admin-subtitle">Manage staff accounts and roles.</p>
        </div>
        <div className="admin-toolbar__actions">
          <button className="btn btn--gold" onClick={() => setEditing({ ...EMPTY_FORM })}>
            + New user
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
            placeholder="Name or email…"
            value={query.search}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, search: e.target.value });
            }}
          />
        </div>
        <Field label="Role">
          <select
            value={query.role}
            onChange={(e) => {
              setPage(1);
              setQuery({ ...query, role: e.target.value });
            }}
          >
            <option value="">All roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="USER">User</option>
          </select>
        </Field>
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
          <Empty>No users found.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <Badge value={u.role} />
                    </td>
                    <td>
                      <Badge value={u.isActive ? "ACTIVE" : "CANCELLED"} />
                    </td>
                    <td>{dateOnly(u.createdAt)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="btn btn--outline btn--sm" onClick={() => setEditing(u)}>
                          Edit
                        </button>
                        <button className="btn btn--outline btn--sm" onClick={() => setPasswordFor(u)}>
                          Password
                        </button>
                        <button className="btn btn--sm btn--danger" onClick={confirmThen(`Change status of ${u.name}?`, () => toggleStatus(u))}>
                          {u.isActive ? "Deactivate" : "Activate"}
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
        <UserFormModal
          user={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("User saved.");
            load();
          }}
        />
      ) : null}

      {passwordFor ? (
        <PasswordModal
          user={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={() => {
            setPasswordFor(null);
            setNotice("Password updated — all their sessions were revoked.");
          }}
        />
      ) : null}
    </>
  );
}

function UserFormModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState(
    user ? { name: user.name, email: user.email, role: user.role } : { ...EMPTY_FORM },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (user) {
        await patch(`/users/${user.id}`, { name: form.name, email: form.email, role: form.role });
      } else {
        await post("/users", form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={user ? `Edit ${user.name}` : "New user"} onClose={onClose}>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        <Field label="Name" required full>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Email" required>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Role" required>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="USER">User</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </Field>
        {!user ? (
          <Field label="Password" required>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required
              placeholder="min 8 characters"
            />
          </Field>
        ) : null}
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

function PasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await patch(`/users/${user.id}/password`, { password });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Set password — ${user.name}`} onClose={onClose}>
      <Alert onDismiss={() => setError("")}>{error}</Alert>
      <form onSubmit={submit} className="form-grid">
        <Field label="New password" required full>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required placeholder="min 8 characters" />
        </Field>
        <div className="field--full btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn--outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
