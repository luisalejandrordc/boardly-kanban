import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Topbar } from "../components";
import { launchConfetti } from "../confetti";
import {
  Board,
  CATEGORY_COLORS,
  Category,
  COLUMNS,
  Status,
  Task,
} from "../types";

const byOrder = (a: Task, b: Task) => a.order - b.order;

/* ---------- helpers ---------- */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dueInfo(t: Task) {
  if (!t.dueDate) return null;
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 864e5));
  const [y, m, d] = t.dueDate.split("-").map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  let tone = "";
  let label =
    t.dueDate === today ? "Today" : t.dueDate === tomorrow ? "Tomorrow" : text;
  if (t.status !== "done") {
    if (t.dueDate < today) {
      tone = "late";
      label = `Overdue ${text}`;
    } else if (t.dueDate <= tomorrow) tone = "soon";
  }
  return { label, tone };
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

function useEscape(fn: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && fn();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fn]);
}

// key={id} resets all state when switching boards
export default function BoardPage() {
  const { id = "" } = useParams();
  return <BoardView key={id} id={id} />;
}

function BoardView({ id }: { id: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [managing, setManaging] = useState(false);
  const [filters, setFilters] = useState<string[]>([]);
  const [toast, setToast] = useState<{
    text: string;
    kind: "ok" | "error";
  } | null>(null);
  const timer = useRef<number>();
  const prevPct = useRef<number | null>(null);

  function notify(text: string, kind: "ok" | "error" = "ok") {
    setToast({ text, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }

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

  const categories = board?.categories ?? [];
  const catMap = useMemo(
    () => new Map<string, Category>(categories.map((c) => [c._id, c])),
    [categories],
  );

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const remaining = tasks
    .filter((t) => t.status !== "done")
    .reduce((s, t) => s + (t.estimateMinutes ?? 0), 0);

  // Celebrate when the board reaches 100% (not when it simply loads at 100%)
  useEffect(() => {
    if (!board) return;
    if (prevPct.current !== null && prevPct.current < 100 && pct === 100) {
      launchConfetti();
      notify("Every task is done. Nice work!");
    }
    prevPct.current = pct;
  }, [pct, board]);

  const visible = (t: Task) =>
    filters.length === 0 ||
    (t.category !== null && filters.includes(t.category));
  const toggleFilter = (cid: string) =>
    setFilters((f) =>
      f.includes(cid) ? f.filter((x) => x !== cid) : [...f, cid],
    );

  /* ----- tasks ----- */
  async function addTask(status: Status, title: string) {
    try {
      const t = await api.createTask(id, title, status);
      setTasks((ts) => [...ts, t]);
    } catch (e) {
      notify((e as Error).message, "error");
    }
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
    api.updateTask(taskId, { status, order }).catch(load);
  }

  async function saveTask(t: Task) {
    try {
      const saved = await api.updateTask(t._id, {
        title: t.title,
        description: t.description,
        category: t.category,
        dueDate: t.dueDate,
        estimateMinutes: t.estimateMinutes,
      });
      setTasks((ts) => ts.map((x) => (x._id === saved._id ? saved : x)));
      setEditing(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function removeTask(t: Task) {
    try {
      await api.deleteTask(t._id);
      setTasks((ts) => ts.filter((x) => x._id !== t._id));
      setEditing(null);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  /* ----- categories ----- */
  async function addCategory(name: string, color: string) {
    const c = await api.addCategory(id, name, color);
    setBoard((b) => b && { ...b, categories: [...(b.categories ?? []), c] });
  }
  async function deleteCategory(catId: string) {
    await api.deleteCategory(id, catId);
    setBoard(
      (b) =>
        b && {
          ...b,
          categories: (b.categories ?? []).filter((c) => c._id !== catId),
        },
    );
    setTasks((ts) =>
      ts.map((t) => (t.category === catId ? { ...t, category: null } : t)),
    );
    setFilters((f) => f.filter((x) => x !== catId));
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
            {remaining > 0 && (
              <span className="remaining">{fmtDuration(remaining)} left</span>
            )}
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span>{pct === 100 ? "Complete" : `${pct}% done`}</span>
          </div>
        </div>

        <div className="filters">
          {categories.length > 0 && (
            <span className="filters-hint">Filter by</span>
          )}
          {categories.map((c) => {
            const on = filters.includes(c._id);
            return (
              <button
                key={c._id}
                className={`chip cat${on ? " on" : ""}`}
                aria-pressed={on}
                style={{ ["--c" as string]: c.color }}
                onClick={() => toggleFilter(c._id)}
              >
                {c.name}{" "}
                <small>
                  {tasks.filter((t) => t.category === c._id).length}
                </small>
              </button>
            );
          })}
          {filters.length > 0 && (
            <button className="btn ghost small" onClick={() => setFilters([])}>
              Clear filter
            </button>
          )}
          <button className="btn ghost small" onClick={() => setManaging(true)}>
            {categories.length ? "Manage categories" : "Add a category"}
          </button>
        </div>

        <div className="columns">
          {COLUMNS.map((col) => {
            const items = tasks
              .filter((t) => t.status === col.id)
              .sort(byOrder);
            const shown = items.filter(visible);
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
                  <em>
                    {filters.length
                      ? `${shown.length} of ${items.length}`
                      : items.length}
                  </em>
                </h2>

                <div className="cards">
                  {shown.map((t) => {
                    const cat = t.category ? catMap.get(t.category) : undefined;
                    const due = dueInfo(t);
                    return (
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
                        {cat && (
                          <span
                            className="chip cat"
                            style={{ ["--c" as string]: cat.color }}
                          >
                            {cat.name}
                          </span>
                        )}
                        <p>{t.title}</p>
                        {(due || t.estimateMinutes || t.description) && (
                          <div className="card-meta">
                            {due && (
                              <span className={`pill ${due.tone}`}>
                                {due.label}
                              </span>
                            )}
                            {t.estimateMinutes && (
                              <span className="pill">
                                {fmtDuration(t.estimateMinutes)}
                              </span>
                            )}
                            {t.description && (
                              <span className="pill quiet">Has notes</span>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  <p className="col-empty">
                    {items.length > 0
                      ? "No tasks match this filter"
                      : "Drop a card here"}
                  </p>
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
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={removeTask}
        />
      )}
      {managing && (
        <CategoryModal
          categories={categories}
          onAdd={addCategory}
          onDelete={deleteCategory}
          onClose={() => setManaging(false)}
        />
      )}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.text}
        </div>
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
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  categories: Category[];
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const [draft, setDraft] = useState(task);
  const [hours, setHours] = useState(
    task.estimateMinutes ? String(Math.floor(task.estimateMinutes / 60)) : "",
  );
  const [mins, setMins] = useState(
    task.estimateMinutes ? String(task.estimateMinutes % 60) : "",
  );
  useEscape(onClose);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const total = Math.min(
      (Number(hours) || 0) * 60 + (Number(mins) || 0),
      9999,
    );
    onSave({ ...draft, estimateMinutes: total > 0 ? total : null });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
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
            rows={3}
            value={draft.description}
            placeholder="Add details, links or a checklist"
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            maxLength={1000}
          />
        </label>

        <div className="field">
          <span className="field-name">Category</span>
          <div className="chip-row" role="radiogroup" aria-label="Category">
            <button
              type="button"
              role="radio"
              aria-checked={draft.category === null}
              className={`chip${draft.category === null ? " on" : ""}`}
              onClick={() => setDraft({ ...draft, category: null })}
            >
              None
            </button>
            {categories.map((c) => (
              <button
                type="button"
                key={c._id}
                role="radio"
                aria-checked={draft.category === c._id}
                className={`chip cat${draft.category === c._id ? " on" : ""}`}
                style={{ ["--c" as string]: c.color }}
                onClick={() => setDraft({ ...draft, category: c._id })}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="two-col">
          <label>
            Due date (optional)
            <input
              type="date"
              value={draft.dueDate ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, dueDate: e.target.value || null })
              }
            />
          </label>
          <div className="field">
            <span className="field-name">Estimated time (optional)</span>
            <div className="duration">
              <input
                type="number"
                min={0}
                max={166}
                placeholder="0"
                aria-label="Hours"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />{" "}
              h
              <input
                type="number"
                min={0}
                max={59}
                placeholder="0"
                aria-label="Minutes"
                value={mins}
                onChange={(e) => setMins(e.target.value)}
              />{" "}
              min
            </div>
          </div>
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

function CategoryModal({
  categories,
  onAdd,
  onDelete,
  onClose,
}: {
  categories: Category[];
  onAdd: (name: string, color: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [error, setError] = useState("");
  useEscape(onClose);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onAdd(name, color);
      setName("");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function remove(c: Category) {
    if (
      !confirm(
        `Delete the "${c.name}" category? Tasks keep existing but lose this category.`,
      )
    )
      return;
    try {
      await onDelete(c._id);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Categories</h3>
        <ul className="cat-list">
          {categories.length === 0 && (
            <li className="empty-line">
              No categories yet. Add your first one below.
            </li>
          )}
          {categories.map((c) => (
            <li key={c._id}>
              <span className="chip cat" style={{ ["--c" as string]: c.color }}>
                {c.name}
              </span>
              <button className="btn danger small" onClick={() => remove(c)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
        <form className="cat-form" onSubmit={submit}>
          <input
            placeholder="New category, like “Research”"
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
          />
          <div
            className="swatches"
            role="radiogroup"
            aria-label="Category color"
          >
            {CATEGORY_COLORS.map((c) => (
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
          <button className="btn primary">Add category</button>
        </form>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <span className="grow" />
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
