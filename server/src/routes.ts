import { Router } from "express";
import bcrypt from "bcryptjs";
import { isValidObjectId, Types } from "mongoose";
import { User, Board, Task, STATUSES, DEFAULT_CATEGORIES } from "./models";
import { HttpError, requireAuth, signToken, wrap } from "./middleware";

const router = Router();

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const isColor = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const publicUser = (u: { _id: unknown; name: string; email: string }) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
});

async function ownBoard(id: string, userId: string) {
  const board = isValidObjectId(id)
    ? await Board.findOne({ _id: id, owner: userId })
    : null;
  if (!board) throw new HttpError(404, "Board not found");
  return board;
}

/* ---------- Auth ---------- */
router.post(
  "/auth/register",
  wrap(async (req, res) => {
    const name = str(req.body.name, 50);
    const email = str(req.body.email, 120).toLowerCase();
    const password =
      typeof req.body.password === "string" ? req.body.password : "";
    if (!name) throw new HttpError(400, "Enter your name");
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new HttpError(400, "Enter a valid email address");
    if (password.length < 6)
      throw new HttpError(400, "Password must be at least 6 characters");
    if (await User.exists({ email }))
      throw new HttpError(409, "An account with this email already exists");

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
    });
    res
      .status(201)
      .json({ token: signToken(String(user._id)), user: publicUser(user) });
  }),
);

router.post(
  "/auth/login",
  wrap(async (req, res) => {
    const email = str(req.body.email, 120).toLowerCase();
    const password =
      typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      throw new HttpError(401, "Email or password is incorrect");
    res.json({ token: signToken(String(user._id)), user: publicUser(user) });
  }),
);

router.get(
  "/auth/me",
  requireAuth,
  wrap(async (_req, res) => {
    const user = await User.findById(res.locals.userId);
    if (!user) throw new HttpError(401, "Account not found");
    res.json({ user: publicUser(user) });
  }),
);

/* ---------- Boards (everything below needs a signed-in user) ---------- */
router.use(requireAuth);

router.get(
  "/boards",
  wrap(async (_req, res) => {
    const userId = res.locals.userId as string;
    const boards = await Board.find({ owner: userId })
      .sort({ createdAt: -1 })
      .lean();
    const rows = await Task.aggregate<{
      _id: { board: Types.ObjectId; status: string };
      n: number;
    }>([
      { $match: { owner: new Types.ObjectId(userId) } },
      {
        $group: { _id: { board: "$board", status: "$status" }, n: { $sum: 1 } },
      },
    ]);
    const counts: Record<string, Record<string, number>> = {};
    for (const r of rows)
      (counts[String(r._id.board)] ??= {})[r._id.status] = r.n;

    res.json(
      boards.map((b) => ({
        ...b,
        counts: {
          todo: 0,
          doing: 0,
          done: 0,
          ...(counts[String(b._id)] ?? {}),
        },
      })),
    );
  }),
);

router.post(
  "/boards",
  wrap(async (req, res) => {
    const title = str(req.body.title, 60);
    if (!title) throw new HttpError(400, "Give your board a name");
    const board = await Board.create({
      owner: res.locals.userId,
      title,
      color: isColor(req.body.color) ? req.body.color : undefined,
    });
    res
      .status(201)
      .json({ ...board.toObject(), counts: { todo: 0, doing: 0, done: 0 } });
  }),
);

router.get(
  "/boards/:id",
  wrap(async (req, res) => {
    const board = await ownBoard(req.params.id, res.locals.userId);
    if (!board.seeded) {
      board.set("categories", DEFAULT_CATEGORIES);
      board.seeded = true;
      await board.save();
    }
    const tasks = await Task.find({ board: board._id })
      .sort({ order: 1 })
      .lean();
    res.json({ board, tasks });
  }),
);

router.patch(
  "/boards/:id",
  wrap(async (req, res) => {
    const board = await ownBoard(req.params.id, res.locals.userId);
    const title = str(req.body.title, 60);
    if (title) board.title = title;
    if (isColor(req.body.color)) board.color = req.body.color;
    await board.save();
    res.json(board);
  }),
);

router.delete(
  "/boards/:id",
  wrap(async (req, res) => {
    const board = await ownBoard(req.params.id, res.locals.userId);
    await Task.deleteMany({ board: board._id });
    await board.deleteOne();
    res.status(204).end();
  }),
);

