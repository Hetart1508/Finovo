import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { extractBillData } from '@/src/lib/ai';
import api from '@/src/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/lib/serverState';
import { toast } from 'react-toastify';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiRefreshLine,
  RiUploadCloudLine,
} from 'react-icons/ri';

const getTodayDateString = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

interface Extracted {
  data: {
    merchant: string;
    amount: number;
    date: string;
    category: string;
    rawText?: string;
    provider?: string;
    model?: string;
  };
  confidence: 'low' | 'medium' | 'high';
}
export default function SmartUpload() {
  const queryClient = useQueryClient();
  const extractBill = useMutation({
    mutationFn: ({ base64, mimeType }: { base64: string; mimeType: string }) => extractBillData(base64, mimeType),
  });
  const uploadBill = useMutation({
    mutationFn: (form: FormData) => api.post('/upload', form),
  });
  const createTransaction = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/transactions', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const todayDateString = getTodayDateString();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
    setExtractedData(null);
    setExtractionError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    multiple: false
  });

  const handleExtract = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setExtractionError(null);
    try {
      const base64 = preview.split(',')[1];
      const data = await extractBill.mutateAsync({ base64, mimeType: file.type });
      if (data.date > todayDateString) {
        throw new Error('Bill date cannot be in the future.');
      }
      
      // Simple confidence heuristic (can enhance with Ollama logits later)
      const confidence = data.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? 'high' : 'medium';
      
      setExtractedData({ data, confidence });
      toast.success(`${data.provider === 'gemini' ? 'Gemini' : 'AI'} extracted data (Confidence: ${confidence.toUpperCase()})`);
    } catch (error: any) {
      console.error('Extraction error:', error);
      const msg = getApiMessage(error, 'Failed to extract data');
      setExtractionError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      });
      toast.success(getApiSuccessMessage(response.data, "Transaction saved successfully"));
      setFile(null);
      setPreview(null);
      setExtractedData(null);
      setExtractionError(null);
    } catch (error: any) {
      toast.error(getApiMessage(error, 'Failed to save transaction.'));
    } finally {
      setLoading(false);
    }
  };

  const enterManually = () => {
    setExtractedData({
      data: { merchant: '', amount: 0, date: getTodayDateString(), category: 'Other' },
      confidence: 'low'
    } as Extracted);
    setExtractionError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Smart Bill Upload</h1>
        <p className="text-[#6B7280]">Upload a receipt or invoice image, and Gemini will extract the details for you.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Area */}
        <Card className="border-dashed border-2 border-[#E5E7EB] dark:border-[#E5E7EB] bg-transparent">
          <CardContent className="p-0">
            {!preview ? (
              <div 
                {...getRootProps()} 
                className={cn(
                  "h-[400px] flex flex-col items-center justify-center cursor-pointer transition-colors p-8 text-center",
                  isDragActive ? "bg-[#EEF6FF] bg-[#EEF6FF]" : "hover:bg-[#FAFBFC] dark:hover:bg-[#FAFBFC]/50"
                )}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-[#EEF6FF] bg-[#EEF6FF] rounded-full flex items-center justify-center mb-4">
                  <RiUploadCloudLine className="text-3xl text-[#4F9CF9]" aria-hidden="true" />
                </div>
                <p className="text-lg font-medium">Click or drag bill here</p>
                <p className="text-sm text-[#6B7280] mt-2">Supports JPG, JPEG, and PNG</p>
              </div>
            ) : (
              <div className="relative h-[400px] group">
                <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setFile(null); setPreview(null); setExtractedData(null); }}
                >
                  <RiCloseCircleLine className="text-base" aria-hidden="true" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extraction Results */}
        <div className="space-y-6">
          {extractionError ? (
            <Card className="h-full flex flex-col items-center justify-center p-8 text-center border-dashed border-[#FFF1F1] bg-[#FFF1F1]/50 ">
              <RiCloseCircleLine className="mb-4 text-4xl text-[#FF6B6B]" aria-hidden="true" />
              <h3 className="font-semibold text-[#FF6B6B] ">Extraction Failed</h3>
              <p className="text-sm text-[#FF6B6B]  mt-2 max-w-md">{extractionError}</p>
              <div className="space-y-2 mt-6">
                <Button className="w-full" onClick={handleExtract} disabled={loading}>
                  {loading ? (
  <>
    <RiRefreshLine className="mr-2 text-base animate-spin" aria-hidden="true" />
    Retry
  </>
) : (
  'Retry AI'
)}
                </Button>
                <Button variant="outline" className="w-full" onClick={enterManually}>
                  Enter Manually 
                </Button>
              </div>
            </Card>
          ) : !extractedData ? (
            <Card className="h-full flex flex-col items-center justify-center p-8 text-center border-none bg-[#FAFBFC] dark:bg-[#FAFBFC]">
              <div className="w-12 h-12 bg-white dark:bg-[#EEF6FF] rounded-full flex items-center justify-center shadow-sm mb-4">
                <RiRefreshLine className={cn("text-2xl text-[#4F9CF9]", loading && "animate-spin")} aria-hidden="true" />
              </div>
              <h3 className="font-semibold">Gemini Extraction Ready</h3>
              <p className="text-sm text-[#6B7280] mt-2">Upload complete. Click to analyze.</p>
              <Button 
                className="mt-6 w-full" 
                onClick={handleExtract} 
                disabled={!file || loading}
              >
                {loading ? <><RiRefreshLine className="mr-2 text-base animate-spin" aria-hidden="true" /> Analyzing...</> : <><RiUploadCloudLine className="mr-2 text-base" aria-hidden="true" /> Extract with Gemini</>}
              </Button>
            </Card>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-none shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">AI Extracted Details</CardTitle>
                      <p className="text-sm font-medium mt-1">
                        Confidence: <span className={cn(
                          'px-2 py-1 rounded-full text-xs',
                          extractedData!.confidence === 'high' ? 'bg-[#EAFBF0] text-[#34C759] ' :
                          extractedData!.confidence === 'medium' ? 'bg-[#FFF7E8] text-[#B87516] ' :
                          'bg-[#FFF1F1] text-[#FF6B6B] '
                        )}>{extractedData!.confidence.toUpperCase()}</span>
                      </p>                    
                    </div>
                    <RiCheckboxCircleLine className="text-2xl text-[#34C759]" aria-hidden="true" />
                  </div>
                  <CardDescription>Review and edit if needed before saving.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSave}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Merchant / Store</Label>
                      <Input 
                        value={extractedData.data.merchant || ''} 
                        onChange={(e) => setExtractedData({...extractedData, data: {...extractedData.data, merchant: e.target.value}})}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Amount (₹)</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={extractedData.data.amount || ''} 
                          onChange={(e) => setExtractedData({...extractedData, data: {...extractedData.data, amount: parseFloat(e.target.value) || 0}})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <AppDatePicker
                          max={todayDateString}
                          value={extractedData.data.date || ''} 
                          onChange={(value) => setExtractedData({...extractedData, data: {...extractedData.data, date: value}})}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select 
                        value={extractedData.data.category || ''} 
                        onValueChange={(v) => setExtractedData({...extractedData, data: {...extractedData.data, category: v}})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Food', 'Transport', 'Shopping', 'Utilities', 'Entertainment', 'Health', 'Other'].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {extractedData.data.rawText ? (
                      <details className="rounded-md border border-[#E5E7EB] bg-[#FAFBFC] p-3 text-left dark:border-[#E5E7EB] dark:bg-[#FAFBFC]">
                        <summary className="cursor-pointer text-sm font-medium text-[#1F2937] text-[#1F2937]">
                          OCR text
                        </summary>
                        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-[#6B7280] text-[#6B7280]">
                          {extractedData.data.rawText}
                        </pre>
                      </details>
                    ) : null}
                  </CardContent>
                  <CardFooter className="flex gap-4">
                    <Button variant="outline" className="flex-1" onClick={() => setExtractedData(null)}>Reset</Button>
                    <Button className="flex-1 bg-[#4F9CF9] hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
                      {loading ? "Saving..." : "Save Transaction"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper for cn
