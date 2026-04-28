import { Request, Response, NextFunction } from "express";

export function requireApiVersion(req: Request, res: Response, next: NextFunction) {
  const version = req.header("X-API-Version");

  if (!version) {
    return res.status(400).json({
      status: "error",
      message: "API version header required",
    });
  }

  if (version !== "1") {
    return res.status(400).json({
      status: "error",
      message: "Invalid API version",
    });
  }

  next();
}