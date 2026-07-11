import PDFDocument from 'pdfkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { randomBytes } from 'node:crypto';

const PASSWORD = randomBytes(24).toString('base64url');
const OWNER_PASSWORD = randomBytes(24).toString('base64url');
const INCORRECT_PASSWORD = randomBytes(24).toString('base64url');

const createEncryptedStatement = () => new Promise((resolve, reject) => {
  const chunks = [];
  const document = new PDFDocument({
    userPassword: PASSWORD,
    ownerPassword: OWNER_PASSWORD,
    permissions: { copying: false, modifying: false, printing: 'lowResolution' },
  });
  document.on('data', (chunk) => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.on('error', reject);
  document.fontSize(16).text('Finovo encrypted statement fixture');
  document.fontSize(11).text('01/07/2026 UPI TEST MERCHANT Debit 125.00 Balance 875.00');
  document.end();
});

const expectPasswordFailure = async (bytes, password, expectedCode, label) => {
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), password, disableWorker: true });
  try {
    await task.promise;
    throw new Error(`${label}: encrypted PDF unexpectedly opened`);
  } catch (error) {
    if (Number(error?.code) !== expectedCode) {
      throw new Error(`${label}: expected PDF.js password code ${expectedCode}, received ${error?.code ?? error}`);
    }
  } finally {
    await task.destroy();
  }
};

const bytes = await createEncryptedStatement();

await expectPasswordFailure(
  bytes,
  undefined,
  pdfjs.PasswordResponses.NEED_PASSWORD,
  'Missing password'
);
await expectPasswordFailure(
  bytes,
  INCORRECT_PASSWORD,
  pdfjs.PasswordResponses.INCORRECT_PASSWORD,
  'Incorrect password'
);

const unlockedTask = pdfjs.getDocument({
  data: new Uint8Array(bytes),
  password: PASSWORD,
  disableWorker: true,
});
try {
  const unlockedDocument = await unlockedTask.promise;
  if (unlockedDocument.numPages !== 1) {
    throw new Error(`Correct password: expected 1 page, received ${unlockedDocument.numPages}`);
  }
  const page = await unlockedDocument.getPage(1);
  const text = (await page.getTextContent()).items.map((item) => 'str' in item ? item.str : '').join(' ');
  if (!text.includes('Finovo encrypted statement fixture')) {
    throw new Error('Correct password: decrypted page content was not readable');
  }
} finally {
  await unlockedTask.destroy();
}

console.log('Password-protected PDF verification passed: missing, incorrect, and correct password paths.');
