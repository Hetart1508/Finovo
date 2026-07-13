import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { RiAlertLine, RiBarChartBoxLine, RiCoinsLine, RiDatabase2Line, RiErrorWarningLine, RiPulseLine, RiRefreshLine, RiRobot2Line } from 'react-icons/ri';
import { aiUsageApi, type AiUsageDashboard } from '@/src/api/aiUsageApi';
import { PageHeader } from '@/src/components/shared/PageHeader';
import { StatCard } from '@/src/components/shared/StatCard';
import { StateMessage } from '@/src/components/shared/StateMessage';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { formatLocalDateTime } from '@/src/utils/formatters';

const featureLabels: Record<string, string> = {
  ai_insights: 'AI Insights',
  wealth_advisor: 'Wealth Advisor chatbot',
  transaction_extraction: 'Natural-language transaction extraction',
  statement_import: 'Statement import',
  smart_bill_fetching: 'Smart Upload bill fetching',
};

const formatNumber = (value: unknown) => Number(value || 0).toLocaleString('en-IN');
const formatCost = (value: unknown) => `$${Number(value || 0).toFixed(6)}`;

export default function AIUsageDashboardPage() {
  const [dashboard, setDashboard] = useState<AiUsageDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ monthly_credit_limit: 10000, warning_percent: 80, limit_behavior: 'fallback' as 'block' | 'fallback' });

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError('');
      const { data } = await aiUsageApi.getDashboard();
      setDashboard(data);
      setForm({
        monthly_credit_limit: Number(data.settings.monthly_credit_limit),
        warning_percent: Number(data.settings.warning_percent),
        limit_behavior: data.settings.limit_behavior,
      });
    } catch (requestError: any) {
      setError(requestError?.response?.status === 403 ? 'This dashboard is restricted to the authorized account.' : 'Could not load AI usage statistics.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => { void load(true); }, 15_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const featureRows = useMemo(() => Object.entries(featureLabels).map(([feature, label]) => {
    const value = dashboard?.features.find((item) => item.feature === feature);
    return {
      feature,
      label,
      total_requests: Number(value?.total_requests || 0),
      input_tokens: Number(value?.input_tokens || 0),
      output_tokens: Number(value?.output_tokens || 0),
      estimated_cost_usd: Number(value?.estimated_cost_usd || 0),
      failed_requests: Number(value?.failed_requests || 0),
    };
  }), [dashboard]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      const { data } = await aiUsageApi.updateSettings(form);
      setDashboard(data);
      toast.success('AI usage limits updated');
    } catch (requestError: any) {
      toast.error(requestError?.response?.data?.error || 'Could not update AI usage limits');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <StateMessage>Loading AI usage dashboard…</StateMessage>;
  if (error || !dashboard) return <StateMessage>{error || 'AI usage dashboard unavailable'}</StateMessage>;

  const { summary, settings } = dashboard;
  const limitPercent = settings.monthly_credit_limit > 0
    ? Math.min(100, Number(summary.credits_used || 0) / settings.monthly_credit_limit * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gemini Usage"
        description={(
          <span className="flex flex-wrap items-center gap-2">
            <span>Server-side token, cost, fallback, and quota monitoring for {dashboard.month}.</span>
            {dashboard.keys.map((key) => <span key={key.identifier} className="rounded-full bg-[#EEF6FF] px-2 py-1 text-xs font-bold text-[#357CCB]">{key.identifier}</span>)}
          </span>
        )}
        actions={(
          <Button variant="outline" disabled={refreshing} onClick={() => void load(true)}>
            <RiRefreshLine className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh usage'}
          </Button>
        )}
      />

      {settings.warning_active ? (
        <div className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${settings.limit_reached ? 'border-[#FF6B6B]/30 bg-[#FFF1F1]' : 'border-[#FFB84D]/40 bg-[#FFF7E8]'}`}>
          <RiAlertLine className="mt-0.5 shrink-0 text-xl" aria-hidden="true" />
          <div>
            <p className="font-bold">{settings.limit_reached ? 'Monthly credit limit reached' : 'Monthly credit warning'}</p>
            <p className="mt-1 text-[#6B7280]">
              {formatNumber(summary.credits_used)} of {formatNumber(settings.monthly_credit_limit)} credits used. Limit action: {settings.limit_behavior}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total AI requests" value={formatNumber(summary.total_requests)} icon={<RiPulseLine />} iconClassName="bg-[#EEF6FF] text-[#4F9CF9]" />
        <StatCard label="Input tokens" value={formatNumber(summary.input_tokens)} icon={<RiDatabase2Line />} iconClassName="bg-[#EEF6FF] text-[#4F9CF9]" />
        <StatCard label="Output tokens" value={formatNumber(summary.output_tokens)} icon={<RiBarChartBoxLine />} iconClassName="bg-[#EAFBF0] text-[#34C759]" />
        <StatCard label="Estimated cost" value={formatCost(summary.estimated_cost_usd)} helper={`${formatNumber(summary.credits_used)} credits`} icon={<RiCoinsLine />} iconClassName="bg-[#FFF7E8] text-[#D98B16]" />
        <StatCard label="Failed requests" value={formatNumber(summary.failed_requests)} icon={<RiErrorWarningLine />} iconClassName="bg-[#FFF1F1] text-[#FF6B6B]" />
        <StatCard label="Quota/rate-limit errors" value={formatNumber(summary.quota_errors)} icon={<RiAlertLine />} iconClassName="bg-[#FFF7E8] text-[#D98B16]" />
        <StatCard label="Active model" value={summary.active_model || 'No usage yet'} helper={summary.active_provider || '—'} icon={<RiRobot2Line />} iconClassName="bg-[#EEF6FF] text-[#4F9CF9]" valueClassName="break-words text-lg" />
        <StatCard label="Remaining credits" value={settings.remaining_credits === null ? 'Unlimited' : formatNumber(settings.remaining_credits)} helper={`${limitPercent.toFixed(1)}% used`} icon={<RiCoinsLine />} iconClassName="bg-[#EAFBF0] text-[#34C759]" />
      </div>

      <Card>
        <CardHeader><CardTitle>Usage by feature</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {featureRows.map((row) => (
            <div key={row.feature} className="grid min-w-0 grid-cols-2 gap-3 rounded-lg border border-[#E5E7EB] p-3 text-sm sm:grid-cols-[minmax(14rem,1.5fr)_repeat(5,minmax(6rem,1fr))] sm:items-center">
              <p className="col-span-2 min-w-0 font-bold sm:col-span-1">{row.label}</p>
              <UsageValue label="Requests" value={formatNumber(row.total_requests)} />
              <UsageValue label="Input" value={formatNumber(row.input_tokens)} />
              <UsageValue label="Output" value={formatNumber(row.output_tokens)} />
              <UsageValue label="Cost" value={formatCost(row.estimated_cost_usd)} />
              <UsageValue label="Failed" value={formatNumber(row.failed_requests)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Monthly controls</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-credit-limit">Monthly credit limit</Label>
              <Input id="monthly-credit-limit" type="number" min="0" value={form.monthly_credit_limit} onChange={(event) => setForm((value) => ({ ...value, monthly_credit_limit: Number(event.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warning-percent">Warning threshold (%)</Label>
              <Input id="warning-percent" type="number" min="1" max="100" value={form.warning_percent} onChange={(event) => setForm((value) => ({ ...value, warning_percent: Number(event.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit-behavior">After limit</Label>
              <select id="limit-behavior" className="h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-semibold" value={form.limit_behavior} onChange={(event) => setForm((value) => ({ ...value, limit_behavior: event.target.value as 'block' | 'fallback' }))}>
                <option value="fallback">Use backup providers</option>
                <option value="block">Block AI requests</option>
              </select>
            </div>
            <Button className="w-full" disabled={saving} onClick={saveSettings}>{saving ? 'Saving…' : 'Save controls'}</Button>
            <p className="text-xs leading-5 text-[#6B7280]">One credit equals ${settings.credit_usd} of estimated usage. Gemini cost uses configurable model rates and reported tokens.</p>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader><CardTitle>Latest 5 provider requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recent.length ? dashboard.recent.map((item, index) => (
              <div key={`${item.created_at}-${index}`} className="grid min-w-0 grid-cols-2 gap-3 rounded-lg border border-[#E5E7EB] p-3 text-sm md:grid-cols-[1.2fr_1.5fr_1fr_.7fr_.7fr] md:items-center">
                <div className="min-w-0"><p className="truncate font-bold">{item.provider}</p><p className="truncate text-xs text-[#6B7280]">{item.key_identifier || 'No key identifier'}</p></div>
                <div className="min-w-0"><p className="truncate font-semibold">{item.model}</p><p className="text-xs text-[#6B7280]">{formatLocalDateTime(item.created_at)}</p></div>
                <UsageValue label="Tokens" value={`${formatNumber(item.input_tokens)} / ${formatNumber(item.output_tokens)}`} />
                <UsageValue label="Cost" value={formatCost(item.estimated_cost_usd)} />
                <div><span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${item.status === 'success' ? 'bg-[#EAFBF0] text-[#218A44]' : 'bg-[#FFF1F1] text-[#D94B4B]'}`}>{item.status}</span></div>
              </div>
            )) : <p className="py-6 text-center text-sm text-[#6B7280]">No AI requests recorded this month.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsageValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[0.7rem] font-semibold uppercase text-[#6B7280]">{label}</p><p className="truncate font-semibold">{value}</p></div>;
}
