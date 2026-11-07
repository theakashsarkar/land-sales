import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, get, post, setToken, getToken } from "./api.js";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // A stale access token or a valid refresh cookie both count as a session.
      if (!getToken()) {
        try {
          const r = await post("/auth/refresh");
          if (!alive) return;
          setToken(r.accessToken);
        } catch {
          if (alive) {
            setBooting(false);
            return;
          }
        }
      }
      try {
        const me = await get("/auth/me");
        if (alive) setUser(me);
      } catch {
        if (alive) setToken(null);
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password }, retry: false });
    setToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", retry: false });
    } catch {
      /* best effort */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, booting, login, logout }), [user, booting, login, logout]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
