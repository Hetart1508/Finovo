import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return "";
};

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const originalExt = path.extname(file.originalname || "").toLowerCase().replace(/[^.\w]/g, "");
      const ext = originalExt || extensionForMimeType(file.mimetype || "");
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
  }),
});

export const getLocalUploadResponse = (file: Express.Multer.File) => ({
  url: `/uploads/${path.basename(file.filename)}`,
  storage: "local",
});

