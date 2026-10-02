import initSqlJs from "sql.js";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const databasePath = join(serverDirectory, "data", "gharmap.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
let database;

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash).split(":");
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, 64);
  const storedKey = Buffer.from(key, "hex");
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

function cleanText(value, field, maxLength = 200) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) throw new Error(`${field} is required and must be at most ${maxLength} characters.`);
  return text;
}

function cleanImageUrl(value) {
  const image = cleanText(value, "Image URL", 2_000);
  let parsed;
  try {
    parsed = new URL(image);
  } catch {
    throw new Error("Image URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("Image URL must use HTTPS.");
  return parsed.toString();
}

function cleanPhone(value) {
  const phone = cleanText(value, "Contact number", 30);
  if (!/^[+0-9 ()-]{8,30}$/.test(phone)) throw new Error("Contact number contains invalid characters.");
  return phone;
}

function propertyInput(input) {
  const price = Number(input.price);
  const bedrooms = Number(input.bedrooms);
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (![price, bedrooms, latitude, longitude].every(Number.isFinite)) throw new Error("Numeric property fields must be valid numbers.");
  if (price <= 0 || bedrooms < 1 || !Number.isInteger(bedrooms)) throw new Error("Price and bedrooms must be positive values.");
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error("Coordinates are out of range.");
  if (!["sale", "rent"].includes(input.listingType)) throw new Error("Listing type must be sale or rent.");
  return {
    title: cleanText(input.title, "Title", 160),
    price,
    listingType: input.listingType,
    bedrooms,
    address: cleanText(input.address, "Address", 300),
    state: cleanText(input.state, "State", 80),
    image: cleanImageUrl(input.image),
    contactNumber: cleanPhone(input.contactNumber),
    latitude,
    longitude,
  };
}

function saveDatabase() {
  writeFileSync(databasePath, Buffer.from(database.export()));
}

function rows(sql, params = []) {
  const statement = database.prepare(sql);
  statement.bind(params);
  const result = [];
  while (statement.step()) result.push(statement.getAsObject());
  statement.free();
  return result;
}

function first(sql, params = []) {
  return rows(sql, params)[0] || null;
}

function run(sql, params = []) {
  const statement = database.prepare(sql);
  statement.run(params);
  statement.free();
  const id = first("SELECT last_insert_rowid() AS id");
  saveDatabase();
  return id?.id;
}

function toProperty(row) {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    listingType: row.listing_type,
    bedrooms: row.bedrooms,
    address: row.address,
    state: row.state,
    contactNumber: row.contact_number,
    image: row.image,
    coordinates: { latitude: row.latitude, longitude: row.longitude },
  };
}

async function initializeDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => join(serverDirectory, "node_modules", "sql.js", "dist", file),
  });
  database = existsSync(databasePath) ? new SQL.Database(readFileSync(databasePath)) : new SQL.Database();
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('dealer', 'customer')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS dealers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      account_type TEXT NOT NULL CHECK (account_type IN ('dealer', 'customer')),
      account_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
      bedrooms INTEGER NOT NULL,
      address TEXT NOT NULL,
      state TEXT NOT NULL,
      image TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      contact_number TEXT NOT NULL DEFAULT '+91 90000 00000',
      dealer_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!rows("PRAGMA table_info(auth_sessions)").some(({ name }) => name === "expires_at")) {
    database.run("ALTER TABLE auth_sessions ADD COLUMN expires_at TEXT");
    database.run("UPDATE auth_sessions SET expires_at = datetime('now', '+7 days') WHERE expires_at IS NULL");
  }

  if (!rows("PRAGMA table_info(properties)").some(({ name }) => name === "contact_number")) {
    database.run("ALTER TABLE properties ADD COLUMN contact_number TEXT NOT NULL DEFAULT '+91 90000 00000'");
  }
  database.run("UPDATE properties SET contact_number = '+91 90000 ' || printf('%05d', 10000 + id) WHERE contact_number = '+91 90000 00000'");

  if (first("SELECT id FROM users LIMIT 1")) {
    for (const user of rows("SELECT username, password_hash, role FROM users")) {
      const table = user.role === "dealer" ? "dealers" : "customers";
      run(`INSERT OR IGNORE INTO ${table} (username, password_hash) VALUES (?, ?)`, [user.username, user.password_hash]);
    }
  }

  saveDatabase();
}

export const databaseReady = initializeDatabase();

