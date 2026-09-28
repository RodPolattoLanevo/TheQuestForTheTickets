import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPrismaClient, type Role } from "@hunt/database";
import { signToken } from "../auth/jwt.js";
import { assignStartingWorldIfNeeded } from "../engine/character.js";

const prisma = getPrismaClient();
export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "ADMIN" : "EMPLOYEE"; // first account created is the Game Master

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      role,
      character: { create: { stats: { create: {} } } },
    },
  });

  const character = await prisma.character.findUniqueOrThrow({ where: { userId: user.id } });
  await assignStartingWorldIfNeeded(character.id);

  const token = signToken({ sub: user.id, role: user.role as Role });
  res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken({ sub: user.id, role: user.role as Role });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
});
