import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const secret = () => process.env.JWT_SECRET || "dev-secret-change-me";

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, secret(), { expiresIn: "7d" });

// Wraps async handlers so thrown errors reach the error middleware
export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

// Verifies the Bearer token and exposes the user id as res.locals.userId
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return next(new HttpError(401, "Please sign in to continue"));
  try {
    const payload = jwt.verify(header.slice(7), secret()) as { sub: string };
    res.locals.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, "Your session has expired. Sign in again"));
  }
}
