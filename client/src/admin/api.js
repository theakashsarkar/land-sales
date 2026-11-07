// Admin API client — talks to the backend at /api/v1 (proxied to :4001 in dev).
// Access token lives in memory/localStorage; refresh happens via the
// httpOnly cookie with a single automatic retry on 401.

const BASE = "/api/v1";
const TOKEN_KEY = "bhumilandmarks.admin.token";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

let refreshing = null;

async function tryRefresh() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  }).finally(() => {
    setTimeout(() => (refreshing = null), 0);
  });
  const res = await refreshing;
  if (!res.ok) return null;
  const data = await res.json();
  setToken(data.accessToken);
  return data;
}

export async function api(path, { method = "GET", body, retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && retry && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
    const refreshed = await tryRefresh();
    if (refreshed) return api(path, { method, body, retry: false });
    setToken(null);
  }

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code || "ERROR",
      data?.error?.message || `Request failed (${res.status})`,
      data?.error?.details,
    );
  }
  return data;
}

/* ------- convenience helpers ------- */

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: "POST", body });
export const patch = (path, body) => api(path, { method: "PATCH", body });
export const put = (path, body) => api(path, { method: "PUT", body });
export const del = (path) => api(path, { method: "DELETE" });

export function qs(params) {
  const clean = Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

/** Download a binary export (pdf/xlsx) with auth header and save it. */
export async function download(path, filename) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, "DOWNLOAD_FAILED", "Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // removing the anchor or revoking the URL immediately can cancel the
  // in-flight download — clean up on a delay
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 30_000);
}

/** BDT money formatter — backend sends 2dp strings. */
export function money(value) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `৳ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateOnly(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
