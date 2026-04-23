"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const profiles_1 = __importDefault(require("./routes/profiles"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: "*" }));
app.use(express_1.default.json());
app.get("/", (_req, res) => {
    res.json({ status: "success", message: "API running 🚀" });
});
app.use("/api/profiles", profiles_1.default);
exports.default = app;
