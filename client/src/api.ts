import type { Board, Category, Task, User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";
let token: string | null = localStorage.getItem("token");

export const hasToken = () => !!token;
export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

async function req<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(data?.error ?? "Something went wrong. Try again");
  return data as T;
}

type AuthResult = { token: string; user: User };

export const api = {
  register: (name: string, email: string, password: string) =>
    req<AuthResult>("/auth/register", "POST", { name, email, password }),
  login: (email: string, password: string) =>
    req<AuthResult>("/auth/login", "POST", { email, password }),
  me: () => req<{ user: User }>("/auth/me"),

  boards: () => req<Board[]>("/boards"),
  createBoard: (title: string, color: string) =>
    req<Board>("/boards", "POST", { title, color }),
  board: (id: string) => req<{ board: Board; tasks: Task[] }>(`/boards/${id}`),
  deleteBoard: (id: string) => req<null>(`/boards/${id}`, "DELETE"),

  addCategory: (boardId: string, name: string, color: string) =>
    req<Category>(`/boards/${boardId}/categories`, "POST", { name, color }),
  deleteCategory: (boardId: string, catId: string) =>
    req<null>(`/boards/${boardId}/categories/${catId}`, "DELETE"),

  createTask: (boardId: string, title: string, status: string) =>
    req<Task>(`/boards/${boardId}/tasks`, "POST", { title, status }),
  updateTask: (id: string, changes: Partial<Task>) =>
    req<Task>(`/tasks/${id}`, "PATCH", changes),
  deleteTask: (id: string) => req<null>(`/tasks/${id}`, "DELETE"),
};
