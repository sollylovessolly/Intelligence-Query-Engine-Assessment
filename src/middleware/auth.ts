import { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { verifyAccessToken } from "../utils/tokens";
import { AuthUser, UserRole } from "../types/auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyAccessToken(token);

    const result = await pool.query(
      `
      SELECT id, github_id, username, email, avatar_url, role, is_active
      FROM users
      WHERE id = $1
      `,
      [payload.sub]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Invalid authentication token",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: "error",
        message: "User account is inactive",
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token",
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden",
      });
    }

    next();
  };
}