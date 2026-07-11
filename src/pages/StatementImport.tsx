import { Button } from '@/src/components/ui/button';
import { PageHeader } from '@/src/components/shared/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { merchantAliasesQuery } from '@/src/server-state/merchantAliasesQueries';
import { RiUploadCloudLine } from 'react-icons/ri';
import { MerchantAliasesCard } from '@/src/features/statement-import/components/MerchantAliasesCard';
import { StatementImportNotice } from '@/src/features/statement-import/components/StatementImportNotice';
import { StatementPreviewCard } from '@/src/features/statement-import/components/StatementPreviewCard';
import { StatementSummaryCards } from '@/src/features/statement-import/components/StatementSummaryCards';
import { StatementPasswordDialog } from '@/src/features/statement-import/components/StatementPasswordDialog';
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
    passwordProtectedFile,
    passwordError,
    totals,
    handleStatementFile,
    handleStatementPassword,
    cancelStatementPassword,
    handleRemovePreviewRow,
    handleToggleTransactionType,
    handleMerchantNameChange,
    handleApproveAll,
  } = useStatementImport();
  const { aliasEdits, setAliasEdits, deleteAlias, updateAlias } = useMerchantAliasMutations();

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 overflow-x-hidden">
      <PageHeader
        title="Statement Import"
        description="Extract income and expenses from a bank, card, UPI, or wallet statement before saving them."
        actions={(
          <Button className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={previewLoading || approveLoading}>
            <RiUploadCloudLine className="text-base" aria-hidden="true" />
            {previewLoading ? 'Reading Statement...' : 'Select Statement File'}
          </Button>
        )}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(event) => handleStatementFile(event.target.files?.[0] || null)}
      />

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

      <StatementPasswordDialog
        file={passwordProtectedFile}
        error={passwordError}
        loading={previewLoading}
        onSubmit={handleStatementPassword}
        onCancel={cancelStatementPassword}
      />
    </div>
  );
}
