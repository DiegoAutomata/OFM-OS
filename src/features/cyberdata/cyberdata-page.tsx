"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Database, ImageIcon, Loader2, Search, Sparkles, UserRound } from "lucide-react";
import type { SavedModelSummary } from "@/features/brand-builder/storage";

interface CyberDataResponse {
  ok: boolean;
  models?: SavedModelSummary[];
  warning?: string;
  error?: string;
}

export function CyberDataPage({
  operatorCode,
  onOpenBrandBuilder,
}: {
  operatorCode: string;
  onOpenBrandBuilder: () => void;
}) {
  const [models, setModels] = useState<SavedModelSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadModels() {
      try {
        const response = await fetch("/api/cyberdata", {
          headers: { "x-operator-code": operatorCode },
        });
        const data = (await response.json()) as CyberDataResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load CyberData.");
        if (active) {
          setModels(data.models ?? []);
          setMessage(data.warning ?? "");
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load CyberData.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadModels();
    return () => {
      active = false;
    };
  }, [operatorCode]);

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return models;
    return models.filter((model) =>
      [model.displayName, model.identityGender, model.profile.country]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [models, query]);

  return (
    <div className="page-enter mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col gap-5 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Shared intelligence layer</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">CyberData</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">Every saved model profile and approved brand output, available to future OFM OS roles.</p>
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]" size={16} />
          <label className="sr-only" htmlFor="cyberdata-search">Search model data</label>
          <input
            className="control-input pl-10"
            id="cyberdata-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, country or identity"
            type="search"
            value={query}
          />
        </div>
      </header>

      {loading ? (
        <div className="grid min-h-[360px] place-items-center text-[var(--muted)]">
          <div className="flex items-center gap-3 text-sm"><Loader2 className="animate-spin" size={18} />Loading saved model data...</div>
        </div>
      ) : models.length === 0 ? (
        <EmptyCyberData message={message} onOpenBrandBuilder={onOpenBrandBuilder} />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
            <span>{filteredModels.length} saved {filteredModels.length === 1 ? "profile" : "profiles"}</span>
            {message ? <span className="text-amber-300">{message}</span> : null}
          </div>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3" aria-label="Saved model profiles">
            {filteredModels.map((model) => <ModelDataCard key={model.id} model={model} />)}
          </section>
        </>
      )}
    </div>
  );
}

function ModelDataCard({ model }: { model: SavedModelSummary }) {
  const output = model.approvedOutput;
  const recommendedRoute = output?.routes.find((route) => route.routeId === output.recommendedRouteId);
  return (
    <article className="group overflow-hidden rounded-lg border border-white/8 bg-[var(--surface)] transition duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_20px_45px_rgba(0,0,0,.25)]">
      <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 p-4">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-white/8 bg-black/25">
          {model.photoUrl ? (
            <Image alt={`${model.displayName} reference`} className="object-cover" fill sizes="104px" src={model.photoUrl} unoptimized />
          ) : (
            <div className="grid h-full place-items-center text-[var(--dim)]"><UserRound size={28} /></div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white">{model.displayName}</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{model.identityGender} · {model.profile.age} · {model.profile.country}</p>
            </div>
            <span className="rounded-full border border-white/8 bg-white/[0.035] px-2 py-1 font-mono text-[10px] text-[var(--muted)]">{model.photoCount}/3</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {model.profile.styleTags.slice(0, 3).map((tag) => <span className="data-tag" key={tag}>{tag}</span>)}
          </div>
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--text-soft)]">
            {output?.finalBio ?? "Model profile saved. Branding output pending."}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-white/8 bg-white/8">
        <DataCell icon={Sparkles} label="Brand route" value={recommendedRoute?.title ?? "Pending"} />
        <DataCell icon={ImageIcon} label="Last updated" value={formatDate(model.updatedAt)} />
      </div>
    </article>
  );
}

function DataCell({ icon: Icon, label, value }: { icon: typeof Sparkles; label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--dim)]"><Icon size={12} />{label}</div>
      <strong className="mt-1 block truncate text-xs font-semibold text-white">{value}</strong>
    </div>
  );
}

function EmptyCyberData({ message, onOpenBrandBuilder }: { message: string; onOpenBrandBuilder: () => void }) {
  return (
    <section className="grid min-h-[460px] place-items-center border-y border-white/8 py-16 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-[var(--accent)]"><Database size={24} /></div>
        <h2 className="mt-5 text-xl font-semibold text-white">No saved model data yet</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Approve and save a Brand Builder output. Its intake, three reference photos and final branding will appear here.</p>
        {message ? <p className="mt-3 text-xs text-amber-300">{message}</p> : null}
        <button className="button-primary mt-6" onClick={onOpenBrandBuilder} type="button"><Sparkles size={16} />Create first profile</button>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
