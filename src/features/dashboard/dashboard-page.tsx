"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  Clock3,
  RefreshCw,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";

interface DollarQuote {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

interface QuoteResponse {
  ok: boolean;
  quotes?: { blue: DollarQuote; official: DollarQuote };
  error?: string;
}

const metrics = [
  { label: "Revenue today", value: "$18,420", delta: "+12.4%", icon: CircleDollarSign },
  { label: "This week", value: "$126,080", delta: "+8.1%", icon: WalletCards },
  { label: "This month", value: "$486,240", delta: "+16.8%", icon: ArrowUpRight },
  { label: "Active models", value: "252", delta: "+6 this month", icon: UsersRound },
];

const modelPerformance = [
  { name: "Cami Rose", handle: "@cami.rose", revenue: "$6,840", change: "+18.2%", tone: "bg-cyan-400" },
  { name: "Mila", handle: "@mila.afterdark", revenue: "$5,210", change: "+11.4%", tone: "bg-rose-400" },
  { name: "Valentina", handle: "@valen.v", revenue: "$3,940", change: "+7.8%", tone: "bg-amber-300" },
  { name: "Sofía", handle: "@sofi.private", revenue: "$2,430", change: "+4.3%", tone: "bg-emerald-400" },
];

const chartPoints = "0,126 72,112 144,118 216,86 288,94 360,58 432,66 504,31 576,39 648,12";

export function DashboardPage({ onOpenBrandBuilder }: { onOpenBrandBuilder: () => void }) {
  const [quotes, setQuotes] = useState<QuoteResponse["quotes"]>();
  const [quoteError, setQuoteError] = useState("");
  const [quoteKind, setQuoteKind] = useState<"blue" | "official">("blue");
  const [usdAmount, setUsdAmount] = useState("1000");
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  async function loadQuotes() {
    setLoadingQuotes(true);
    try {
      const response = await fetch("/api/exchange-rate");
      const data = (await response.json()) as QuoteResponse;
      if (!response.ok || !data.ok || !data.quotes) throw new Error(data.error);
      setQuotes(data.quotes);
      setQuoteError("");
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "Exchange rate unavailable.");
    } finally {
      setLoadingQuotes(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadQuotes(), 0);
    const interval = window.setInterval(() => void loadQuotes(), 300_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, []);

  const selectedQuote = quotes?.[quoteKind];
  const convertedAmount = useMemo(() => {
    const amount = Number(usdAmount.replace(",", "."));
    return Number.isFinite(amount) && selectedQuote ? amount * selectedQuote.venta : 0;
  }, [selectedQuote, usdAmount]);

  return (
    <div className="page-enter mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.8)]" />
            Agency command center
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
            Today&apos;s operation, at a glance.
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Demo metrics until live revenue sources are connected.</p>
        </div>
        <button className="button-primary group" type="button" onClick={onOpenBrandBuilder}>
          <Sparkles size={17} />
          Open Brand Builder
          <ArrowRight className="transition-transform group-hover:translate-x-0.5" size={16} />
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Agency metrics">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" style={{ animationDelay: `${index * 65}ms` }} key={metric.label}>
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/8 bg-white/[0.04] text-[var(--accent)]">
                  <Icon aria-hidden="true" size={19} />
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">{metric.delta}</span>
              </div>
              <div className="mt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{metric.label}</p>
                <strong className="mt-1 block font-mono text-3xl font-medium tracking-tight text-white">{metric.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]">
        <div className="surface-panel min-w-0 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="section-kicker">Revenue performance</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Monthly pulse</h2>
            </div>
            <div className="flex items-baseline gap-2">
              <strong className="font-mono text-2xl text-white">$486.2K</strong>
              <span className="text-xs font-bold text-emerald-300">+16.8%</span>
            </div>
          </div>
          <div className="mt-8 h-[240px] w-full overflow-hidden" aria-label="Revenue trend chart">
            <svg className="h-full w-full" role="img" viewBox="0 0 648 160" preserveAspectRatio="none">
              <title>Revenue trend over the last ten periods</title>
              {[24, 64, 104, 144].map((y) => (
                <line key={y} x1="0" x2="648" y1={y} y2={y} stroke="rgba(255,255,255,.07)" strokeWidth="1" />
              ))}
              <polyline fill="none" points={chartPoints} stroke="var(--accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              <polyline fill="none" opacity=".2" points={chartPoints} stroke="white" strokeWidth="8" />
              <circle cx="648" cy="12" fill="var(--accent)" r="5" />
              <circle cx="648" cy="12" fill="none" r="10" stroke="var(--accent)" strokeOpacity=".25" strokeWidth="6" />
            </svg>
          </div>
          <div className="grid grid-cols-5 text-center text-[11px] font-semibold text-[var(--dim)]">
            <span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          </div>
        </div>

        <CurrencyConverter
          convertedAmount={convertedAmount}
          error={quoteError}
          kind={quoteKind}
          loading={loadingQuotes}
          onAmountChange={setUsdAmount}
          onKindChange={setQuoteKind}
          onRefresh={() => void loadQuotes()}
          quote={selectedQuote}
          usdAmount={usdAmount}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4 sm:px-6">
            <div>
              <p className="section-kicker">Model performance</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Today&apos;s leaders</h2>
            </div>
            <span className="text-xs font-semibold text-[var(--muted)]">Demo data</span>
          </div>
          <div className="divide-y divide-white/6">
            {modelPerformance.map((model, index) => (
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.025] sm:px-6" key={model.name}>
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${model.tone}/15`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${model.tone}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--dim)]">0{index + 1}</span>
                    <strong className="truncate text-sm font-semibold text-white">{model.name}</strong>
                  </div>
                  <p className="truncate text-xs text-[var(--muted)]">{model.handle}</p>
                </div>
                <div className="text-right">
                  <strong className="block font-mono text-sm text-white">{model.revenue}</strong>
                  <span className="text-[11px] font-bold text-emerald-300">{model.change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel p-5 sm:p-6">
          <p className="section-kicker">System pulse</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Operational queue</h2>
          <div className="mt-5 space-y-1">
            <QueueItem icon={Bot} label="Brand reviews" value="3" detail="Ready for approval" />
            <QueueItem icon={Clock3} label="Feedback pending" value="7" detail="Needs operator input" />
            <QueueItem icon={UsersRound} label="Profiles synced" value="12" detail="Last 24 hours" />
          </div>
        </div>
      </section>
    </div>
  );
}

function CurrencyConverter({
  convertedAmount,
  error,
  kind,
  loading,
  onAmountChange,
  onKindChange,
  onRefresh,
  quote,
  usdAmount,
}: {
  convertedAmount: number;
  error: string;
  kind: "blue" | "official";
  loading: boolean;
  onAmountChange: (value: string) => void;
  onKindChange: (kind: "blue" | "official") => void;
  onRefresh: () => void;
  quote?: DollarQuote;
  usdAmount: string;
}) {
  return (
    <div className="surface-panel relative overflow-hidden p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker">USD / ARS</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Currency desk</h2>
        </div>
        <button aria-label="Refresh exchange rate" className="icon-button" disabled={loading} onClick={onRefresh} type="button">
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-white/8 bg-black/20 p-1" role="group" aria-label="Exchange rate type">
        {(["blue", "official"] as const).map((item) => (
          <button
            aria-pressed={kind === item}
            className={`min-h-9 rounded-md text-xs font-bold capitalize transition ${kind === item ? "bg-white/10 text-white shadow-sm" : "text-[var(--muted)] hover:text-white"}`}
            key={item}
            onClick={() => onKindChange(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-5 rounded-lg border border-rose-400/20 bg-rose-400/8 p-3 text-sm text-rose-200" role="alert">{error}</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <RateCell label="Buy" loading={loading} value={quote?.compra} />
            <RateCell label="Sell" loading={loading} value={quote?.venta} />
          </div>
          <div className="mt-5 space-y-3 border-t border-white/8 pt-5">
            <label className="block">
              <span className="field-caption">USD amount</span>
              <div className="mt-1.5 flex min-h-11 items-center rounded-lg border border-white/10 bg-black/25 px-3 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
                <span className="font-mono text-xs font-bold text-[var(--muted)]">USD</span>
                <input aria-label="USD amount" className="min-w-0 flex-1 bg-transparent px-3 text-right font-mono text-base text-white outline-none" inputMode="decimal" onChange={(event) => onAmountChange(event.target.value)} value={usdAmount} />
              </div>
            </label>
            <div>
              <span className="field-caption">Estimated pesos</span>
              <div className="mt-1.5 flex min-h-12 items-center justify-between rounded-lg border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3">
                <span className="font-mono text-xs font-bold text-[var(--accent)]">ARS</span>
                <strong className="font-mono text-lg text-white">{formatArs(convertedAmount)}</strong>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-[var(--dim)]">
            {quote ? `Updated ${formatQuoteTime(quote.fechaActualizacion)}` : "Loading live quote..."}
          </p>
        </>
      )}
    </div>
  );
}

function RateCell({ label, loading, value }: { label: string; loading: boolean; value?: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
      <span className="field-caption">{label}</span>
      {loading ? <span className="mt-2 block h-6 w-20 animate-pulse rounded bg-white/8" /> : <strong className="mt-1 block font-mono text-lg text-white">${formatArs(value ?? 0)}</strong>}
    </div>
  );
}

function QueueItem({ icon: Icon, label, value, detail }: { icon: typeof Bot; label: string; value: string; detail: string }) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/6 py-3 last:border-0">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.04] text-[var(--muted)]"><Icon size={16} /></div>
      <div><strong className="block text-sm font-semibold text-white">{label}</strong><span className="text-xs text-[var(--dim)]">{detail}</span></div>
      <strong className="font-mono text-lg text-white">{value}</strong>
    </div>
  );
}

function formatArs(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function formatQuoteTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(value));
}
