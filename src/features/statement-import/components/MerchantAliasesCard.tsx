import type { Dispatch, SetStateAction } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import type { MerchantAlias } from '@/src/api/merchantAliasesApi';
import { RiDeleteBin6Line, RiSave3Line, RiStore2Line } from 'react-icons/ri';

type MerchantAliasesCardProps = {
  aliases: MerchantAlias[] | undefined;
  loading: boolean;
  aliasEdits: Record<number, string>;
  setAliasEdits: Dispatch<SetStateAction<Record<number, string>>>;
  updateAlias: UseMutationResult<AxiosResponse<unknown>, Error, { id: number; company_name: string }, unknown>;
  deleteAlias: UseMutationResult<AxiosResponse<unknown>, Error, number, unknown>;
};

export function MerchantAliasesCard({
  aliases,
  loading,
  aliasEdits,
  setAliasEdits,
  updateAlias,
  deleteAlias,
}: MerchantAliasesCardProps) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RiStore2Line className="text-[#4F9CF9]" aria-hidden="true" />
          Saved UPI Merchant Names
        </CardTitle>
        <CardDescription>These names are private to your account and reused whenever the same VPA appears again.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-[#6B7280]">Loading saved merchants...</p>
        ) : !aliases?.length ? (
          <p className="text-sm text-[#6B7280]">No saved merchants yet. Import a statement to teach Finovo its first VPA.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {aliases.map((alias) => (
              <div key={alias.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] p-3">
                <div className="min-w-0">
                  <Input
                    value={aliasEdits[alias.id] ?? alias.company_name}
                    maxLength={255}
                    onChange={(event) => setAliasEdits((current) => ({ ...current, [alias.id]: event.target.value }))}
                    aria-label={`Company name for ${alias.vpa}`}
                    className="h-8 font-semibold"
                  />
                  <p className="truncate text-xs text-[#6B7280]">{alias.vpa}</p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-[#6B7280] hover:text-[#34C759]"
                    disabled={updateAlias.isPending || !(aliasEdits[alias.id] ?? alias.company_name).trim()}
                    onClick={() => updateAlias.mutate({ id: alias.id, company_name: aliasEdits[alias.id] ?? alias.company_name })}
                    aria-label={`Save ${alias.vpa}`}
                  >
                    <RiSave3Line className="text-base" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-[#6B7280] hover:text-[#FF6B6B]"
                    disabled={deleteAlias.isPending}
                    onClick={() => deleteAlias.mutate(alias.id)}
                    aria-label={`Forget ${alias.company_name}`}
                  >
                    <RiDeleteBin6Line className="text-base" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
