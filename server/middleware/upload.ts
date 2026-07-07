import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";

const uploadsDir = path.join(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const extensionForMimeType = (mimeType: string) => {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return "";
};

const hasAllowedExtension = (filename: string) =>
  allowedExtensions.has(path.extname(filename || "").toLowerCase());

export const validateUploadedFileSignature = (file: Express.Multer.File) => {
  const bytes = fs.readFileSync(file.path).subarray(0, 16);
  const mimeType = file.mimetype || "";

  if (mimeType === "application/pdf") {
    return bytes.subarray(0, 4).toString("utf8") === "%PDF";
  }

  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }

  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("utf8") === "RIFF" && bytes.subarray(8, 12).toString("utf8") === "WEBP";
  }

  return false;
};

export const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype || "") || !hasAllowedExtension(file.originalname || "")) {
      return cb(new Error("Unsupported file type"));
    }
    return cb(null, true);
  },
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
