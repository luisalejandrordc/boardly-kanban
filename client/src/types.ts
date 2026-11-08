export type Status = "todo" | "doing" | "done";
export type Label = "none" | "design" | "dev" | "urgent" | "idea";

export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Board {
  _id: string;
  title: string;
  color: string;
  counts?: Record<Status, number>;
}
export interface Task {
  _id: string;
  board: string;
  title: string;
  description: string;
  label: Label;
  status: Status;
  order: number;
}

export const COLUMNS: { id: Status; name: string }[] = [
  { id: "todo", name: "To do" },
  { id: "doing", name: "In progress" },
  { id: "done", name: "Done" },
];
export const LABELS: Label[] = ["none", "design", "dev", "urgent", "idea"];
export const BOARD_COLORS = [
  "#4338FF",
  "#E5484D",
  "#F5A524",
  "#2FB171",
  "#0EA5E9",
  "#C026D3",
];
