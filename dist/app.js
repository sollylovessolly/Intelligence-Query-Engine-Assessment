"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const profiles_1 = __importDefault(require("./routes/profiles"));
const auth_1 = __importDefault(require("./routes/auth"));
const logger_1 = require("./middleware/logger");
const auth_2 = require("./middleware/auth");
const apiVersion_1 = require("./middleware/apiVersion");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(logger_1.requestLogger);
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        status: "error",
        message: "Too many requests",
    },
});
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    message: {
        status: "error",
        message: "Too many requests",
    },
});
app.get("/", (_req, res) => {
    res.json({ status: "success", message: "API running 🚀" });
});
app.get("/test-auth", (_req, res) => {
    res.send("auth route working");
});
app.use("/auth", authLimiter, auth_1.default);
app.use("/api", apiLimiter);
app.use("/api", apiVersion_1.requireApiVersion);
app.use("/api", auth_2.requireAuth);
app.use("/api/profiles", profiles_1.default);
exports.default = app;
