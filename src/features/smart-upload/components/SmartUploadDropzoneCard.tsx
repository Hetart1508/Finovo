import type { DropzoneState } from 'react-dropzone';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/lib/utils';
import { RiCloseCircleLine, RiUploadCloudLine } from 'react-icons/ri';

type SmartUploadDropzoneCardProps = {
  preview: string | null;
  dropzone: DropzoneState;
  onClearPreview: () => void;
};

export function SmartUploadDropzoneCard({ preview, dropzone, onClearPreview }: SmartUploadDropzoneCardProps) {
  const { getRootProps, getInputProps, isDragActive } = dropzone;

  return (
    <Card className="border-dashed border-2 border-[#E5E7EB] bg-transparent">
      <CardContent className="p-0">
        {!preview ? (
          <div
            {...getRootProps()}
            className={cn(
              'h-[400px] flex flex-col items-center justify-center cursor-pointer transition-colors p-8 text-center',
              isDragActive ? 'bg-[#EEF6FF] bg-[#EEF6FF]' : 'hover:bg-[#FAFBFC]'
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
              onClick={onClearPreview}
            >
              <RiCloseCircleLine className="text-base" aria-hidden="true" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
