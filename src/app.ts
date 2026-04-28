import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import profilesRouter from "./routes/profiles";
import authRouter from "./routes/auth";
import { requestLogger } from "./middleware/logger";
import { requireAuth } from "./middleware/auth";
import { requireApiVersion } from "./middleware/apiVersion";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    status: "error",
    message: "Too many requests",
  },
});

const apiLimiter = rateLimit({
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

app.use("/auth", authLimiter, authRouter);

app.use("/api", apiLimiter);
app.use("/api", requireApiVersion);
app.use("/api", requireAuth);

app.use("/api/profiles", profilesRouter);

export default app;