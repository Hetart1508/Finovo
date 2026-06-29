import { motion } from 'motion/react';
import { AppDatePicker } from '@/src/components/ui/app-date-picker';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { cn } from '@/lib/utils';
import { RiCheckboxCircleLine, RiCloseCircleLine, RiRefreshLine, RiUploadCloudLine } from 'react-icons/ri';
import { billCategories } from '../smartUpload.constants';
import type { ExtractedBill } from '../smartUpload.types';

type SmartUploadResultPanelProps = {
  hasFile: boolean;
  loading: boolean;
  extractionError: string | null;
  extractedData: ExtractedBill | null;
  todayDateString: string;
  onExtract: () => void;
  onEnterManually: () => void;
  onExtractedDataChange: (value: ExtractedBill | null) => void;
  onSave: (event: React.FormEvent) => void;
};

export function SmartUploadResultPanel({
  hasFile,
  loading,
  extractionError,
  extractedData,
  todayDateString,
  onExtract,
  onEnterManually,
  onExtractedDataChange,
  onSave,
}: SmartUploadResultPanelProps) {
  if (extractionError) {
    return (
      <Card className="h-full flex flex-col items-center justify-center p-8 text-center border-dashed border-[#FFF1F1] bg-[#FFF1F1]/50 ">
        <RiCloseCircleLine className="mb-4 text-4xl text-[#FF6B6B]" aria-hidden="true" />
        <h3 className="font-semibold text-[#FF6B6B] ">Extraction Failed</h3>
        <p className="text-sm text-[#FF6B6B]  mt-2 max-w-md">{extractionError}</p>
        <div className="space-y-2 mt-6">
          <Button className="w-full" onClick={onExtract} disabled={loading}>
            {loading ? (
              <>
                <RiRefreshLine className="mr-2 text-base animate-spin" aria-hidden="true" />
                Retry
              </>
            ) : (
              'Retry AI'
            )}
          </Button>
          <Button variant="outline" className="w-full" onClick={onEnterManually}>
            Enter Manually
          </Button>
        </div>
      </Card>
    );
  }

  if (!extractedData) {
    return (
      <Card className="h-full flex flex-col items-center justify-center p-8 text-center border-none bg-[#FAFBFC] dark:bg-[#FAFBFC]">
        <div className="w-12 h-12 bg-white dark:bg-[#EEF6FF] rounded-full flex items-center justify-center shadow-sm mb-4">
          <RiRefreshLine className={cn('text-2xl text-[#4F9CF9]', loading && 'animate-spin')} aria-hidden="true" />
        </div>
        <h3 className="font-semibold">Gemini Extraction Ready</h3>
        <p className="text-sm text-[#6B7280] mt-2">Upload complete. Click to analyze.</p>
        <Button className="mt-6 w-full" onClick={onExtract} disabled={!hasFile || loading}>
          {loading
            ? <><RiRefreshLine className="mr-2 text-base animate-spin" aria-hidden="true" /> Analyzing...</>
            : <><RiUploadCloudLine className="mr-2 text-base" aria-hidden="true" /> Extract with Gemini</>}
        </Button>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-none shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">AI Extracted Details</CardTitle>
              <p className="text-sm font-medium mt-1">
                Confidence: <span className={cn(
                  'px-2 py-1 rounded-full text-xs',
                  extractedData.confidence === 'high' ? 'bg-[#EAFBF0] text-[#34C759] ' :
                    extractedData.confidence === 'medium' ? 'bg-[#FFF7E8] text-[#B87516] ' :
                      'bg-[#FFF1F1] text-[#FF6B6B] '
                )}>{extractedData.confidence.toUpperCase()}</span>
              </p>
            </div>
            <RiCheckboxCircleLine className="text-2xl text-[#34C759]" aria-hidden="true" />
          </div>
          <CardDescription>Review and edit if needed before saving.</CardDescription>
        </CardHeader>
        <form onSubmit={onSave}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Merchant / Store</Label>
              <Input
                value={extractedData.data.merchant || ''}
                onChange={(event) => onExtractedDataChange({ ...extractedData, data: { ...extractedData.data, merchant: event.target.value } })}
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
                  onChange={(event) => onExtractedDataChange({ ...extractedData, data: { ...extractedData.data, amount: parseFloat(event.target.value) || 0 } })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <AppDatePicker
                  max={todayDateString}
                  value={extractedData.data.date || ''}
                  onChange={(value) => onExtractedDataChange({ ...extractedData, data: { ...extractedData.data, date: value } })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={extractedData.data.category || ''}
                onValueChange={(value) => onExtractedDataChange({ ...extractedData, data: { ...extractedData.data, category: value } })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {billCategories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
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
            <Button variant="outline" className="flex-1" onClick={() => onExtractedDataChange(null)}>Reset</Button>
            <Button className="flex-1 bg-[#4F9CF9] hover:bg-[#3F8BE5]" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Transaction'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}
