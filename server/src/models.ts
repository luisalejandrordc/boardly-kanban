import { Schema, model } from "mongoose";

export const STATUSES = ["todo", "doing", "done"] as const;
export const LABELS = ["none", "design", "dev", "urgent", "idea"] as const;

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
    label: { type: String, enum: LABELS, default: "none" },
    status: { type: String, enum: STATUSES, default: "todo" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
export const Board = model("Board", boardSchema);
export const Task = model("Task", taskSchema);
