import express from "express";
import cors from "cors";
import profilesRouter from "./routes/profiles";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "success", message: "API running 🚀" });
});

app.use("/api/profiles", profilesRouter);

export default app;