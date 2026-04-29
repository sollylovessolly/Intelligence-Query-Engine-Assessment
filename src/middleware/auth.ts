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
    const cookieToken = req.cookies?.access_token;

    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : cookieToken;

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }

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

    const isMutatingRequest = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const isCookieAuth = !authHeader?.startsWith("Bearer ") && Boolean(cookieToken);

    if (isMutatingRequest && isCookieAuth) {
      const csrfHeader = req.header("X-CSRF-Token");
      if (!csrfHeader || csrfHeader !== req.cookies?.csrf_token) {
        return res.status(403).json({
          status: "error",
          message: "Invalid CSRF token",
        });
      }
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
