import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { User, IUser } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "repform-ai-secure-jwt-secret-key-2026";
const TOKEN_EXPIRY = "30d";

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing or malformed authorization header." });
      return;
    }

    const token = authHeader.split(" ")[1];
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (tokenErr) {
      res.status(401).json({ error: "Unauthorized: Invalid or expired token." });
      return;
    }

    if (!payload || !payload.sub) {
      res.status(401).json({ error: "Unauthorized: Invalid token payload." });
      return;
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "Unauthorized: User account not found." });
      return;
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err: any) {
    console.error("[AuthMiddleware] Error:", err);
    res.status(500).json({ error: "Internal server authentication error." });
  }
}