/* ---------- Categories ---------- */
router.post(
  "/boards/:id/categories",
  wrap(async (req, res) => {
    const board = await ownBoard(req.params.id, res.locals.userId);
    const name = str(req.body.name, 24);
    if (!name) throw new HttpError(400, "Name your category");
    if (!isColor(req.body.color))
      throw new HttpError(400, "Pick a color for the category");
    if (board.categories.length >= 12)
      throw new HttpError(400, "A board can have up to 12 categories");
    if (
      board.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())
    )
      throw new HttpError(409, "This board already has that category");
    board.categories.push({ name, color: req.body.color });
    board.seeded = true;
    await board.save();
    res.status(201).json(board.categories[board.categories.length - 1]);
  }),
);

router.delete(
  "/boards/:id/categories/:catId",
  wrap(async (req, res) => {
    const board = await ownBoard(req.params.id, res.locals.userId);
    const { catId } = req.params;
    if (
      !isValidObjectId(catId) ||
      !board.categories.some((c) => String(c._id) === catId)
    )
      throw new HttpError(404, "Category not found");
    board.categories.pull({ _id: catId });
    await board.save();
    await Task.updateMany(
      { board: board._id, category: catId },
      { $set: { category: null } },
    );
    res.status(204).end();
  }),
);

/* ---------- Tasks ---------- */
router.post(
  "/boards/:id/tasks",
  wrap(async (req, res) => {
    const board = await ownBoard(req.params.id, res.locals.userId);
    const title = str(req.body.title, 120);
    if (!title) throw new HttpError(400, "Write a title for the task");
    const status = STATUSES.includes(req.body.status)
      ? req.body.status
      : "todo";
    const last = await Task.findOne({ board: board._id, status }).sort({
      order: -1,
    });
    const task = await Task.create({
      board: board._id,
      owner: res.locals.userId,
      title,
      status,
      order: (last?.order ?? 0) + 1000,
    });
    res.status(201).json(task);
  }),
);

router.patch(
  "/tasks/:id",
  wrap(async (req, res) => {
    if (!isValidObjectId(req.params.id))
      throw new HttpError(404, "Task not found");
    const task = await Task.findOne({
      _id: req.params.id,
      owner: res.locals.userId,
    });
    if (!task) throw new HttpError(404, "Task not found");
    const b = req.body;

    if (typeof b.title === "string" && b.title.trim())
      task.set("title", str(b.title, 120));
    if (typeof b.description === "string")
      task.set("description", str(b.description, 1000));
    if (STATUSES.includes(b.status)) task.set("status", b.status);
    if (typeof b.order === "number" && Number.isFinite(b.order))
      task.set("order", b.order);

    if ("category" in b) {
      if (b.category === null) task.set("category", null);
      else {
        const valid =
          isValidObjectId(b.category) &&
          (await Board.exists({
            _id: task.board,
            "categories._id": b.category,
          }));
        if (!valid)
          throw new HttpError(
            400,
            "That category does not exist on this board",
          );
        task.set("category", b.category);
      }
    }
    if ("dueDate" in b) {
      if (b.dueDate === null || b.dueDate === "") task.set("dueDate", null);
      else if (
        typeof b.dueDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) &&
        !isNaN(Date.parse(b.dueDate))
      )
        task.set("dueDate", b.dueDate);
      else throw new HttpError(400, "Enter a valid due date");
    }
    if ("estimateMinutes" in b) {
      if (b.estimateMinutes === null) task.set("estimateMinutes", null);
      else if (
        Number.isInteger(b.estimateMinutes) &&
        b.estimateMinutes >= 1 &&
        b.estimateMinutes <= 9999
      )
        task.set("estimateMinutes", b.estimateMinutes);
      else
        throw new HttpError(
          400,
          "Estimated time must be between 1 minute and 166 hours",
        );
    }

    await task.save();
    res.json(task);
  }),
);

router.delete(
  "/tasks/:id",
  wrap(async (req, res) => {
    if (!isValidObjectId(req.params.id))
      throw new HttpError(404, "Task not found");
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      owner: res.locals.userId,
    });
    if (!task) throw new HttpError(404, "Task not found");
    res.status(204).end();
  }),
);

export default router;
