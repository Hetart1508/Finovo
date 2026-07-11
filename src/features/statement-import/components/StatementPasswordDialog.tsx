import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { RiLockPasswordLine } from 'react-icons/ri';

type StatementPasswordDialogProps = {
  file: File | null;
  error: string;
  loading: boolean;
  onSubmit: (password: string) => Promise<boolean>;
  onCancel: () => void;
};

export function StatementPasswordDialog({
  file,
  error,
  loading,
  onSubmit,
  onCancel,
}: StatementPasswordDialogProps) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    setPassword('');
  }, [file]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || loading) return;
    const unlocked = await onSubmit(password);
    if (unlocked) setPassword('');
  };

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && !loading && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF6FF] text-[#4F9CF9]">
            <RiLockPasswordLine className="text-xl" aria-hidden="true" />
          </div>
          <DialogTitle>Unlock statement PDF</DialogTitle>
          <DialogDescription>
            Enter the password for {file?.name || 'this statement'}. The password stays in your browser and is never stored or sent to Finovo.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="statement-pdf-password">PDF password</Label>
            <Input
              id="statement-pdf-password"
              type="password"
              autoComplete="off"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'statement-password-error' : undefined}
            />
            {error ? <p id="statement-password-error" className="text-sm text-[#FF6B6B]">{error}</p> : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={!password || loading}>
              {loading ? 'Unlocking...' : 'Unlock and import'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
