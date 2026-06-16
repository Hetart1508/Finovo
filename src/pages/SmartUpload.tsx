import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { extractBillData } from '@/src/lib/ai';
import api from '@/src/lib/api';
import { toast } from 'react-toastify';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { getApiMessage, getApiSuccessMessage } from '@/src/lib/toastMessages';
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

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
      'application/pdf': ['.pdf'],
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
      const data = await extractBillData(base64, file.type);
      
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
    setLoading(true);
    try {
      const response = await api.post('/transactions', {
        ...extractedData.data,
        type: 'expense',
        payment_mode: 'UPI',
        description: `AI Extracted (${extractedData.confidence}): ${extractedData.data.merchant}`
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
      data: { merchant: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'Other' },
      confidence: 'low'
    } as Extracted);
    setExtractionError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Smart Bill Upload</h1>
        <p className="text-slate-500">Upload a receipt or invoice PDF/image, and Gemini will extract the details for you.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Area */}
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent">
          <CardContent className="p-0">
            {!preview ? (
              <div 
                {...getRootProps()} 
                className={cn(
                  "h-[400px] flex flex-col items-center justify-center cursor-pointer transition-colors p-8 text-center",
                  isDragActive ? "bg-indigo-50 dark:bg-indigo-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                )}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                  <i className="ki-outline ki-cloud-add text-3xl text-indigo-600" aria-hidden="true" />
                </div>
                <p className="text-lg font-medium">Click or drag bill here</p>
                <p className="text-sm text-slate-500 mt-2">Supports PDF, JPG, JPEG, and PNG</p>
              </div>
            ) : (
              <div className="relative h-[400px] group">
                {file?.type === 'application/pdf' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <i className="ki-outline ki-document mb-2 text-5xl text-slate-400" aria-hidden="true" />
                    <p className="font-medium">{file.name}</p>
                  </div>
                ) : (
                  <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                )}
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setFile(null); setPreview(null); setExtractedData(null); }}
                >
                  <i className="ki-solid ki-cross text-base" aria-hidden="true" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extraction Results */}
        <div className="space-y-6">
          {extractionError ? (
            <Card className="h-full flex flex-col items-center justify-center p-8 text-center border-dashed border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20">
              <i className="ki-solid ki-cross mb-4 text-4xl text-red-500" aria-hidden="true" />
              <h3 className="font-semibold text-red-700 dark:text-red-300">Extraction Failed</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2 max-w-md">{extractionError}</p>
              <div className="space-y-2 mt-6">
                <Button className="w-full" onClick={handleExtract} disabled={loading}>
                  {loading ? (
  <>
    <i className="ki-solid ki-refresh mr-2 text-base animate-spin" aria-hidden="true" />
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
            <Card className="h-full flex flex-col items-center justify-center p-8 text-center border-none bg-slate-50 dark:bg-slate-900">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                <i className={cn("ki-solid ki-refresh text-2xl text-indigo-600", loading && "animate-spin")} aria-hidden="true" />
              </div>
              <h3 className="font-semibold">Gemini Extraction Ready</h3>
              <p className="text-sm text-slate-500 mt-2">Upload complete. Click to analyze.</p>
              <Button 
                className="mt-6 w-full" 
                onClick={handleExtract} 
                disabled={!file || loading}
              >
                {loading ? <><i className="ki-solid ki-refresh mr-2 text-base animate-spin" aria-hidden="true" /> Analyzing...</> : "Extract with Gemini"}
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
                          extractedData!.confidence === 'high' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50' :
                          extractedData!.confidence === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50' :
                          'bg-red-100 text-red-800 dark:bg-red-900/50'
                        )}>{extractedData!.confidence.toUpperCase()}</span>
                      </p>
                      {extractedData.data.provider ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {extractedData.data.provider === 'gemini' ? 'Gemini' : extractedData.data.provider}
                          {extractedData.data.model ? ` (${extractedData.data.model})` : ''}
                        </p>
                      ) : null}
                    </div>
                    <i className="ki-solid ki-check text-2xl text-emerald-500" aria-hidden="true" />
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
                        <Input 
                          type="date"
                          value={extractedData.data.date || ''} 
                          onChange={(e) => setExtractedData({...extractedData, data: {...extractedData.data, date: e.target.value}})}
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
                      <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left dark:border-slate-800 dark:bg-slate-900">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                          OCR text
                        </summary>
                        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {extractedData.data.rawText}
                        </pre>
                      </details>
                    ) : null}
                  </CardContent>
                  <CardFooter className="flex gap-4">
                    <Button variant="outline" className="flex-1" onClick={() => setExtractedData(null)}>Reset</Button>
                    <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" type="submit" disabled={loading}>
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