export function getProperties({ north, south, east, west, listingType, state } = {}) {
  const clauses = [];
  const params = [];
  if ([north, south, east, west].every((value) => value !== undefined)) {
    const bounds = [Number(south), Number(north), Number(west), Number(east)];
    if (bounds.some((value) => Number.isNaN(value))) throw new Error("Bounding box coordinates must be valid numbers.");
    clauses.push("latitude BETWEEN ? AND ?", "longitude BETWEEN ? AND ?");
    params.push(...bounds);
  }
  if (listingType === "sale" || listingType === "rent") { clauses.push("listing_type = ?"); params.push(listingType); }
  if (state) { clauses.push("state = ?"); params.push(state); }
  const where = clauses.length ? clauses.join(" AND ") : "1 = 1";
  return rows(`SELECT * FROM properties WHERE ${where} ORDER BY created_at DESC, id DESC`, params).map(toProperty);
}

export function getStates() {
  return rows("SELECT DISTINCT state FROM properties ORDER BY state").map(({ state }) => state);
}

export function createUser(username, password, role) {
  const safeUsername = cleanText(username, "Username", 50);
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(safeUsername)) throw new Error("Username may contain only letters, numbers, dots, underscores, and hyphens.");
  if (String(password).length < 8 || String(password).length > 128) throw new Error("Password must be between 8 and 128 characters.");
  if (!["dealer", "customer"].includes(role)) throw new Error("Invalid account role.");
  const table = role === "dealer" ? "dealers" : "customers";
  const id = run(`INSERT INTO ${table} (username, password_hash) VALUES (?, ?)`, [safeUsername, hashPassword(password)]);
  return { ...first(`SELECT id, username FROM ${table} WHERE id = ?`, [id]), role };
}

export function verifyUser(username, password, role) {
  if (!["dealer", "customer"].includes(role) || !/^[A-Za-z0-9_.-]{3,50}$/.test(String(username || "")) || String(password || "").length > 128) return null;
  const table = role === "dealer" ? "dealers" : "customers";
  const user = first(`SELECT * FROM ${table} WHERE username = ?`, [username]);
  return user && verifyPassword(password, user.password_hash) ? { id: user.id, username: user.username, role } : null;
}

export function createSession(userId, role) {
  const token = randomBytes(32).toString("hex");
  run("INSERT INTO auth_sessions (token, account_type, account_id, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))", [token, role, userId]);
  return token;
}

export function getUserBySession(authorization) {
  const token = String(authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const session = first("SELECT account_type, account_id FROM auth_sessions WHERE token = ? AND expires_at > datetime('now')", [token]);
  if (!session) return null;
  const table = session.account_type === "dealer" ? "dealers" : "customers";
  const user = first(`SELECT id, username FROM ${table} WHERE id = ?`, [session.account_id]);
  return user ? { ...user, role: session.account_type } : null;
}

export function deleteSession(authorization) {
  const token = String(authorization || "").replace(/^Bearer\s+/i, "");
  if (token) run("DELETE FROM auth_sessions WHERE token = ?", [token]);
}

export function createProperty(input, dealerId) {
  const property = propertyInput(input);
  const id = run(
    `INSERT INTO properties (title, price, listing_type, bedrooms, address, state, image, latitude, longitude, contact_number, dealer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [property.title, property.price, property.listingType, property.bedrooms, property.address, property.state, property.image, property.latitude, property.longitude, property.contactNumber, dealerId]
  );
  return toProperty(first("SELECT * FROM properties WHERE id = ?", [id]));
}

export function getDealerProperties(dealerId) {
  return rows("SELECT * FROM properties WHERE dealer_id = ? ORDER BY created_at DESC, id DESC", [dealerId]).map(toProperty);
}

export function updateProperty(propertyId, input, dealerId) {
  const propertyInputData = propertyInput(input);

  const result = database.prepare(`
    UPDATE properties SET title = ?, price = ?, listing_type = ?, bedrooms = ?, address = ?, state = ?, image = ?, latitude = ?, longitude = ?, contact_number = ?
    WHERE id = ? AND dealer_id = ?
  `);
  result.run([
    propertyInputData.title, propertyInputData.price, propertyInputData.listingType, propertyInputData.bedrooms, propertyInputData.address, propertyInputData.state, propertyInputData.image, propertyInputData.latitude, propertyInputData.longitude, propertyInputData.contactNumber, Number(propertyId), dealerId,
  ]);
  result.free();
  saveDatabase();
  const property = first("SELECT * FROM properties WHERE id = ? AND dealer_id = ?", [Number(propertyId), dealerId]);
  if (!property) throw new Error("Property not found or not owned by this dealer.");
  return toProperty(property);
}

export function deleteProperty(propertyId, dealerId) {
  const result = database.prepare("DELETE FROM properties WHERE id = ? AND dealer_id = ?");
  result.run([Number(propertyId), dealerId]);
  const deleted = database.getRowsModified();
  result.free();
  saveDatabase();
  return deleted > 0;
}
