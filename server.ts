import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { initDatabase, getDbStatus } from "./server/db.js";
import authRoutes from "./server/routes/auth.js";
import sessionRoutes from "./server/routes/sessions.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Initialize MongoDB / persistent storage
  await initDatabase();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "RepForm AI Backend",
      timestamp: new Date().toISOString(),
      database: getDbStatus(),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/sessions", sessionRoutes);

  // Vite Middleware or Static Assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[RepForm Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[RepForm Server] Fatal bootstrap error:", err);
  process.exit(1);
});
