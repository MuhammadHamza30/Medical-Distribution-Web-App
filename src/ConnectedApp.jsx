import React, { useState, useEffect } from "react";
import App from "./App.jsx";
import { API_BASE, request, mutateRemote } from "./lib/api.mjs";
import logo from "./assets/pharmaflow-logo.png";
export default function ConnectedApp() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(Boolean(API_BASE)),
    [error, setError] = useState("");
  async function load() {
    try {
      const result = await request("/bootstrap");
      setSession(result);
      setError("");
    } catch (e) {
      if (e.status !== 401) setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (API_BASE) load();
  }, []);
  if (!API_BASE) return <App />;
  const logout = async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {}
    setSession(null);
  };
  const mutation = async (name, args) => {
    try {
      return await mutateRemote(name, args);
    } catch (e) {
      if (e.status === 401) {
        setSession(null);
        setError("Your session expired. Sign in again.");
      }
      throw e;
    }
  };
  if (loading)
    return (
      <div className="login-screen">
        <div className="login-card">
          <img src={logo} alt="PharmaFlow" />
          <p className="muted">Connecting to your distribution workspace…</p>
        </div>
      </div>
    );
  if (session)
    return (
      <App
        initialState={session.state}
        mode="api"
        user={session.user}
        onMutation={mutation}
        onLogout={logout}
      />
    );
  return <Login initialError={error} onLogin={load} />;
}
function Login({ initialError, onLogin }) {
  const [email, setEmail] = useState("admin@pharmaflow.local"),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError);
  useEffect(() => setError(initialError), [initialError]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      if (result.user.role !== "admin") {
        await request("/auth/logout", { method: "POST" });
        throw Error(
          "This frontend workspace requires an administrator account. Other staff roles can use their permitted API endpoints.",
        );
      }
      await onLogin();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <section className="login-card">
        <img src={logo} alt="PharmaFlow" />
        <div className="login-eyebrow">DISTRIBUTION WORKSPACE</div>
        <h1>Welcome back</h1>
        <p className="muted">
          Sign in to manage your stock, credit sales and collections.
        </p>
        <form onSubmit={submit}>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              minLength="1"
              required
            />
          </label>
          <button className="button full-width" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <small>
          Use the administrator credentials printed by{" "}
          <code>npm run setup</code> in the backend folder.
        </small>
      </section>
    </div>
  );
}
