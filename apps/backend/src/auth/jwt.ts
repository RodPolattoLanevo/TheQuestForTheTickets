import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AuthTokenPayload {
  sub: string; // user id
  role: "EMPLOYEE" | "ADMIN";
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.authJwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, config.authJwtSecret) as AuthTokenPayload;
}
