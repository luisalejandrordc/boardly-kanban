import { Link } from "react-router-dom";
import { useAuth } from "./auth";

export function Topbar({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        Boardly
      </Link>
      <div className="topbar-mid">{children}</div>
      <div className="topbar-user">
        <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
        <span className="who">{user?.name}</span>
        <button className="btn ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
