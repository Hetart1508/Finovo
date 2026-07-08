import { useCallback, useState, type FormEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { extractBillData } from '@/src/lib/ai';
import { transactionsApi } from '@/src/api/transactionsApi';
import { uploadApi } from '@/src/api/uploadApi';
import { invalidateTransactions } from '@/src/server-state/invalidations';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import { useWallets } from '@/src/features/wallets/WalletProvider';
import type { ExtractedBill, ExtractedBillData } from '../smartUpload.types';
import { getExtractionConfidence, getTodayDateString } from '../smartUpload.utils';

export function useSmartUpload() {
  const queryClient = useQueryClient();
  const { selectedWalletId } = useWallets();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedBill | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const todayDateString = getTodayDateString();

  const extractBill = useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string; mimeType: string }) => extractBillData(base64, mimeType),
  });
  const uploadBill = useMutation({
    mutationFn: (form: FormData) => uploadApi.uploadBill(form),
  });
  const createTransaction = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transactionsApi.create(payload),
    onSuccess: () => invalidateTransactions(queryClient),
  });

  const clearPreview = () => {
    setFile(null);
    setPreview(null);
    setExtractedData(null);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
    setExtractedData(null);
    setExtractionError(null);
  }, []);

  const dropzone = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    multiple: false,
  });

  const handleExtract = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setExtractionError(null);
    try {
      const base64 = preview.split(',')[1];
      const data = await extractBill.mutateAsync({ base64, mimeType: file.type }) as ExtractedBillData;
      if (data.date > todayDateString) {
        throw new Error('Bill date cannot be in the future.');
      }

      const confidence = getExtractionConfidence(data);
      setExtractedData({ data, confidence });
      toast.success(`${data.provider === 'gemini' ? 'Gemini' : 'AI'} extracted data (Confidence: ${confidence.toUpperCase()})`);
    } catch (error: unknown) {
      console.error('Extraction error:', error);
      const message = getApiMessage(error, 'Failed to extract data');
      setExtractionError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!extractedData?.data) return;

    if (extractedData.data.date > todayDateString) {
      toast.error('Transaction date cannot be in the future.');
      return;
    }

    setLoading(true);
    try {
      let billUrl: string | null = null;
      if (file) {
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        const { data: uploadedBill } = await uploadBill.mutateAsync(uploadForm);
        billUrl = uploadedBill.url;
      }

      const response = await createTransaction.mutateAsync({
        ...extractedData.data,
        type: 'expense',
        payment_mode: 'UPI',
        description: `AI Extracted (${extractedData.confidence}): ${extractedData.data.merchant}`,
        bill_url: billUrl,
        wallet_id: selectedWalletId,
      });
      toast.success(getApiSuccessMessage(response.data, 'Transaction saved successfully'));
      setFile(null);
      setPreview(null);
      setExtractedData(null);
      setExtractionError(null);
    } catch (error: unknown) {
      toast.error(getApiMessage(error, 'Failed to save transaction.'));
    } finally {
      setLoading(false);
    }
  };

  const enterManually = () => {
    setExtractedData({
      data: { merchant: '', amount: 0, date: getTodayDateString(), category: 'Other' },
      confidence: 'low',
    });
    setExtractionError(null);
  };

  return {
    file,
    preview,
    loading,
    extractedData,
    setExtractedData,
    extractionError,
    todayDateString,
    dropzone,
    clearPreview,
    handleExtract,
    handleSave,
    enterManually,
  };
}
