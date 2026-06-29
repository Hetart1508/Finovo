import { RiErrorWarningLine } from 'react-icons/ri';

export function StatementImportNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[#FFF7E8] p-3 ">
      <RiErrorWarningLine className="mt-0.5 text-base text-[#FFB84D]" aria-hidden="true" />
      <p className="text-xs text-[#B87516] ">
        Statement extraction uses AI when you upload the file. Merchant names are matched locally by exact VPA—Finovo never guesses them.
      </p>
    </div>
  );
}
