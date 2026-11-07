import { NavLink, useNavigate } from "react-router-dom";
import Icon from "../components/Icons.jsx";
import { useAdminAuth } from "./AuthContext.jsx";

const NAV = [
  { to: "/admin", icon: "home", label: "Dashboard", end: true },
  { label: "Management" },
  { to: "/admin/users", icon: "users", label: "Users", adminOnly: true },
  { to: "/admin/projects", icon: "building", label: "Projects" },
  { to: "/admin/categories", icon: "tag", label: "Categories" },
  { label: "Finance" },
  { to: "/admin/records", icon: "layers", label: "Financial Records" },
  { to: "/admin/transactions", icon: "scale", label: "Transactions" },
  { to: "/admin/invoices", icon: "file", label: "Invoices & Receipts" },
  { to: "/admin/reports", icon: "trend", label: "Reports" },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  const visible = NAV.filter((item) => !item.adminOnly || user?.role === "SUPER_ADMIN");

  return (
    <div className="admin">
      <div className="admin__shell">
        <aside className="admin__sidebar" id="admin-sidebar">
          <div className="admin__brand">
            <div className="admin__brand-logo">B</div>
            <div>
              <div className="admin__brand-name">Bhumi Landmarks</div>
              <div className="admin__brand-sub">Management</div>
            </div>
          </div>
          <nav className="admin__nav">
            {visible.map((item) =>
              item.label && !item.to ? (
                <div key={item.label} className="admin__nav-label">
                  {item.label}
                </div>
              ) : (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  <Icon name={item.icon} size={17} />
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
          <div className="admin__sidebar-foot">© {new Date().getFullYear()} Bhumi Landmarks Ltd.</div>
        </aside>

        <div className="admin__main">
          <header className="admin__topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                className="admin__hamburger"
                aria-label="Toggle menu"
                onClick={() => document.getElementById("admin-sidebar")?.classList.toggle("open")}
              >
                <Icon name="menu" size={18} />
              </button>
              <strong style={{ fontFamily: "var(--font-serif)", fontSize: 17 }}>Management Console</strong>
            </div>
            <div className="admin__topbar-user">
              <div className="admin__avatar">
                {(user?.name || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <div className="admin__user-name">{user?.name}</div>
                <div className="admin__user-role">{user?.role === "SUPER_ADMIN" ? "Super Admin" : "User"}</div>
              </div>
              <button className="btn btn--outline btn--sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </header>
          <div className="admin__content">{children}</div>
        </div>
      </div>
    </div>
  );
}
