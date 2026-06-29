import { Button } from '@/src/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { merchantAliasesQuery } from '@/src/server-state/merchantAliasesQueries';
import { RiUploadCloudLine } from 'react-icons/ri';
import { MerchantAliasesCard } from '@/src/features/statement-import/components/MerchantAliasesCard';
import { StatementImportNotice } from '@/src/features/statement-import/components/StatementImportNotice';
import { StatementPreviewCard } from '@/src/features/statement-import/components/StatementPreviewCard';
import { StatementSummaryCards } from '@/src/features/statement-import/components/StatementSummaryCards';
import { useMerchantAliasMutations } from '@/src/features/statement-import/hooks/useMerchantAliasMutations';
import { useStatementImport } from '@/src/features/statement-import/hooks/useStatementImport';

export default function StatementImport() {
  const aliasesResult = useQuery(merchantAliasesQuery());
  const {
    fileInputRef,
    statementFile,
    transactions,
    model,
    alreadyImported,
    previewLoading,
    approveLoading,
    approvedCount,
    totals,
    handleStatementFile,
    handleRemovePreviewRow,
    handleToggleTransactionType,
    handleMerchantNameChange,
    handleApproveAll,
  } = useStatementImport();
  const { aliasEdits, setAliasEdits, deleteAlias, updateAlias } = useMerchantAliasMutations();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statement Import</h1>
          <p className="text-[#6B7280]">Extract income and expenses from a bank, card, UPI, or wallet statement before saving them.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(event) => handleStatementFile(event.target.files?.[0] || null)}
        />

        <Button className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={previewLoading || approveLoading}>
          <RiUploadCloudLine className="text-base" aria-hidden="true" />
          {previewLoading ? 'Reading Statement...' : 'Select Statement File'}
        </Button>
      </div>

      <StatementSummaryCards statementFile={statementFile} model={model} totals={totals} />

      <MerchantAliasesCard
        aliases={aliasesResult.data}
        loading={aliasesResult.isPending}
        aliasEdits={aliasEdits}
        setAliasEdits={setAliasEdits}
        updateAlias={updateAlias}
        deleteAlias={deleteAlias}
      />

      <StatementPreviewCard
        transactions={transactions}
        alreadyImported={alreadyImported}
        previewLoading={previewLoading}
        approveLoading={approveLoading}
        approvedCount={approvedCount}
        onApproveAll={handleApproveAll}
        onToggleType={handleToggleTransactionType}
        onMerchantNameChange={handleMerchantNameChange}
        onRemoveRow={handleRemovePreviewRow}
      />

      <StatementImportNotice />
    </div>
  );
}
