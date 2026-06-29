import { SmartUploadDropzoneCard } from '@/src/features/smart-upload/components/SmartUploadDropzoneCard';
import { SmartUploadResultPanel } from '@/src/features/smart-upload/components/SmartUploadResultPanel';
import { useSmartUpload } from '@/src/features/smart-upload/hooks/useSmartUpload';

export default function SmartUpload() {
  const upload = useSmartUpload();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Smart Bill Upload</h1>
        <p className="text-[#6B7280]">Upload a receipt or invoice image, and Gemini will extract the details for you.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SmartUploadDropzoneCard
          preview={upload.preview}
          dropzone={upload.dropzone}
          onClearPreview={upload.clearPreview}
        />

        <div className="space-y-6">
          <SmartUploadResultPanel
            hasFile={Boolean(upload.file)}
            loading={upload.loading}
            extractionError={upload.extractionError}
            extractedData={upload.extractedData}
            todayDateString={upload.todayDateString}
            onExtract={upload.handleExtract}
            onEnterManually={upload.enterManually}
            onExtractedDataChange={upload.setExtractedData}
            onSave={upload.handleSave}
          />
        </div>
      </div>
    </div>
  );
}
