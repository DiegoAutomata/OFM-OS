"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Check,
  CheckCircle2,
  Database,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
  XCircle,
} from "lucide-react";
import { CyberDataPage } from "@/features/cyberdata/cyberdata-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import type {
  BrandPlaybook,
  FeedbackEntry,
  ModelIntake,
  ModelProfile,
} from "../schemas";
import type { LearningFeedback } from "../storage";

type AppView = "dashboard" | "brand-builder" | "cyberdata" | "settings";
type PhotoDraft = { filename: string; dataUrl: string };

const initialProfile: ModelProfile = {
  name: "Cami Rose",
  identityGender: "Woman",
  age: 23,
  ageVerified: true,
  country: "Argentina",
  city: "",
  primaryBodyType: "Slim",
  secondaryBodyType: "Petite",
  height: "1.60",
  birthday: "2003-05-08",
  zodiacSign: "Taurus",
  visualTraits: "sexy mouth",
  styleTags: ["Casual", "Latina", "Girl Next Door"],
  realPersonality: "Calm and introverted",
  comfortablePersonalityOnline: ["Submissive", "Princess", "Latina GF"],
  forbiddenContent: "No content with other people",
  availableAssets: "Lingerie, boots and outfits for going out",
  hobbies: "Singing, doing yoga, modeling and dancing",
  normalLifeDetails:
    "Very spiritual, enjoys living life to the fullest without feeling guilty. Loves to sing and dance, plays piano, teaches yoga, and is a runway model.",
  musicTaste: "Dread Mar",
  additionalPhysicalTraits: "",
  confirmedFetishesOrNiches: "",
};

const operatorSessionKey = "ofms.operatorSession";
const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "brand-builder", label: "Brand Builder", icon: Sparkles },
  { id: "cyberdata", label: "CyberData", icon: Database },
] satisfies Array<{ id: AppView; label: string; icon: typeof LayoutDashboard }>;

function subscribeOperatorSession(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(operatorSessionKey, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(operatorSessionKey, callback);
  };
}

function getOperatorSessionSnapshot() {
  return window.localStorage.getItem(operatorSessionKey) ?? "";
}

function setOperatorSession(code: string) {
  if (code) window.localStorage.setItem(operatorSessionKey, code);
  else window.localStorage.removeItem(operatorSessionKey);
  window.dispatchEvent(new Event(operatorSessionKey));
}

