import type { StatementTransaction } from './statementImport.types';
import { getTodayDateString, isFutureDateString } from '@/src/utils/dateRanges';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type RenderedStatementPage = {
  base64Data: string;
  mimeType: 'image/jpeg';
};

export type UnlockedStatementPdf = {
  pages: RenderedStatementPage[];
  extractedText: string;
};

export class StatementPasswordRequiredError extends Error {
  constructor() {
    super('This PDF is password protected.');
    this.name = 'StatementPasswordRequiredError';
  }
}

export class IncorrectStatementPasswordError extends Error {
  constructor() {
    super('Incorrect PDF password. Please try again.');
    this.name = 'IncorrectStatementPasswordError';
  }
}

const isPdfPasswordError = (error: unknown, code: number) =>
  typeof error === 'object' && error !== null && 'code' in error && Number((error as { code?: unknown }).code) === code;

const withPdfTimeout = <T>(promise: Promise<T>, timeoutMs: number, message: string) => {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
};

const extractDocumentText = async (document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>) => {
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await withPdfTimeout(document.getPage(pageNumber), 15_000, `Page ${pageNumber} took too long to open.`);
    const content = await withPdfTimeout(page.getTextContent(), 15_000, `Page ${pageNumber} text took too long to read.`);
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) pageTexts.push(`--- Page ${pageNumber} ---\n${text}`);
    page.cleanup();
  }
  return pageTexts.join('\n').slice(0, 500_000);
};

export const inspectStatementPdf = async (file: File) => {
  if (file.type !== 'application/pdf') return '';

  let task: ReturnType<typeof pdfjs.getDocument> | null = null;
  try {
    task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const document = await withPdfTimeout(task.promise, 20_000, 'The PDF took too long to open.');
    return await extractDocumentText(document);
  } catch (error) {
    if (isPdfPasswordError(error, pdfjs.PasswordResponses.NEED_PASSWORD)) {
      throw new StatementPasswordRequiredError();
    }
    throw error;
  } finally {
    await task?.destroy();
  }
};

const canvasToJpegBase64 = (canvas: HTMLCanvasElement, quality: number) =>
  canvas.toDataURL('image/jpeg', quality).split(',')[1] || '';

export const renderPasswordProtectedPdf = async (
  file: File,
  password: string,
  onProgress?: (message: string) => void
): Promise<UnlockedStatementPdf> => {
  let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  let task: ReturnType<typeof pdfjs.getDocument> | null = null;

  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      password,
    });
    document = await withPdfTimeout(
      task.promise,
      20_000,
      'The PDF took too long to unlock. Check the password or try a smaller statement.'
    );
  } catch (error) {
    if (
      isPdfPasswordError(error, pdfjs.PasswordResponses.NEED_PASSWORD) ||
      isPdfPasswordError(error, pdfjs.PasswordResponses.INCORRECT_PASSWORD)
    ) {
      throw new IncorrectStatementPasswordError();
    }
    throw error;
  }

  try {
    if (document.numPages > 25) {
      throw new Error('Password-protected statements are limited to 25 pages.');
    }

    const pages: RenderedStatementPage[] = [];
    let encodedSize = 0;
    // Keep the original encrypted PDF plus rendered pages below Express's 25 MB JSON limit.
    const originalEncodedSize = Math.ceil(file.size * 4 / 3);
    const maximumEncodedSize = Math.max(2 * 1024 * 1024, (21 * 1024 * 1024) - originalEncodedSize);

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress?.(`Preparing page ${pageNumber} of ${document.numPages}...`);
      const page = await withPdfTimeout(
        document.getPage(pageNumber),
        15_000,
        `Page ${pageNumber} took too long to open.`
      );
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Your browser could not prepare the PDF page for import.');

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const renderTask = page.render({ canvas, canvasContext: context, viewport });
      try {
        await withPdfTimeout(
          renderTask.promise,
          20_000,
          `Page ${pageNumber} took too long to render.`
        );
      } catch (error) {
        renderTask.cancel();
        throw error;
      }

      const base64Data = canvasToJpegBase64(canvas, 0.82);
      encodedSize += base64Data.length;
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();

      if (encodedSize > maximumEncodedSize) {
        throw new Error('The unlocked statement is too large to process. Try a PDF with fewer pages.');
      }
      pages.push({ base64Data, mimeType: 'image/jpeg' });
    }

    onProgress?.('Reading unlocked statement text...');
    return {
      pages,
      extractedText: await extractDocumentText(document),
    };
  } finally {
    await task?.destroy();
  }
};

export { getTodayDateString };

export const isFutureTransactionDate = isFutureDateString;

export const getDisplayDescription = (transaction: StatementTransaction) => {
  const description = transaction.original_description || transaction.description || '';
  if (!transaction.vpa) return description || '-';
  const escapedVpa = transaction.vpa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutVpa = description.replace(new RegExp(escapedVpa, 'i'), '').replace(/[\s/|:;-]+$/g, '').trim();
  return !withoutVpa || /^upi(?:\s+(?:gpay|paytm|phonepe))?$/i.test(withoutVpa)
    ? 'UPI payment'
    : withoutVpa;
};

export const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
