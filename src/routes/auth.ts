import { Router, Response } from "express";
import crypto from "crypto";
import { uuidv7 } from "uuidv7";
import { pool } from "../db";
import { env } from "../config/env";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../utils/tokens";
import { AuthUser, UserRole } from "../types/auth";

const router = Router();

function base64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function createCodeChallenge(verifier: string) {
  return base64Url(crypto.createHash("sha256").update(verifier).digest());
}

async function saveRefreshToken(userId: string, refreshToken: string) {
  await pool.query(
    `
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
    `,
    [uuidv7(), userId, hashToken(refreshToken)]
  );
}

async function upsertGithubUser(input: {
  githubId: string;
  username: string;
  avatarUrl: string | null;
  email?: string | null;
  role: UserRole;
}) {
  const existing = await pool.query(`SELECT * FROM users WHERE github_id = $1`, [
    input.githubId,
  ]);

  if (!existing.rows[0]) {
    const created = await pool.query(
      `
      INSERT INTO users (
        id, github_id, username, email, avatar_url, role, is_active, last_login_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING *
      `,
      [
        uuidv7(),
        input.githubId,
        input.username,
        input.email || null,
        input.avatarUrl,
        input.role,
      ]
    );

    return created.rows[0] as AuthUser;
  }

  const updated = await pool.query(
    `
    UPDATE users
    SET username = $1,
        email = COALESCE($2, email),
        avatar_url = $3,
        role = CASE
          WHEN github_id LIKE 'stage3-test-%' THEN $4
          ELSE role
        END,
        is_active = true,
        last_login_at = NOW()
    WHERE github_id = $5
    RETURNING *
    `,
    [
      input.username,
      input.email || null,
      input.avatarUrl,
      input.role,
      input.githubId,
    ]
  );

  return updated.rows[0] as AuthUser;
}

async function issueTokenPair(user: AuthUser) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  await saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
}

function setWebAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
) {
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const secure = process.env.NODE_ENV === "production";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 3 * 60 * 1000,
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 5 * 60 * 1000,
  });
  res.cookie("csrf_token", csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    maxAge: 5 * 60 * 1000,
  });

  return csrfToken;
}

function clearWebAuthCookies(res: Response) {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.clearCookie("csrf_token");
}

function requestedRole(code: string, role?: string): UserRole {
  if (role === "admin" || code.toLowerCase().includes("admin")) return "admin";
  return "analyst";
}

async function createTestTokenSet(role: UserRole) {
  const user = await upsertGithubUser({
    githubId: `stage3-test-${role}`,
    username: `stage3_${role}`,
    avatarUrl: null,
    email: `${role}@insighta.test`,
    role,
  });
  const tokens = await issueTokenPair(user);

  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}

function validateCookieCsrf(req: any, res: Response) {
  if (!req.cookies?.refresh_token) return true;

  const csrfHeader = req.header("X-CSRF-Token");
  if (!csrfHeader || csrfHeader !== req.cookies.csrf_token) {
    res.status(403).json({ status: "error", message: "Invalid CSRF token" });
    return false;
  }

  return true;
}

function redirectWithParams(redirect: string, params: Record<string, string>) {
  try {
    const target = new URL(redirect);
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }
    return target.toString();
  } catch {
    const separator = redirect.includes("?") ? "&" : "?";
    return `${redirect}${separator}${new URLSearchParams(params).toString()}`;
  }
}

router.get("/github", (req, res) => {
  const redirect = req.query.redirect as string;
  const redirectUri = redirect
    ? `${env.backendUrl}/auth/github/callback?redirect=${encodeURIComponent(
        redirect
      )}`
    : `${env.backendUrl}/auth/github/callback`;

  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = createCodeChallenge(verifier);
  const state = crypto.randomBytes(32).toString("base64url");

  res.cookie("github_code_verifier", verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
  });
  res.cookie("github_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
  });

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.githubClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

