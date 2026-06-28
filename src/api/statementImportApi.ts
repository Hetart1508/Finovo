import api from '@/src/lib/api';

export type StatementImportPreviewPayload = {
  base64Data: string;
  mimeType: string;
};

export type StatementImportApprovePayload<TTransaction> = {
  transactions: TTransaction[];
  statementHash: string;
};

export const statementImportApi = {
  preview: (payload: StatementImportPreviewPayload) => api.post('/statement-import/preview', payload),
  approve: <TTransaction>(payload: StatementImportApprovePayload<TTransaction>) =>
    api.post('/statement-import/approve', payload),
};
