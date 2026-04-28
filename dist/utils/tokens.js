"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAccessToken = createAccessToken;
exports.createRefreshToken = createRefreshToken;
exports.hashToken = hashToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
function createAccessToken(user) {
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        username: user.username,
        role: user.role,
    }, env_1.env.jwtAccessSecret, { expiresIn: "3m" });
}
function createRefreshToken(user) {
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        type: "refresh",
    }, env_1.env.jwtRefreshSecret, { expiresIn: "5m" });
}
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.jwtAccessSecret);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.env.jwtRefreshSecret);
}
