"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const seed_1 = require("./seed");
const PORT = process.env.PORT || 4000;
async function start() {
    try {
        await (0, seed_1.seed)(); // 🔥 seed every time (safe because of ON CONFLICT)
        console.log("Seed done ✅");
        app_1.default.listen(PORT, () => {
            console.log(`Server running on port ${PORT} 🚀`);
        });
    }
    catch (err) {
        console.error("Startup failed ❌", err);
    }
}
start();
