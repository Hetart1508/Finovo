import crypto from "node:crypto";

const STOP_WORDS = new Set(["a", "an", "at", "for", "in", "of", "on", "the", "to", "today", "using", "via"]);

const stemToken = (token: string) => {
  if (/^donat(?:e|ed|ion|ions)?$/i.test(token)) return "donate";
  return token.replace(/(?:ations?|ments?|ings?|ed|es|s)$/i, "");
};

export const normalizeTransactionIdentity = (value: string | null | undefined) => (value || "")
  .toLowerCase()
  .replace(/^(?:statement import|ai extracted(?: \([^)]*\))?):\s*/i, "")
  .replace(/\b(?:utr|upi ref|reference|ref no|transaction id)\b[\s:#-]*[a-z0-9-]+/gi, " ")
  .replace(/[^a-z0-9@]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const editDistance = (left: string, right: string) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      previous = current;
    }
  }
  return row[right.length];
};

const identityTokens = (value: string) => normalizeTransactionIdentity(value)
  .split(" ")
  .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  .map(stemToken);

export const areTransactionIdentitiesSimilar = (left: string, right: string) => {
  const normalizedLeft = normalizeTransactionIdentity(left);
  const normalizedRight = normalizeTransactionIdentity(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = identityTokens(normalizedLeft);
  const rightTokens = identityTokens(normalizedRight);
  if (!leftTokens.length || !rightTokens.length) return false;
  const matches = leftTokens.filter((leftToken) => rightTokens.some((rightToken) => {
    if (leftToken === rightToken) return true;
    const allowedDistance = Math.max(leftToken.length, rightToken.length) >= 6 ? 2 : 1;
    return editDistance(leftToken, rightToken) <= allowedDistance;
  })).length;
  return matches / Math.min(leftTokens.length, rightTokens.length) >= 0.6;
};

export const createTransactionFingerprint = (input: {
  walletId: number;
  date: string;
  type: string;
  amount: number;
  identity: string;
}) => crypto.createHash("sha256").update(JSON.stringify([
  input.walletId,
  input.date,
  input.type,
  input.amount.toFixed(2),
  normalizeTransactionIdentity(input.identity),
])).digest("hex");