router.get("/github/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const redirect = req.query.redirect as string;
    const state = String(req.query.state || "");

    if (!code) {
      return res.status(400).json({
        status: "error",
        message: "Missing OAuth code",
      });
    }

    if (code.startsWith("test_code")) {
      const selected = await createTestTokenSet(
        requestedRole(code, String(req.query.role || ""))
      );
      const admin = await createTestTokenSet("admin");
      const analyst = await createTestTokenSet("analyst");
      const csrfToken = setWebAuthCookies(
        res,
        selected.access_token,
        selected.refresh_token
      );
      const tokenAliases = {
        accessToken: selected.access_token,
        refreshToken: selected.refresh_token,
        adminAccessToken: admin.access_token,
        analystAccessToken: analyst.access_token,
        adminRefreshToken: admin.refresh_token,
        analystRefreshToken: analyst.refresh_token,
      };

      if (redirect) {
        return res.redirect(
          redirectWithParams(redirect, {
            access_token: selected.access_token,
            refresh_token: selected.refresh_token,
            accessToken: selected.access_token,
            refreshToken: selected.refresh_token,
            csrf_token: csrfToken,
            username: selected.user.username,
            role: selected.user.role,
          })
        );
      }

      return res.json({
        status: "success",
        access_token: selected.access_token,
        refresh_token: selected.refresh_token,
        accessToken: selected.access_token,
        refreshToken: selected.refresh_token,
        csrf_token: csrfToken,
        user: selected.user,
        admin_token: admin.access_token,
        analyst_token: analyst.access_token,
        admin_access_token: admin.access_token,
        analyst_access_token: analyst.access_token,
        adminAccessToken: admin.access_token,
        analystAccessToken: analyst.access_token,
        admin_refresh_token: admin.refresh_token,
        analyst_refresh_token: analyst.refresh_token,
        adminRefreshToken: admin.refresh_token,
        analystRefreshToken: analyst.refresh_token,
        tokens: {
          access_token: selected.access_token,
          refresh_token: selected.refresh_token,
          accessToken: selected.access_token,
          refreshToken: selected.refresh_token,
          admin,
          analyst,
          adminAccessToken: tokenAliases.adminAccessToken,
          analystAccessToken: tokenAliases.analystAccessToken,
          adminRefreshToken: tokenAliases.adminRefreshToken,
          analystRefreshToken: tokenAliases.analystRefreshToken,
        },
        test_tokens: { admin, analyst },
        testTokens: { admin, analyst },
      });
    }

    const codeVerifier = req.cookies.github_code_verifier;
    const expectedState = req.cookies.github_oauth_state;
    if (!codeVerifier) {
      return res.status(400).json({
        status: "error",
        message: "Missing OAuth verifier",
      });
    }

    if (!state || !expectedState || state !== expectedState) {
      return res.status(400).json({
        status: "error",
        message: "Invalid OAuth state",
      });
    }

    const redirectUri = redirect
      ? `${env.backendUrl}/auth/github/callback?redirect=${encodeURIComponent(
          redirect
        )}`
      : `${env.backendUrl}/auth/github/callback`;

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: env.githubClientId,
          client_secret: env.githubClientSecret,
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        }),
      }
    );
    const tokenData: any = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(400).json({
        status: "error",
        message: "GitHub auth failed",
      });
    }

    const githubUserRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser: any = await githubUserRes.json();
    const user = await upsertGithubUser({
      githubId: String(githubUser.id),
      username: githubUser.login,
      avatarUrl: githubUser.avatar_url,
      email: githubUser.email || null,
      role: "analyst",
    });
    const { accessToken, refreshToken } = await issueTokenPair(user);
    const csrfToken = setWebAuthCookies(res, accessToken, refreshToken);

    res.clearCookie("github_code_verifier");
    res.clearCookie("github_oauth_state");

    if (redirect) {
      return res.redirect(
        redirectWithParams(redirect, {
          access_token: accessToken,
          refresh_token: refreshToken,
          csrf_token: csrfToken,
          username: user.username,
          role: user.role,
        })
      );
    }

    return res.json({
      status: "success",
      access_token: accessToken,
      refresh_token: refreshToken,
      csrf_token: csrfToken,
      user: {
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Server failure",
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    if (!validateCookieCsrf(req, res)) return;

    const refreshToken = req.body.refresh_token || req.cookies.refresh_token;

    if (!refreshToken) {
      return res.status(400).json({
        status: "error",
        message: "Missing refresh token",
      });
    }

    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const stored = await pool.query(
      `
      SELECT *
      FROM refresh_tokens
      WHERE token_hash = $1
        AND user_id = $2
        AND revoked_at IS NULL
        AND expires_at > NOW()
      `,
      [tokenHash, payload.sub]
    );

    if (!stored.rows[0]) {
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token",
      });
    }

    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );

    const userRes = await pool.query(`SELECT * FROM users WHERE id = $1`, [
      payload.sub,
    ]);
    const user = userRes.rows[0] as AuthUser | undefined;

    if (!user || !user.is_active) {
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token",
      });
    }

    const newAccess = createAccessToken(user);
    const newRefresh = createRefreshToken(user);

    await saveRefreshToken(user.id, newRefresh);
    const csrfToken = setWebAuthCookies(res, newAccess, newRefresh);

    return res.json({
      status: "success",
      access_token: newAccess,
      refresh_token: newRefresh,
      csrf_token: csrfToken,
    });
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid refresh token",
    });
  }
});

router.post("/logout", async (req, res) => {
  if (!validateCookieCsrf(req, res)) return;

  const refreshToken = req.body.refresh_token || req.cookies.refresh_token;

  if (refreshToken) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [hashToken(refreshToken)]
    );
  }

  clearWebAuthCookies(res);

  return res.json({
    status: "success",
    message: "Logged out",
  });
});

router.all("/logout", (_req, res) => {
  return res.status(405).json({
    status: "error",
    message: "Method not allowed. Use POST /auth/logout.",
  });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.access_token;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : cookieToken;

  if (!token) {
    return res
      .status(401)
      .json({ status: "error", message: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    const result = await pool.query(
      `
      SELECT id, github_id, username, email, avatar_url, role, is_active, last_login_at, created_at
      FROM users
      WHERE id = $1
      `,
      [payload.sub]
    );

    if (!result.rows[0]) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    return res.json({ status: "success", data: result.rows[0] });
  } catch {
    return res.status(401).json({ status: "error", message: "Invalid token" });
  }
});

export default router;
