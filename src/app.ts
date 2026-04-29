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

app.set("trust proxy", 1);

const corsOptions = {
  origin: true, 
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Version", "X-CSRF-Token"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests" },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests" },
});

app.get("/", (_req, res) => {
  res.json({ status: "success", message: "API running 🚀" });
});

app.use("/auth", authLimiter, authRouter);

app.use("/api", apiLimiter);

app.get("/api/v1/users/me", requireAuth, (req, res) => {
  return res.json({ status: "success", data: req.user });
});

app.use("/api/v1", requireAuth);
app.use("/api/v1/profiles", profilesRouter);

app.get("/api/users/me", requireApiVersion, requireAuth, (req, res) => {
  return res.json({ status: "success", data: req.user });
});

app.use("/api", requireApiVersion);
app.use("/api", requireAuth);
app.use("/api/profiles", profilesRouter);

export default app;
