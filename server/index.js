import express from "express";
import {
  createProperty,
  createSession,
  createUser,
  deleteSession,
  deleteProperty,
  getDealerProperties,
  getProperties,
  getStates,
  getUserBySession,
  databaseReady,
  verifyUser,
  updateProperty,
} from "./db.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "16kb" }));

app.get("/api/properties", (req, res) => {
  try {
    return res.json(getProperties(req.query));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/states", (_req, res) => res.json(getStates()));

app.post("/api/auth/register", (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !["dealer", "customer"].includes(role)) {
    return res.status(400).json({ error: "Username, password, and role are required." });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const user = createUser(String(username).trim(), password, role);
    const token = createSession(user.id, user.role);
    return res.status(201).json({ token, user });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE" || String(error.message).includes("UNIQUE constraint failed")) {
      return res.status(409).json({ error: "That username is already registered." });
    }
    return res.status(400).json({ error: error.message || "Could not create account." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password, role } = req.body;
  if (!["dealer", "customer"].includes(role)) {
    return res.status(400).json({ error: "A valid account role is required." });
  }
  const user = verifyUser(String(username || "").trim(), String(password || ""), role);

  if (!user) {
    return res.status(401).json({ error: "Invalid username, password, or role." });
  }

  return res.json({ token: createSession(user.id, user.role), user });
});

app.get("/api/auth/me", (req, res) => {
  const user = getUserBySession(req.headers.authorization);
  return user ? res.json({ user }) : res.status(401).json({ error: "Please log in." });
});

app.post("/api/auth/logout", (req, res) => {
  deleteSession(req.headers.authorization);
  return res.status(204).end();
});

app.post("/api/properties", (req, res) => {
  const user = getUserBySession(req.headers.authorization);
  if (!user || user.role !== "dealer") {
    return res.status(403).json({ error: "Only dealers can add properties." });
  }

  try {
    return res.status(201).json(createProperty(req.body, user.id));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/dealer/properties", (req, res) => {
  const user = getUserBySession(req.headers.authorization);
  if (!user || user.role !== "dealer") return res.status(403).json({ error: "Only dealers can view published properties." });
  return res.json(getDealerProperties(user.id));
});

app.put("/api/properties/:id", (req, res) => {
  const user = getUserBySession(req.headers.authorization);
  if (!user || user.role !== "dealer") return res.status(403).json({ error: "Only dealers can update properties." });
  try {
    return res.json(updateProperty(req.params.id, req.body, user.id));
  } catch (error) {
    return res.status(error.message.includes("not found") ? 404 : 400).json({ error: error.message });
  }
});

app.delete("/api/properties/:id", (req, res) => {
  const user = getUserBySession(req.headers.authorization);
  if (!user || user.role !== "dealer") return res.status(403).json({ error: "Only dealers can delete properties." });
  if (!deleteProperty(req.params.id, user.id)) return res.status(404).json({ error: "Property not found or not owned by this dealer." });
  return res.status(204).end();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", region: "India" });
});

await databaseReady;
app.listen(PORT, () => {
  console.log(`Real estate API listening on http://localhost:${PORT}`);
});
