import { useEffect } from "react";
import Icon from "../components/Icons.jsx";

export function Field({ label, required, full, children }) {
  return (
    <div className={`field${full ? " field--full" : ""}`}>
      <label>
        {label} {required ? <em>*</em> : null}
      </label>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " modal--wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) {
    return meta ? (
      <div className="pagination">
        <span>{meta.total} record(s)</span>
      </div>
    ) : null;
  }
  const pages = [];
  for (let p = 1; p <= meta.totalPages; p++) {
    if (p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return (
    <div className="pagination">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} records
      </span>
      <div className="pagination__pages">
        <button className="page-btn" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          <Icon name="chevron-left" size={14} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`}>…</span>
          ) : (
            <button key={p} className={`page-btn${p === meta.page ? " active" : ""}`} onClick={() => onPage(p)}>
              {p}
            </button>
          ),
        )}
        <button className="page-btn" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </div>
  );
}

const BADGE_KIND = {
  ACTIVE: "green",
  ISSUED: "green",
  VALID: "green",
  SUPER_ADMIN: "gold",
  CANCELLED: "red",
  VOID: "red",
  USER: "muted",
  CASH: "muted",
  BANK: "green",
  CHEQUE: "gold",
  ONLINE: "green",
  OTHER: "muted",
};

export function Badge({ value }) {
  return <span className={`badge badge--${BADGE_KIND[value] || "muted"}`}>{value}</span>;
}

export function Alert({ kind = "error", children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`admin-alert admin-alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss ? (
        <button onClick={onDismiss} aria-label="Dismiss" style={{ fontWeight: 700 }}>
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function Empty({ children = "Nothing here yet." }) {
  return <div className="table-empty">{children}</div>;
}

export function confirmThen(message, fn) {
  return async (...args) => {
    if (!window.confirm(message)) return;
    return fn(...args);
  };
}
