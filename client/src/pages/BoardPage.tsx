import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Topbar } from "../components";
import { Board, COLUMNS, LABELS, Label, Status, Task } from "../types";

const byOrder = (a: Task, b: Task) => a.order - b.order;

export default function BoardPage() {
  const { id = "" } = useParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const load = useCallback(() => {
    api
      .board(id)
      .then((r) => {
        setBoard(r.board);
        setTasks(r.tasks);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function addTask(status: Status, title: string) {
    const t = await api.createTask(id, title, status);
    setTasks((ts) => [...ts, t]);
  }

  // Moves a task to a column, placing it before `beforeId` (or at the end)
  function moveTask(taskId: string, status: Status, beforeId?: string) {
    const col = tasks
      .filter((t) => t.status === status && t._id !== taskId)
      .sort(byOrder);
    let order: number;
    if (beforeId) {
      const i = col.findIndex((t) => t._id === beforeId);
      if (i < 0) return;
      order =
        i > 0 ? (col[i - 1].order + col[i].order) / 2 : col[i].order - 1000;
    } else {
      order = col.length ? col[col.length - 1].order + 1000 : 1000;
    }
    setTasks((ts) =>
      ts.map((t) => (t._id === taskId ? { ...t, status, order } : t)),
    );
    api.updateTask(taskId, { status, order }).catch(load); // reload if the save fails
  }

  async function saveTask(t: Task) {
    const saved = await api.updateTask(t._id, {
      title: t.title,
      description: t.description,
      label: t.label,
    });
    setTasks((ts) => ts.map((x) => (x._id === saved._id ? saved : x)));
    setEditing(null);
  }

  async function removeTask(t: Task) {
    await api.deleteTask(t._id);
    setTasks((ts) => ts.filter((x) => x._id !== t._id));
    setEditing(null);
  }

  if (error)
    return (
      <>
        <Topbar />
        <main className="page">
          <p className="error">{error}</p>
          <Link to="/">Back to your boards</Link>
        </main>
      </>
    );
  if (!board)
    return (
      <>
        <Topbar />
        <div className="splash">Loading…</div>
      </>
    );

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <>
      <Topbar />
      <main
        className="board-page"
        style={{ ["--board" as string]: board.color }}
      >
        <div className="board-head">
          <Link to="/" className="back">
            ‹ Boards
          </Link>
          <h1>{board.title}</h1>
          <div className="progress" title={`${done} of ${tasks.length} done`}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span>{pct}% done</span>
          </div>
        </div>

        <div className="columns">
          {COLUMNS.map((col) => {
            const items = tasks
              .filter((t) => t.status === col.id)
              .sort(byOrder);
            return (
              <section
                key={col.id}
                className={`column c-${col.id}${overCol === col.id ? " over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setOverCol(null);
                }}
                onDrop={() => {
                  if (dragId) moveTask(dragId, col.id);
                  setOverCol(null);
                  setDragId(null);
                }}
              >
                <h2>
                  <span className="dot" />
                  {col.name}
                  <em>{items.length}</em>
                </h2>

                <div className="cards">
                  {items.map((t) => (
                    <article
                      key={t._id}
                      className={`card${dragId === t._id ? " dragging" : ""}`}
                      draggable
                      onDragStart={() => setDragId(t._id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        if (dragId) moveTask(dragId, col.id, t._id);
                        setOverCol(null);
                        setDragId(null);
                      }}
                      onClick={() => setEditing(t)}
                    >
                      {t.label !== "none" && (
                        <span className={`chip l-${t.label}`}>{t.label}</span>
                      )}
                      <p>{t.title}</p>
                      {t.description && (
                        <span className="has-desc">Has notes</span>
                      )}
                    </article>
                  ))}
                  {items.length === 0 && (
                    <p className="col-empty">Drop a card here</p>
                  )}
                </div>

                <AddTask onAdd={(title) => addTask(col.id, title)} />
              </section>
            );
          })}
        </div>
      </main>

      {editing && (
        <EditModal
          task={editing}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={removeTask}
        />
      )}
    </>
  );
}

function AddTask({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd(title);
    setTitle("");
  }
  return (
    <form className="add-task" onSubmit={submit}>
      <input
        placeholder="Add a task"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
      />
    </form>
  );
}

function EditModal({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const [draft, setDraft] = useState(task);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.title.trim()) onSave(draft);
        }}
      >
        <h3>Edit task</h3>
        <label>
          Title
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            maxLength={120}
            autoFocus
          />
        </label>
        <label>
          Notes
          <textarea
            rows={4}
            value={draft.description}
            placeholder="Add details, links or a checklist"
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            maxLength={1000}
          />
        </label>
        <div className="label-pick" role="radiogroup" aria-label="Label">
          {LABELS.map((l: Label) => (
            <button
              type="button"
              key={l}
              role="radio"
              aria-checked={draft.label === l}
              className={`chip l-${l}${draft.label === l ? " on" : ""}`}
              onClick={() => setDraft({ ...draft, label: l })}
            >
              {l === "none" ? "No label" : l}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn danger"
            onClick={() => onDelete(task)}
          >
            Delete task
          </button>
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save changes</button>
        </div>
      </form>
    </div>
  );
}
