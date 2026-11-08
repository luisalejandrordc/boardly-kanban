export type Status = "todo" | "doing" | "done";

export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Category {
  _id: string;
  name: string;
  color: string;
}
export interface Board {
  _id: string;
  title: string;
  color: string;
  categories?: Category[];
  counts?: Record<Status, number>;
}
export interface Task {
  _id: string;
  board: string;
  title: string;
  description: string;
  category: string | null;
  dueDate: string | null; // "YYYY-MM-DD"
  estimateMinutes: number | null;
  status: Status;
  order: number;
}

export const COLUMNS: { id: Status; name: string }[] = [
  { id: "todo", name: "To do" },
  { id: "doing", name: "In progress" },
  { id: "done", name: "Done" },
];
export const BOARD_COLORS = [
  "#4338FF",
  "#E5484D",
  "#F5A524",
  "#2FB171",
  "#0EA5E9",
  "#C026D3",
];
export const CATEGORY_COLORS = [
  "#C026D3",
  "#0EA5E9",
  "#E5484D",
  "#F5A524",
  "#2FB171",
  "#4338FF",
  "#0D9488",
  "#64748B",
];
