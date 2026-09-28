import type { NextFunction, Request, Response } from "express";
import { verifyToken, type AuthTokenPayload } from "./jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

/** The server is always the source of truth for identity - every mutating route sits behind this. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    req.auth = verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
}
