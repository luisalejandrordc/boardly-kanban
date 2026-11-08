import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import router from "./routes";
import { HttpError } from "./middleware";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError)
    return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side" });
});

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kanban";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () =>
      console.log(`API running on http://localhost:${PORT}`),
    );
  })
  .catch((e) => {
    console.error("Could not connect to MongoDB:", e.message);
    process.exit(1);
  });
