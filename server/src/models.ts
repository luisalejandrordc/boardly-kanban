import { Schema, model } from "mongoose";

export const STATUSES = ["todo", "doing", "done"] as const;

// Every board starts with these categories; users can add or remove their own
export const DEFAULT_CATEGORIES = [
  { name: "Design", color: "#C026D3" },
  { name: "Dev", color: "#0EA5E9" },
  { name: "Urgent", color: "#E5484D" },
  { name: "Idea", color: "#F5A524" },
];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 24 },
  color: { type: String, required: true },
});

const boardSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    color: { type: String, default: "#4338FF" },
    categories: [categorySchema],
    seeded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const taskSchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },
    category: { type: Schema.Types.ObjectId, default: null },
    dueDate: { type: String, default: null }, // optional, "YYYY-MM-DD"
    estimateMinutes: { type: Number, default: null, min: 1, max: 9999 }, // optional
    status: { type: String, enum: STATUSES, default: "todo" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
export const Board = model("Board", boardSchema);
export const Task = model("Task", taskSchema);
