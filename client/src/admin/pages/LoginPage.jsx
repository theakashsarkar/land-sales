import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../AuthContext.jsx";
import { Alert } from "../ui.jsx";

export default function LoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__logo">B</div>
        <h1 className="admin-login__title">Welcome back</h1>
        <p className="admin-login__sub">Sign in to the Bhumi Landmarks management console.</p>
        <Alert onDismiss={() => setError("")}>{error}</Alert>
        <form onSubmit={onSubmit}>
          <div className="admin-login__field">
            <label>
              Email <em>*</em>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="admin-login__field">
            <label>
              Password <em>*</em>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn--primary btn--block" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="admin-login__foot">Protected area — authorized staff only.</div>
      </div>
    </div>
  );
}
