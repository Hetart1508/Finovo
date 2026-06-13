import "dotenv/config";
import express from "express";
import path from "path";

import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import crypto from "crypto";

// Migration system
function runMigrations() {
  console.log("🔄 Running database migrations...");
  
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    )
  `);
  
  // Get list of migration files (001_initial.sql, 002_xxx.sql, etc.)
  const migrationsDir = "./migrations";
  let migrationFiles: string[];
  try {
    migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Natural sort by filename (001, 002, etc.)
  } catch (error) {
    console.log("❌ No migrations directory found. Skipping migrations.");
    return;
  }
  
  let appliedCount = 0;
  
  for (const file of migrationFiles) {
    const version = parseInt(file.split('_')[0], 10); // Extract version from 001_initial.sql
    
    if (isNaN(version)) {
      console.log(`⚠️ Skipping non-versioned migration: ${file}`);
      continue;
    }
    
    // Check if already applied
    const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").get(version);
    if (applied) {
      console.log(`✅ Migration ${file} already applied`);
      continue;
    }
    
    try {
      // Read and execute migration
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      
      // Mark as applied
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
      
      console.log(`✅ Applied migration ${file} (v${version})`);
      appliedCount++;
    } catch (error: any) {
      console.error(`❌ Failed to apply migration ${file}:`, error.message);
      throw error;
    }
  }
  
  console.log(`🎉 Completed migrations. Applied ${appliedCount} new migrations.`);
}

const db = new Database("expense_tracker.db");

// Initialize Database with migrations
runMigrations();

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth Routes ---
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const stmt = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)");
    const info = stmt.run(email, hashedPassword, name);
    res.json({ message: "Account created successfully. Please login with OTP.", user: { id: info.lastInsertRowid, email, name } });
  } catch (e) {
    res.status(400).json({ error: "Email already exists" });
  }
});

app.post("/api/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  
// Delete old OTP with retry
  let retries = 3;
  while (retries > 0) {
    try {
      db.prepare("DELETE FROM otps WHERE email = ?").run(email);
      break;
    } catch (e: any) {
      if (e.code !== 'SQLITE_BUSY') throw e;
      retries--;
      if (retries === 0) throw e;
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  // Insert new OTP
  db.prepare("INSERT INTO otps (email, otp, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(email, otp, expiresAt, Date.now());

  try {
    await transporter.sendMail({
      from: `"FinSight AI" <${EMAIL_USER}>`,
      to: email,
      subject: "Your FinSight AI Login OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Your Login OTP</h2>
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 12px; letter-spacing: 4px;">
            ${otp}
          </div>
          <p style="margin-top: 24px;">This OTP is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 14px;">FinSight AI - Intelligent expense tracking</p>
        </div>
      `,
    });
    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  
  const otpRecord: any = db.prepare(`
    SELECT * FROM otps WHERE email = ? AND otp = ? AND expires_at > ?
  `).get(email, otp, Date.now());
  
  if (!otpRecord) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  // Get user and generate token
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const token = jwt.sign({ 
    id: user.id, 
    email: user.email, 
    name: user.name 
  }, JWT_SECRET);
  
// Clean up OTP with retry
  let retries2 = 3;
  while (retries2 > 0) {
    try {
      db.prepare("DELETE FROM otps WHERE email = ?").run(email);
      break;
    } catch (e: any) {
      if (e.code !== 'SQLITE_BUSY') throw e;
      retries2--;
      if (retries2 === 0) throw e;
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  res.json({ 
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      daily_threshold: user.daily_threshold 
    } 
  });
});

// Legacy password login kept for register testing
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, daily_threshold: user.daily_threshold } });
});

// --- Transaction Routes ---
app.get("/api/transactions", authenticateToken, (req: any, res) => {
  const transactions = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC").all(req.user.id);
  res.json(transactions);
});

app.post("/api/transactions", authenticateToken, (req: any, res) => {
  const { amount, type, category, date, payment_mode, description, bill_url } = req.body;
  const stmt = db.prepare(`
    INSERT INTO transactions (user_id, amount, type, category, date, payment_mode, description, bill_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(req.user.id, amount, type, category, date, payment_mode, description, bill_url);
  res.json({ id: info.lastInsertRowid, ...req.body });
});

app.delete("/api/transactions/:id", authenticateToken, (req: any, res) => {
  db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  res.sendStatus(204);
});

// --- User Settings ---
app.patch("/api/user/threshold", authenticateToken, (req: any, res) => {
  const { threshold } = req.body;
  db.prepare("UPDATE users SET daily_threshold = ? WHERE id = ?").run(threshold, req.user.id);
  res.sendStatus(204);
});

// --- Recurring Events ---
app.get("/api/recurring", authenticateToken, (req: any, res) => {
  const events = db.prepare("SELECT * FROM recurring_events WHERE user_id = ?").all(req.user.id);
  res.json(events);
});

app.post("/api/recurring", authenticateToken, (req: any, res) => {
  const { name, amount, day_of_month, category, type } = req.body;
  const stmt = db.prepare(`
    INSERT INTO recurring_events (user_id, name, amount, day_of_month, category, type)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(req.user.id, name, amount, day_of_month, category, type);
  res.json({ id: info.lastInsertRowid, ...req.body });
});

// --- File Upload (for bills) ---
const upload = multer({ dest: 'uploads/' });
app.post("/api/upload", authenticateToken, upload.single('file'), (req: any, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  // In a real app, we'd upload to S3/Cloudinary. Here we just return the local path.
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.use('/uploads', express.static('uploads'));

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
