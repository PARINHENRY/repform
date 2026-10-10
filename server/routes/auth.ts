import { Router, type Response } from "express";
import { User } from "../db.ts";
import { comparePassword, generateToken, hashPassword, requireAuth, type AuthRequest } from "../auth.ts";

const router = Router();

// Sanitizer for user object
function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// -------------------------------------------------------------
// POST /api/auth/register
// -------------------------------------------------------------
router.post("/register", async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, displayName, bodyWeightKg, targetReps } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long." });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      displayName: displayName?.trim() || "Athlete",
      bodyWeightKg: Number(bodyWeightKg) || 70,
      targetReps: Number(targetReps) || 15,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error("[Register] Error:", err);
    res.status(500).json({ error: err.message || "Failed to register user." });
  }
});

// -------------------------------------------------------------
// POST /api/auth/login
// -------------------------------------------------------------
router.post("/login", async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const match = await comparePassword(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = generateToken(user._id);

    res.json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error("[Login] Error:", err);
    res.status(500).json({ error: err.message || "Failed to log in." });
  }
});

// -------------------------------------------------------------
// POST /api/auth/demo (Instant 1-click test login)
// -------------------------------------------------------------
router.post("/demo", async (req: AuthRequest, res: Response) => {
  try {
    const demoEmail = "demo@kayagni.ai";
    let user = await User.findOne({ email: demoEmail });

    if (!user) {
      const passwordHash = await hashPassword("demo1234");
      user = await User.create({
        email: demoEmail,
        passwordHash,
        displayName: "Demo Athlete",
        bodyWeightKg: 75,
        targetReps: 15,
      });
    }

    const token = generateToken(user._id);

    res.json({
      message: "Logged in as Demo Athlete",
      token,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error("[DemoLogin] Error:", err);
    res.status(500).json({ error: "Failed to initialize demo account." });
  }
});

// -------------------------------------------------------------
// GET /api/auth/me (Protected)
// -------------------------------------------------------------
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user) });
});

// -------------------------------------------------------------
// PUT /api/auth/profile (Protected)
// -------------------------------------------------------------
router.put("/profile", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, bodyWeightKg, targetReps } = req.body;
    const updates: any = {};

    if (displayName !== undefined) updates.displayName = String(displayName).trim().slice(0, 30);
    if (bodyWeightKg !== undefined) updates.bodyWeightKg = Math.max(30, Math.min(250, Number(bodyWeightKg) || 70));
    if (targetReps !== undefined) updates.targetReps = Math.max(1, Math.min(100, Number(targetReps) || 15));

    const updated = await User.findByIdAndUpdate(req.userId!, updates);
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      message: "Profile updated successfully",
      user: sanitizeUser(updated),
    });
  } catch (err: any) {
    console.error("[ProfileUpdate] Error:", err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

export default router;