export function BrandBuilderApp() {
  const storedOperatorCode = useSyncExternalStore(
    subscribeOperatorSession,
    getOperatorSessionSnapshot,
    () => "",
  );
  const [operatorCode, setOperatorCode] = useState("");
  const [newOperatorCode, setNewOperatorCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ModelProfile>(initialProfile);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [draftOutput, setDraftOutput] = useState<BrandPlaybook | null>(null);
  const [approvedOutput, setApprovedOutput] = useState<BrandPlaybook | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [learningFeedback, setLearningFeedback] = useState<LearningFeedback[]>([]);
  const [learningWarning, setLearningWarning] = useState("");
  const [status, setStatus] = useState("Waiting for operator login.");
  const [busy, setBusy] = useState("");
  const activeOperatorCode = storedOperatorCode || operatorCode;
  const authorized = Boolean(storedOperatorCode) || verified;
  const displayedStatus =
    storedOperatorCode && status === "Waiting for operator login."
      ? "Operator session restored."
      : status;

  const intake = useMemo<ModelIntake>(() => ({ profile, photos }), [profile, photos]);

  useEffect(() => {
    if (activeView !== "settings" || !authorized || !activeOperatorCode) return;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/brand-builder/learning", {
          headers: { "x-operator-code": activeOperatorCode },
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load learning feedback.");
        if (active) {
          setLearningFeedback(data.entries ?? []);
          setLearningWarning(data.warning ?? "");
        }
      } catch (error) {
        if (active) setLearningWarning(error instanceof Error ? error.message : "Unable to load learning feedback.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [activeView, activeOperatorCode, authorized]);

  async function verifyOperator() {
    setBusy("login");
    try {
      const response = await fetch("/api/operator/verify", {
        method: "POST",
        headers: { "x-operator-code": operatorCode },
      });
      if (!response.ok) throw new Error("Invalid access code.");
      setVerified(true);
      setOperatorSession(operatorCode);
      setStatus("Operator access confirmed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to verify operator.");
    } finally {
      setBusy("");
    }
  }

  function navigate(view: AppView) {
    setActiveView(view);
    setMobileNavOpen(false);
  }

  function logout() {
    setOperatorSession("");
    setVerified(false);
    setOperatorCode("");
    setActiveView("dashboard");
    setStatus("Operator session closed.");
  }

  async function selectPhotos(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, 3);
    setPhotos(
      await Promise.all(
        selected.map(async (file) => ({ filename: file.name, dataUrl: await readFileAsDataUrl(file) })),
      ),
    );
  }

  async function generateOutput() {
    setBusy("generate");
    try {
      const response = await fetch("/api/brand-builder/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-operator-code": activeOperatorCode,
        },
        body: JSON.stringify({ intake }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Generation failed.");
      setDraftOutput(data.output);
      setApprovedOutput(data.output);
      setFeedback({});
      setStatus(data.provider === "mock" ? "Generated with local mock." : `Generated with ${data.provider}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setBusy("");
    }
  }

  async function saveApprovedOutput() {
    if (!draftOutput || !approvedOutput) return;
    setBusy("save");
    try {
      const response = await fetch("/api/brand-builder/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-operator-code": activeOperatorCode,
        },
        body: JSON.stringify({
          intake,
          draftOutput,
          approvedOutput,
          feedback: buildFeedbackEntries(draftOutput, approvedOutput, feedback),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Save failed.");
      setStatus(data.persisted ? "Approved branding saved to CyberData." : data.warning);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy("");
    }
  }

  async function changeOperatorCode() {
    setBusy("settings");
    try {
      const response = await fetch("/api/operator/access-code", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-operator-code": activeOperatorCode,
        },
        body: JSON.stringify({ newCode: newOperatorCode }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to update access code.");
      setOperatorCode(newOperatorCode);
      setOperatorSession(newOperatorCode);
      setNewOperatorCode("");
      setStatus("Operator access code updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update access code.");
    } finally {
      setBusy("");
    }
  }

  async function reviewFeedbackEntry(
    id: string,
    status: "approved" | "rejected",
    scope: "global" | "archetype",
  ) {
    setBusy(`learning-${id}`);
    try {
      const response = await fetch("/api/brand-builder/learning", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-operator-code": activeOperatorCode,
        },
        body: JSON.stringify({ id, status, scope }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to review feedback.");
      setLearningFeedback((entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, status, scope } : entry)),
      );
      setStatus(status === "approved" ? "Feedback added to active brand memory." : "Feedback rejected.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to review feedback.");
    } finally {
      setBusy("");
    }
  }

  function updateProfile<K extends keyof ModelProfile>(key: K, value: ModelProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateOutput(key: "finalBio" | "brandVoice", value: string) {
    setApprovedOutput((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateRoute(index: number, key: "title" | "discoveryBio", value: string) {
    setApprovedOutput((current) => {
      if (!current) return current;
      const routes = current.routes.map((route, routeIndex) =>
        routeIndex === index ? { ...route, [key]: value } : route,
      ) as BrandPlaybook["routes"];
      return {
        ...current,
        routes,
        finalBio:
          key === "discoveryBio" && current.recommendedRouteId === routes[index].routeId
            ? value
            : current.finalBio,
      };
    });
  }

  function selectRoute(index: number) {
    setApprovedOutput((current) => {
      const route = current?.routes[index];
      if (!current || !route) return current;
      return {
        ...current,
        recommendedRouteId: route.routeId,
        finalBio: route.discoveryBio,
      };
    });
  }

  if (!authorized) {
    return (
      <main className="login-screen min-h-screen p-4 sm:p-6">
        <form
          className="login-panel page-enter w-full max-w-md rounded-lg border border-white/10 bg-[var(--surface)] p-6 shadow-[0_30px_90px_rgba(0,0,0,.45)] sm:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            void verifyOperator();
          }}
        >
          <BrandMark />
          <div className="my-7 border-y border-white/8 py-7">
            <p className="section-kicker">Private workspace</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Operator access</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Enter the agency access code to continue to OFM OS.</p>
          </div>
          <label className="block">
            <span className="field-caption">Access code</span>
            <input
              autoComplete="current-password"
              autoFocus
              className="control-input mt-2"
              onChange={(event) => setOperatorCode(event.target.value)}
              type="password"
              value={operatorCode}
            />
          </label>
          <button className="button-primary mt-4 w-full" disabled={!operatorCode.trim() || busy === "login"} type="submit">
            {busy === "login" ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
            Enter OFM OS
          </button>
          <p aria-live="polite" className="mt-4 min-h-5 text-xs text-[var(--muted)]">{displayedStatus}</p>
        </form>
      </main>
    );
  }

  const activeLabel = activeView === "brand-builder" ? "Brand Builder" : activeView === "cyberdata" ? "CyberData" : activeView === "settings" ? "Settings" : "Dashboard";

  return (
    <main className="flex h-dvh min-h-0 w-full overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {mobileNavOpen ? <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/65 md:hidden" onClick={() => setMobileNavOpen(false)} type="button" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-white/8 bg-[var(--sidebar)] px-4 py-5 transition-transform duration-200 md:static md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <BrandMark compact />
          <button aria-label="Close navigation" className="icon-button mobile-nav-control" onClick={() => setMobileNavOpen(false)} type="button"><X size={17} /></button>
        </div>
        <nav aria-label="Primary navigation" className="mt-9 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]">Workspace</p>
          {navigation.map((item) => (
            <NavButton active={activeView === item.id} icon={item.icon} key={item.id} label={item.label} onClick={() => navigate(item.id)} />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <nav aria-label="Settings navigation">
            <NavButton active={activeView === "settings"} icon={Settings} label="Settings" onClick={() => navigate("settings")} />
          </nav>
          <div className="flex items-center gap-3 border-t border-white/8 px-2 pt-4">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] text-xs font-black text-black">OP</div>
            <div className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">Operator</strong><span className="text-[10px] text-emerald-300">Verified session</span></div>
            <button aria-label="Log out" className="icon-button" onClick={logout} title="Log out" type="button"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between border-b border-white/8 bg-[var(--bg)]/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button aria-label="Open navigation" className="icon-button mobile-nav-control" onClick={() => setMobileNavOpen(true)} type="button"><Menu size={18} /></button>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--dim)]">OFM OS</p><p className="text-sm font-semibold text-white sm:text-base">{activeLabel}</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-bold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />System online
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto" id="main-content">
          {activeView === "dashboard" ? <DashboardPage onOpenBrandBuilder={() => navigate("brand-builder")} /> : null}
          {activeView === "cyberdata" ? <CyberDataPage onOpenBrandBuilder={() => navigate("brand-builder")} operatorCode={activeOperatorCode} /> : null}
          {activeView === "settings" ? (
            <SettingsPage
              busy={busy}
              learningFeedback={learningFeedback}
              learningWarning={learningWarning}
              newOperatorCode={newOperatorCode}
              onChange={setNewOperatorCode}
              onReview={(id, status, scope) => void reviewFeedbackEntry(id, status, scope)}
              onSubmit={() => void changeOperatorCode()}
              status={displayedStatus}
            />
          ) : null}
          {activeView === "brand-builder" ? (
            <BrandBuilderWorkspace
              approvedOutput={approvedOutput}
              busy={busy}
              displayedStatus={displayedStatus}
              draftOutput={draftOutput}
              feedback={feedback}
              onFeedbackChange={setFeedback}
              onGenerate={() => void generateOutput()}
              onOutputChange={updateOutput}
              onPhotosChange={(files) => void selectPhotos(files)}
              onProfileChange={updateProfile}
              onRouteChange={updateRoute}
              onSelectRoute={selectRoute}
              onSave={() => void saveApprovedOutput()}
              photos={photos}
              profile={profile}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function BrandBuilderWorkspace({
  approvedOutput,
  busy,
  displayedStatus,
  draftOutput,
  feedback,
  onFeedbackChange,
  onGenerate,
  onOutputChange,
  onPhotosChange,
  onProfileChange,
  onRouteChange,
  onSelectRoute,
  onSave,
  photos,
  profile,
}: {
  approvedOutput: BrandPlaybook | null;
  busy: string;
  displayedStatus: string;
  draftOutput: BrandPlaybook | null;
  feedback: Record<string, string>;
  onFeedbackChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onGenerate: () => void;
  onOutputChange: (key: "finalBio" | "brandVoice", value: string) => void;
  onPhotosChange: (files: FileList | null) => void;
  onProfileChange: <K extends keyof ModelProfile>(key: K, value: ModelProfile[K]) => void;
  onRouteChange: (index: number, key: "title" | "discoveryBio", value: string) => void;
  onSelectRoute: (index: number) => void;
  onSave: () => void;
  photos: PhotoDraft[];
  profile: ModelProfile;
}) {
  return (
    <div className="page-enter mx-auto w-full max-w-[1700px] space-y-5 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col gap-5 border-b border-white/8 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="section-kicker">Role 01 · Brand intelligence</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Brand Builder</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            {['Intake', 'Photos', 'Generate', 'Review'].map((step, index) => (
              <span className="flex items-center gap-2" key={step}><span className={`grid h-6 w-6 place-items-center rounded-full border font-mono text-[10px] ${index === 0 ? 'border-[var(--accent)] bg-[var(--accent)] text-black' : 'border-white/12 bg-white/[0.03] text-[var(--muted)]'}`}>{index + 1}</span>{step}{index < 3 ? <span className="mx-1 h-px w-4 bg-white/10" /> : null}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="button-primary" disabled={photos.length !== 3 || busy === "generate"} onClick={onGenerate} type="button">
            {busy === "generate" ? <Loader2 className="animate-spin" size={17} /> : <WandSparkles size={17} />}Generate 3 routes
          </button>
          <button className="button-secondary" disabled={!approvedOutput || busy === "save"} onClick={onSave} type="button">{busy === "save" ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}Save to CyberData</button>
        </div>
      </header>

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-5">
          <section className="surface-panel p-5 sm:p-6">
            <SectionHeading eyebrow="Model intake" title="Identity & positioning" />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <TextField label="Name" value={profile.name} onChange={(value) => onProfileChange("name", value)} />
              <TextField label="Identity gender" value={profile.identityGender} onChange={(value) => onProfileChange("identityGender", value)} />
              <TextField label="Age" type="number" value={String(profile.age)} onChange={(value) => onProfileChange("age", Number(value))} />
              <TextField label="Country" value={profile.country} onChange={(value) => onProfileChange("country", value)} />
              <TextField label="City" value={profile.city} onChange={(value) => onProfileChange("city", value)} />
              <TextField label="Birthday" type="date" value={profile.birthday} onChange={(value) => onProfileChange("birthday", value)} />
              <TextField label="Height" value={profile.height} onChange={(value) => onProfileChange("height", value)} />
              <TextField label="Zodiac" value={profile.zodiacSign} onChange={(value) => onProfileChange("zodiacSign", value)} />
              <TextField label="Primary body" value={profile.primaryBodyType} onChange={(value) => onProfileChange("primaryBodyType", value)} />
              <TextField label="Secondary body" value={profile.secondaryBodyType} onChange={(value) => onProfileChange("secondaryBodyType", value)} />
              <TextField className="sm:col-span-2" label="Style tags" value={profile.styleTags.join(", ")} onChange={(value) => onProfileChange("styleTags", splitTags(value))} />
            </div>
            <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[var(--text-soft)]">
              <input checked={profile.ageVerified} className="h-4 w-4 accent-[var(--accent)]" onChange={(event) => onProfileChange("ageVerified", event.target.checked)} type="checkbox" />
              <span>Age verified</span>
              <ShieldCheck className="ml-auto text-emerald-300" size={16} />
            </label>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <SectionHeading eyebrow="Character system" title="Personality & boundaries" />
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TextArea label="Visual traits" value={profile.visualTraits} onChange={(value) => onProfileChange("visualTraits", value)} />
              <TextArea label="Real personality" value={profile.realPersonality} onChange={(value) => onProfileChange("realPersonality", value)} />
              <TextField label="Comfortable personality online" value={profile.comfortablePersonalityOnline.join(", ")} onChange={(value) => onProfileChange("comfortablePersonalityOnline", splitTags(value))} />
              <TextArea label="Forbidden content" value={profile.forbiddenContent} onChange={(value) => onProfileChange("forbiddenContent", value)} />
              <TextArea label="Available assets" value={profile.availableAssets} onChange={(value) => onProfileChange("availableAssets", value)} />
              <TextArea label="Normal life details" value={profile.normalLifeDetails} onChange={(value) => onProfileChange("normalLifeDetails", value)} />
              <TextField label="Hobbies" value={profile.hobbies} onChange={(value) => onProfileChange("hobbies", value)} />
              <TextField label="Music taste" value={profile.musicTaste} onChange={(value) => onProfileChange("musicTaste", value)} />
              <TextArea label="Additional physical traits" value={profile.additionalPhysicalTraits} onChange={(value) => onProfileChange("additionalPhysicalTraits", value)} />
              <TextArea label="Confirmed fetishes or niches" value={profile.confirmedFetishesOrNiches} onChange={(value) => onProfileChange("confirmedFetishesOrNiches", value)} />
            </div>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeading eyebrow="Internal reference" title="Three model photos" />
              <label className="button-secondary cursor-pointer"><ImagePlus size={16} />Select 3 photos<input accept="image/png,image/jpeg,image/webp" className="sr-only" multiple onChange={(event) => onPhotosChange(event.target.files)} type="file" /></label>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[0, 1, 2].map((index) => {
                const photo = photos[index];
                return <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-dashed border-white/12 bg-black/20" key={index}>{photo ? <Image alt={`${photo.filename} reference`} className="object-cover" fill sizes="(max-width: 640px) 30vw, 220px" src={photo.dataUrl} unoptimized /> : <div className="grid h-full place-items-center text-center text-[var(--dim)]"><div><ImagePlus className="mx-auto" size={20} /><span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.12em]">Photo {index + 1}</span></div></div>}</div>;
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-5 2xl:sticky 2xl:top-5">
          <section className="surface-panel p-5">
            <div className="flex items-center justify-between gap-3"><p className="section-kicker">Workflow status</p><span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live</span></div>
            <p aria-live="polite" className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{displayedStatus}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${photos.length / 3 * 100}%` }} /></div>
            <p className="mt-2 text-[11px] text-[var(--dim)]">{photos.length}/3 reference photos ready</p>
          </section>

          {approvedOutput ? (
            <section className="surface-panel overflow-hidden">
              <div className="border-b border-white/8 p-5"><p className="section-kicker">Editable output</p><h2 className="mt-1 text-lg font-semibold text-white">Approved brand</h2></div>
              <div className="space-y-5 p-5">
                <TextArea label="Final bio" value={approvedOutput.finalBio} onChange={(value) => onOutputChange("finalBio", value)} />
                {draftOutput && draftOutput.finalBio !== approvedOutput.finalBio ? <TextArea label="Why did you change the final bio?" value={feedback.finalBio ?? ""} onChange={(value) => onFeedbackChange((current) => ({ ...current, finalBio: value }))} /> : null}
                <TextArea label="Brand voice" value={approvedOutput.brandVoice} onChange={(value) => onOutputChange("brandVoice", value)} />
                <div className="border-t border-white/8 pt-2">
                  {approvedOutput.routes.map((route, index) => (
                    <div className="border-b border-white/8 py-5 last:border-0" key={route.routeId}>
                      <div className="mb-4 flex flex-wrap items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--accent)]/40 font-mono text-[11px] text-[var(--accent)]">0{index + 1}</span><strong className="text-sm text-white">Brand route</strong>{approvedOutput.recommendedRouteId === route.routeId ? <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-300"><CheckCircle2 size={14} />Selected</span> : <button className="button-secondary ml-auto" onClick={() => onSelectRoute(index)} type="button"><Check size={15} />Use this route</button>}</div>
                      <div className="space-y-4"><TextField label="Route title" value={route.title} onChange={(value) => onRouteChange(index, "title", value)} /><TextArea label="Discovery bio" value={route.discoveryBio} onChange={(value) => onRouteChange(index, "discoveryBio", value)} />
                      {draftOutput?.routes[index]?.discoveryBio !== route.discoveryBio ? <TextArea label={`Why did you change route ${index + 1}?`} value={feedback[`routes.${index}.discoveryBio`] ?? ""} onChange={(value) => onFeedbackChange((current) => ({ ...current, [`routes.${index}.discoveryBio`]: value }))} /> : null}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="grid min-h-[300px] place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.018] p-8 text-center">
              <div><div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-white/[0.04] text-[var(--accent)]"><Sparkles size={20} /></div><h2 className="mt-4 text-base font-semibold text-white">Output pending</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Complete the intake and add exactly three photos to generate the brand routes.</p></div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SettingsPage({ busy, learningFeedback, learningWarning, newOperatorCode, onChange, onReview, onSubmit, status }: { busy: string; learningFeedback: LearningFeedback[]; learningWarning: string; newOperatorCode: string; onChange: (value: string) => void; onReview: (id: string, status: "approved" | "rejected", scope: "global" | "archetype") => void; onSubmit: () => void; status: string }) {
  const pending = learningFeedback.filter((entry) => entry.status === "pending");
  return (
    <div className="page-enter mx-auto w-full max-w-6xl p-4 sm:p-6 xl:p-8">
      <header className="border-b border-white/8 pb-6"><p className="section-kicker">Workspace preferences</p><h1 className="mt-2 text-3xl font-semibold text-white">Settings</h1></header>
      <section className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="surface-panel p-5 sm:p-6"><SectionHeading eyebrow="Security" title="Operator access code" /><div className="mt-6"><TextField label="New access code" type="password" value={newOperatorCode} onChange={onChange} /><button className="button-primary mt-4" disabled={newOperatorCode.trim().length < 4 || busy === "settings"} onClick={onSubmit} type="button">{busy === "settings" ? <Loader2 className="animate-spin" size={16} /> : <Settings size={16} />}Update access code</button></div></div>
        <div className="surface-panel p-5"><p className="section-kicker">Current session</p><p aria-live="polite" className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{status}</p></div>
      </section>
      <section className="surface-panel mt-6 overflow-hidden">
        <div className="border-b border-white/8 p-5 sm:p-6"><SectionHeading eyebrow="Curated memory" title="Learning review" /><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Only approved corrections influence future generations.</p></div>
        {learningWarning ? <p className="border-b border-amber-300/15 bg-amber-300/[0.05] px-5 py-3 text-sm text-amber-200">{learningWarning}</p> : null}
        {pending.length === 0 ? <p className="p-6 text-sm text-[var(--muted)]">No pending corrections.</p> : <div className="divide-y divide-white/8">{pending.map((entry) => <article className="space-y-4 p-5 sm:p-6" key={entry.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="text-sm text-white">{entry.profileName}</strong><p className="mt-1 text-xs text-[var(--dim)]">{entry.fieldPath}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--muted)]">Pending</span></div><div className="grid gap-4 lg:grid-cols-2"><div><p className="field-caption">Before</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{entry.beforeValue}</p></div><div><p className="field-caption">After</p><p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{entry.afterValue}</p></div></div><div><p className="field-caption">Operator reason</p><p className="mt-2 text-sm leading-6 text-white">{entry.reason}</p></div><div className="flex flex-wrap gap-2"><button className="button-primary" disabled={busy === `learning-${entry.id}`} onClick={() => onReview(entry.id, "approved", "archetype")} type="button"><Check size={15} />Approve for archetype</button><button className="button-secondary" disabled={busy === `learning-${entry.id}`} onClick={() => onReview(entry.id, "approved", "global")} type="button"><CheckCircle2 size={15} />Approve globally</button><button className="button-secondary" disabled={busy === `learning-${entry.id}`} onClick={() => onReview(entry.id, "rejected", "archetype")} type="button"><XCircle size={15} />Reject</button></div></article>)}</div>}
      </section>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--accent)]/35 bg-[var(--accent)]/10 font-mono text-xs font-black text-[var(--accent)] shadow-[0_0_24px_var(--accent-soft)]">OS</div><div><strong className="block text-sm font-bold tracking-wide text-white">OFM OS</strong>{compact ? <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]">Operations</span> : null}</div></div>;
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof LayoutDashboard; label: string; onClick: () => void }) {
  return <button aria-current={active ? "page" : undefined} className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition ${active ? "bg-white/[0.07] text-white shadow-[inset_3px_0_0_var(--accent)]" : "text-[var(--muted)] hover:bg-white/[0.035] hover:text-white"}`} onClick={onClick} type="button"><Icon className={active ? "text-[var(--accent)]" : "text-[var(--dim)] group-hover:text-[var(--text-soft)]"} size={17} /><span className="min-w-0 flex-1 truncate">{label}</span>{active ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}</button>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="section-kicker">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-white">{title}</h2></div>;
}

function TextField({ className = "", label, onChange, type = "text", value }: { className?: string; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className={`block min-w-0 ${className}`}><span className="field-caption">{label}</span><input className="control-input mt-1.5" onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>;
}

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <label className="block min-w-0"><span className="field-caption">{label}</span><textarea className="control-input mt-1.5 min-h-24 resize-y py-3 leading-6" onChange={(event) => onChange(event.target.value)} value={value} /></label>;
}

function splitTags(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildFeedbackEntries(draft: BrandPlaybook, approved: BrandPlaybook, reasons: Record<string, string>): FeedbackEntry[] {
  const entries: FeedbackEntry[] = [];
  const selectedAnExistingDraft = draft.routes.some((route) => route.discoveryBio === approved.finalBio);
  const selectedApprovedRoute = approved.routes.find((route) => route.routeId === approved.recommendedRouteId);
  const finalBioComesFromSelectedRoute = selectedApprovedRoute?.discoveryBio === approved.finalBio;
  if (draft.finalBio !== approved.finalBio && !selectedAnExistingDraft && !finalBioComesFromSelectedRoute) entries.push({ fieldPath: "finalBio", beforeValue: draft.finalBio, afterValue: approved.finalBio, reason: reasons.finalBio || "Operator edited the final bio.", scope: "archetype" });
  approved.routes.forEach((route, index) => {
    const before = draft.routes[index]?.discoveryBio ?? "";
    if (before !== route.discoveryBio) entries.push({ fieldPath: `routes.${index}.discoveryBio`, beforeValue: before, afterValue: route.discoveryBio, reason: reasons[`routes.${index}.discoveryBio`] || `Operator edited route ${index + 1} discovery bio.`, scope: "archetype" });
  });
  return entries;
}
