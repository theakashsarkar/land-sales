import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, money, dateTime } from "../api.js";
import { Alert, Badge, Empty } from "../ui.jsx";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <div className="table-empty">Loading dashboard…</div>;

  const { counts, financial, recentTransactions, projectSummaries, categorySummaries } = data;
  const isSuperAdmin = data.role === "SUPER_ADMIN";

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <h1 className="admin-title">Dashboard</h1>
          <p className="admin-subtitle">
            {isSuperAdmin ? "System-wide overview" : "Overview of your assigned projects"}
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Receivable" value={money(financial.totalAmount)} hint={`${financial.activeRecordCount} active record(s)`} />
        <StatCard label="Collected" value={money(financial.totalPaidAmount)} hint="Valid payments only" />
        <StatCard label="Remaining Balance" value={money(financial.totalRemainingAmount)} hint="Total − collected" />
        <StatCard
          label="Projects"
          value={`${counts.projects.active}/${counts.projects.total}`}
          hint="active / total"
        />
        {isSuperAdmin ? (
          <>
            <StatCard label="Users" value={`${counts.users.active}/${counts.users.total}`} hint="active / total" />
            <StatCard label="Categories" value={`${counts.categories.active}/${counts.categories.total}`} hint="active / total" />
          </>
        ) : null}
      </div>

      <div className="admin-card" style={{ marginBottom: 26 }}>
        <div className="admin-card__head">
          <h2 className="admin-card__title">Recent transactions</h2>
          <Link className="btn btn--outline btn--sm" to="/admin/transactions">
            View all
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <Empty>No transactions recorded yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Record</th>
                  <th>Project</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{dateTime(t.paidAt)}</td>
                    <td>
                      <Link to={`/admin/records/${t.financialRecord.id}`}>{t.financialRecord.code}</Link>
                    </td>
                    <td>{t.financialRecord.project?.name}</td>
                    <td>
                      <Badge value={t.method} />
                    </td>
                    <td>
                      <Badge value={t.status} />
                    </td>
                    <td>{t.createdBy?.name}</td>
                    <td className="num">{money(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 26 }}>
        <div className="admin-card">
          <div className="admin-card__head">
            <h2 className="admin-card__title">Project-wise summary</h2>
          </div>
          {projectSummaries.length === 0 ? (
            <Empty>No active financial records yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th className="num">Records</th>
                    <th className="num">Total</th>
                    <th className="num">Paid</th>
                    <th className="num">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {projectSummaries.map((p) => (
                    <tr key={p.project.id}>
                      <td>
                        <strong>{p.project.name}</strong>{" "}
                        <span style={{ color: "var(--muted)", fontSize: 12.5 }}>({p.project.code})</span>
                      </td>
                      <td className="num">{p.recordCount}</td>
                      <td className="num">{money(p.totalAmount)}</td>
                      <td className="num">{money(p.paidAmount)}</td>
                      <td className="num">{money(p.remainingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card__head">
            <h2 className="admin-card__title">Category-wise summary</h2>
          </div>
          {categorySummaries.length === 0 ? (
            <Empty>No active financial records yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Records</th>
                    <th className="num">Total</th>
                    <th className="num">Paid</th>
                    <th className="num">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummaries.map((c) => (
                    <tr key={c.category.id}>
                      <td>
                        <strong>{c.category.name}</strong>
                      </td>
                      <td className="num">{c.recordCount}</td>
                      <td className="num">{money(c.totalAmount)}</td>
                      <td className="num">{money(c.paidAmount)}</td>
                      <td className="num">{money(c.remainingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
    </div>
  );
}
