import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Topbar } from "../components";
import { BOARD_COLORS, Board } from "../types";

export default function BoardsPage() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .boards()
      .then(setBoards)
      .catch((e) => setError(e.message));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const b = await api.createBoard(title, color);
      setBoards((bs) => [b, ...(bs ?? [])]);
      setTitle("");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its tasks?`)) return;
    await api.deleteBoard(id);
    setBoards((bs) => bs?.filter((b) => b._id !== id) ?? null);
  }

  return (
    <>
      <Topbar />
      <main className="page">
        <h1 className="page-title">{user?.name.split(" ")[0]}'s boards</h1>

        <form className="new-board" onSubmit={create}>
          <input
            placeholder="Name a new board, like “Final project”"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
          />
          <div className="swatches" role="radiogroup" aria-label="Board color">
            {BOARD_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                role="radio"
                aria-checked={c === color}
                aria-label={c}
                className={c === color ? "swatch on" : "swatch"}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="btn primary">Create board</button>
        </form>
        {error && <p className="error">{error}</p>}

        {boards && boards.length === 0 && (
          <p className="empty">
            You don't have any boards yet. Name one above to get started.
          </p>
        )}

        <div className="board-grid">
          {boards?.map((b) => {
            const c = b.counts ?? { todo: 0, doing: 0, done: 0 };
            const total = c.todo + c.doing + c.done;
            return (
              <article
                key={b._id}
                className="board-card"
                style={{ ["--board" as string]: b.color }}
              >
                <Link to={`/boards/${b._id}`} className="board-link">
                  <h3>{b.title}</h3>
                  <p className="meta">
                    {total === 0
                      ? "No tasks yet"
                      : `${c.done} of ${total} done`}
                  </p>
                  <div className="stack-bar" aria-hidden="true">
                    <span className="s-todo" style={{ flex: c.todo }} />
                    <span className="s-doing" style={{ flex: c.doing }} />
                    <span className="s-done" style={{ flex: c.done }} />
                  </div>
                </Link>
                <button
                  className="icon-btn"
                  aria-label={`Delete ${b.title}`}
                  onClick={() => remove(b._id, b.title)}
                >
                  ×
                </button>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
