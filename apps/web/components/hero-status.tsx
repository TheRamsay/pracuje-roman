import { formatDateTime } from "../lib/format";
import type { LatestObservation } from "../lib/dashboard";

type HeroStatusProps = {
  worksNow: boolean;
  latestObservation: LatestObservation | null;
};

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
      <path
        d="M20 6 9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

export function HeroStatus({ worksNow, latestObservation }: HeroStatusProps) {
  const activityLabel = latestObservation?.activityName ?? "Bez známé aktivity";
  const observedLabel = latestObservation
    ? formatDateTime(latestObservation.observedAt)
    : "Zatím bez pozorování";

  return (
    <section className="relative overflow-hidden rounded-lg border border-line bg-panel shadow-panel">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(110,231,249,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.16),transparent_28%)]" />
      <div className="relative grid gap-8 px-6 py-8 md:grid-cols-[minmax(0,2.2fr)_minmax(300px,1fr)] md:px-8 md:py-9">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent/80">
              Přehled aktivity
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-text md:text-6xl">
              Pracuje Roman?
            </h1>
          </div>

          <div
            className={[
              "inline-flex min-h-16 items-center gap-3 rounded-lg border px-5 py-3 text-2xl font-semibold md:text-3xl",
              worksNow
                ? "border-emerald-400/35 bg-emerald-400/10 text-ok"
                : "border-rose-400/35 bg-rose-400/10 text-danger"
            ].join(" ")}
          >
            {worksNow ? <CheckIcon /> : <XIcon />}
            <span>{worksNow ? "Ano" : "Ne"}</span>
          </div>

          <p className="max-w-2xl text-sm leading-7 text-muted md:text-base">
            Poslední zachycená aktivita: <span className="text-text">{activityLabel}</span>.
            Odpověď v hero sekci vychází čistě z boolean hodnoty pro aktuální stav.
          </p>
        </div>

        <aside className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Poslední update</p>
            <p className="mt-2 text-xl font-medium text-text">{observedLabel}</p>
          </div>
          <div className="grid gap-2 border-t border-white/10 pt-3 text-sm text-muted">
            <div className="flex items-center justify-between gap-4">
              <span>Aktivita</span>
              <span className="text-right text-text">{activityLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>WoW</span>
              <span className={latestObservation?.isWow ? "text-danger" : "text-ok"}>
                {latestObservation?.isWow ? "Běží" : "Ne"}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
