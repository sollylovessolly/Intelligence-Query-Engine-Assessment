import { Router } from "express";
import crypto from "crypto";
import { uuidv7 } from "uuidv7";
import { pool } from "../db";
import { env } from "../config/env";

import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../utils/tokens";

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
  const tokenHash = hashToken(refreshToken);

  await pool.query(
    `
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
    `,
    [uuidv7(), userId, tokenHash]
  );
}

router.get("/github", (req, res) => {
  const mode = String(req.query.mode || "web");
  const redirectUri = `${env.backendUrl}/auth/github/callback`;

  const statePayload = {
    mode,
    redirect: req.query.redirect || env.webAppUrl,
  };

  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = createCodeChallenge(verifier);

  res.cookie("github_code_verifier", verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
  });

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.githubClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  res.redirect(url.toString());
});

router.get("/github/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    const codeVerifier = req.cookies.github_code_verifier;

    if (!code || !state || !codeVerifier) {
      return res.status(400).json({
        status: "error",
        message: "Missing OAuth callback parameters",
      });
    }

    const statePayload = JSON.parse(Buffer.from(state, "base64url").toString());

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
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
        redirect_uri: `${env.backendUrl}/auth/github/callback`,
      }),
    });

    const tokenData: any = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(400).json({
        status: "error",
        message: "GitHub authentication failed",
      });
    }

    const githubUserResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const githubUser: any = await githubUserResponse.json();

    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const emails: any[] = await emailResponse.json();
    const primaryEmail =
      Array.isArray(emails)
        ? emails.find((e) => e.primary)?.email || emails[0]?.email || null
        : null;

    const existing = await pool.query(
      `SELECT * FROM users WHERE github_id = $1`,
      [String(githubUser.id)]
    );

    let user = existing.rows[0];

    if (!user) {
      const created = await pool.query(
        `
        INSERT INTO users (
          id, github_id, username, email, avatar_url, role, is_active, last_login_at
        )
        VALUES ($1, $2, $3, $4, $5, 'analyst', true, NOW())
        RETURNING *
        `,
        [
          uuidv7(),
          String(githubUser.id),
          githubUser.login,
          primaryEmail,
          githubUser.avatar_url,
        ]
      );

      user = created.rows[0];
    } else {
      const updated = await pool.query(
        `
        UPDATE users
        SET username = $1,
            email = $2,
            avatar_url = $3,
            last_login_at = NOW()
        WHERE github_id = $4
        RETURNING *
        `,
        [githubUser.login, primaryEmail, githubUser.avatar_url, String(githubUser.id)]
      );

      user = updated.rows[0];
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: "error",
        message: "User account is inactive",
      });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await saveRefreshToken(user.id, refreshToken);

    res.clearCookie("github_code_verifier");

    if (statePayload.mode === "cli") {
      return res.json({
        status: "success",
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          username: user.username,
          role: user.role,
        },
      });
    }

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 3 * 60 * 1000,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 5 * 60 * 1000,
    });

    return res.redirect(String(statePayload.redirect || env.webAppUrl));
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
        message: "Invalid or expired refresh token",
      });
    }

    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );

    const userResult = await pool.query(`SELECT * FROM users WHERE id = $1`, [
      payload.sub,
    ]);

    const user = userResult.rows[0];

    if (!user || !user.is_active) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden",
      });
    }

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);

    await saveRefreshToken(user.id, newRefreshToken);

    return res.json({
      status: "success",
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired refresh token",
    });
  }
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.body.refresh_token || req.cookies.refresh_token;

  if (refreshToken) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [hashToken(refreshToken)]
    );
  }

  res.clearCookie("access_token");
  res.clearCookie("refresh_token");

  return res.json({
    status: "success",
    message: "Logged out successfully",
  });
});

export default router;