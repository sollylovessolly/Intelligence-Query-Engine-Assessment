import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import { AuthUser } from "../types/auth";

export function createAccessToken(user: AuthUser) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    env.jwtAccessSecret,
    { expiresIn: "3m" }
  );
}

export function createRefreshToken(user: AuthUser) {
  return jwt.sign(
    {
      sub: user.id,
      type: "refresh",
    },
    env.jwtRefreshSecret,
    { expiresIn: "5m" }
  );
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.jwtAccessSecret) as {
    sub: string;
    username: string;
    role: string;
  };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.jwtRefreshSecret) as {
    sub: string;
    type: string;
  };
}