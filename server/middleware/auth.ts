import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";
import { queryOne } from "../db/client";

const parseCookieHeader = (cookieHeader: string | undefined) => {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separatorIndex = cookie.indexOf("=");
        if (separatorIndex === -1) return [cookie, ""];
        return [
          decodeURIComponent(cookie.slice(0, separatorIndex)),
          decodeURIComponent(cookie.slice(separatorIndex + 1)),
        ];
      })
  );
};

export const authenticateToken: RequestHandler = (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.split(" ")[1];
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies.finovo_session || bearerToken;

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please login again." });
    }
    if (err) return res.sendStatus(403);

    try {
      const activeUser = await queryOne("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [user.id]);
      if (!activeUser) return res.status(401).json({ error: "Account is no longer active. Please register again." });
      req.user = user;
      next();
    } catch {
      return res.sendStatus(500);
    }
  });
};
