"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const uuidv7_1 = require("uuidv7");
const db_1 = require("../db");
const env_1 = require("../config/env");
const tokens_1 = require("../utils/tokens");
const router = (0, express_1.Router)();
function base64Url(input) {
    return input
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}
function createCodeChallenge(verifier) {
    return base64Url(crypto_1.default.createHash("sha256").update(verifier).digest());
}
async function saveRefreshToken(userId, refreshToken) {
    const tokenHash = (0, tokens_1.hashToken)(refreshToken);
    await db_1.pool.query(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
    `, [(0, uuidv7_1.uuidv7)(), userId, tokenHash]);
}
router.get("/github", (req, res) => {
    const mode = String(req.query.mode || "web");
    const redirectUri = `${env_1.env.backendUrl}/auth/github/callback`;
    const statePayload = {
        mode,
        redirect: req.query.redirect || env_1.env.webAppUrl,
    };
    const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");
    const verifier = crypto_1.default.randomBytes(32).toString("base64url");
    const challenge = createCodeChallenge(verifier);
    res.cookie("github_code_verifier", verifier, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 10 * 60 * 1000,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env_1.env.githubClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    res.redirect(url.toString());
});
router.get("/github/callback", async (req, res) => {
    var _a, _b;
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
                client_id: env_1.env.githubClientId,
                client_secret: env_1.env.githubClientSecret,
                code,
                code_verifier: codeVerifier,
                redirect_uri: `${env_1.env.backendUrl}/auth/github/callback`,
            }),
        });
        const tokenData = await tokenResponse.json();
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
        const githubUser = await githubUserResponse.json();
        const emailResponse = await fetch("https://api.github.com/user/emails", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });
        const emails = await emailResponse.json();
        const primaryEmail = Array.isArray(emails)
            ? ((_a = emails.find((e) => e.primary)) === null || _a === void 0 ? void 0 : _a.email) || ((_b = emails[0]) === null || _b === void 0 ? void 0 : _b.email) || null
            : null;
        const existing = await db_1.pool.query(`SELECT * FROM users WHERE github_id = $1`, [String(githubUser.id)]);
        let user = existing.rows[0];
        if (!user) {
            const created = await db_1.pool.query(`
        INSERT INTO users (
          id, github_id, username, email, avatar_url, role, is_active, last_login_at
        )
        VALUES ($1, $2, $3, $4, $5, 'analyst', true, NOW())
        RETURNING *
        `, [
                (0, uuidv7_1.uuidv7)(),
                String(githubUser.id),
                githubUser.login,
                primaryEmail,
                githubUser.avatar_url,
            ]);
            user = created.rows[0];
        }
        else {
            const updated = await db_1.pool.query(`
        UPDATE users
        SET username = $1,
            email = $2,
            avatar_url = $3,
            last_login_at = NOW()
        WHERE github_id = $4
        RETURNING *
        `, [githubUser.login, primaryEmail, githubUser.avatar_url, String(githubUser.id)]);
            user = updated.rows[0];
        }
        if (!user.is_active) {
            return res.status(403).json({
                status: "error",
                message: "User account is inactive",
            });
        }
        const accessToken = (0, tokens_1.createAccessToken)(user);
        const refreshToken = (0, tokens_1.createRefreshToken)(user);
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
        return res.redirect(String(statePayload.redirect || env_1.env.webAppUrl));
    }
    catch (err) {
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
        const payload = (0, tokens_1.verifyRefreshToken)(refreshToken);
        const tokenHash = (0, tokens_1.hashToken)(refreshToken);
        const stored = await db_1.pool.query(`
      SELECT *
      FROM refresh_tokens
      WHERE token_hash = $1
        AND user_id = $2
        AND revoked_at IS NULL
        AND expires_at > NOW()
      `, [tokenHash, payload.sub]);
        if (!stored.rows[0]) {
            return res.status(401).json({
                status: "error",
                message: "Invalid or expired refresh token",
            });
        }
        await db_1.pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
        const userResult = await db_1.pool.query(`SELECT * FROM users WHERE id = $1`, [
            payload.sub,
        ]);
        const user = userResult.rows[0];
        if (!user || !user.is_active) {
            return res.status(403).json({
                status: "error",
                message: "Forbidden",
            });
        }
        const newAccessToken = (0, tokens_1.createAccessToken)(user);
        const newRefreshToken = (0, tokens_1.createRefreshToken)(user);
        await saveRefreshToken(user.id, newRefreshToken);
        return res.json({
            status: "success",
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
        });
    }
    catch {
        return res.status(401).json({
            status: "error",
            message: "Invalid or expired refresh token",
        });
    }
});
router.post("/logout", async (req, res) => {
    const refreshToken = req.body.refresh_token || req.cookies.refresh_token;
    if (refreshToken) {
        await db_1.pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [(0, tokens_1.hashToken)(refreshToken)]);
    }
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    return res.json({
        status: "success",
        message: "Logged out successfully",
    });
});
exports.default = router;
