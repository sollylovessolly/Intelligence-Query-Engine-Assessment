import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",

  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "",

  webAppUrl: process.env.WEB_APP_URL || "http://localhost:5173",
  backendUrl: process.env.BACKEND_URL || "http://localhost:4000",
};

if (!env.databaseUrl) throw new Error("DATABASE_URL is required");
if (!env.githubClientId) throw new Error("GITHUB_CLIENT_ID is required");
if (!env.githubClientSecret) throw new Error("GITHUB_CLIENT_SECRET is required");
if (!env.jwtAccessSecret) throw new Error("JWT_ACCESS_SECRET is required");
if (!env.jwtRefreshSecret) throw new Error("JWT_REFRESH_SECRET is required");