import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, hasToken, setToken } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasToken());

  // Restore the session from the saved token
  useEffect(() => {
    if (!hasToken()) return;
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const accept = (r: { token: string; user: User }) => {
    setToken(r.token);
    setUser(r.user);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        login: async (e, p) => accept(await api.login(e, p)),
        register: async (n, e, p) => accept(await api.register(n, e, p)),
        logout: () => {
          setToken(null);
          setUser(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
