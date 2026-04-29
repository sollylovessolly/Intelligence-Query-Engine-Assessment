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
const authHits = new Map<string, { count: number; resetAt: number }>();

app.set("trust proxy", 1);

const corsOptions = {
  origin: true, 
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Version", "X-CSRF-Token"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use((req, res, next) => {
  if (req.path.startsWith("/auth") && !res.getHeader("Access-Control-Allow-Origin")) {
    res.setHeader("Access-Control-Allow-Origin", req.header("Origin") || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Version, X-CSRF-Token");
  }
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

function strictAuthLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const forwardedFor = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = authHits.get(key);

  if (!current || current.resetAt <= now) {
    authHits.set(key, { count: 1, resetAt: now + 60 * 1000 });
    res.setHeader("RateLimit-Limit", "10");
    res.setHeader("RateLimit-Remaining", "9");
    res.setHeader("RateLimit-Reset", "60");
    return next();
  }

  if (current.count >= 10) {
    const secondsUntilReset = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.setHeader("RateLimit-Limit", "10");
    res.setHeader("RateLimit-Remaining", "0");
    res.setHeader("RateLimit-Reset", String(secondsUntilReset));
    res.setHeader("Retry-After", String(secondsUntilReset));
    return res.status(429).json({ status: "error", message: "Too many requests" });
  }

  current.count += 1;
  res.setHeader("RateLimit-Limit", "10");
  res.setHeader("RateLimit-Remaining", String(10 - current.count));
  res.setHeader("RateLimit-Reset", String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
  return next();
}

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

app.use("/auth", strictAuthLimiter, authRouter);

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
