import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-hero">
        <div className="brand big">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          Tablero
        </div>
        <h1>Move work from to&nbsp;do to done.</h1>
        <p>Boards, columns and cards. Nothing else in the way.</p>

        <div className="mini-board" aria-hidden="true">
          <div className="mini-col c-todo">
            <span className="mini-card">Draft the pitch</span>
            <span className="mini-card">Pick a color palette</span>
          </div>
          <div className="mini-col c-doing">
            <span className="mini-card tilt">Build the API</span>
          </div>
          <div className="mini-col c-done">
            <span className="mini-card">Design the logo</span>
            <span className="mini-card">Set up the repo</span>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <form onSubmit={submit} className="auth-form">
          <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>
          {!isLogin && (
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary wide" disabled={busy}>
            {busy ? "One moment…" : isLogin ? "Sign in" : "Create account"}
          </button>
          <p className="switch">
            {isLogin ? "New here? " : "Already have an account? "}
            <Link to={isLogin ? "/register" : "/login"}>
              {isLogin ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
