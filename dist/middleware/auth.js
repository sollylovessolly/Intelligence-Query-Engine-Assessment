"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const db_1 = require("../db");
const tokens_1 = require("../utils/tokens");
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                status: "error",
                message: "Authentication required",
            });
        }
        const token = authHeader.replace("Bearer ", "");
        const payload = (0, tokens_1.verifyAccessToken)(token);
        const result = await db_1.pool.query(`
      SELECT id, github_id, username, email, avatar_url, role, is_active
      FROM users
      WHERE id = $1
      `, [payload.sub]);
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
    }
    catch {
        return res.status(401).json({
            status: "error",
            message: "Invalid or expired token",
        });
    }
}
function requireRole(...roles) {
    return (req, res, next) => {
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
