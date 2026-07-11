import api from '@/src/lib/api';

export type StatementImportPreviewPayload = {
  base64Data: string;
  mimeType: string;
  renderedPages?: Array<{ base64Data: string; mimeType: 'image/jpeg' }>;
};

export type StatementImportApprovePayload<TTransaction> = {
  transactions: TTransaction[];
  statementHash: string;
  wallet_id?: number | null;
};

export const statementImportApi = {
  preview: (payload: StatementImportPreviewPayload) => api.post('/statement-import/preview', payload),
  approve: <TTransaction>(payload: StatementImportApprovePayload<TTransaction>) =>
    api.post('/statement-import/approve', payload),
};
