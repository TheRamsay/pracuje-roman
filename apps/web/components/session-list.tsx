import {
  formatDateTime,
  formatDayLabel,
  formatDuration,
  formatTime
} from "../lib/format";
import type { RecentWowSession } from "../lib/dashboard";

type SessionListProps = {
  sessions: RecentWowSession[];
};

type SessionGroup = {
  dayKey: string;
  dayLabel: string;
  sessions: RecentWowSession[];
};

function groupSessionsByDay(sessions: RecentWowSession[]): SessionGroup[] {
  const grouped = new Map<string, SessionGroup>();

  for (const session of sessions) {
    const dayKey = session.startedAt.slice(0, 10);
    const existing = grouped.get(dayKey);

    if (existing) {
      existing.sessions.push(session);
      continue;
    }

    grouped.set(dayKey, {
      dayKey,
      dayLabel: formatDayLabel(session.startedAt),
      sessions: [session]
    });
  }

  return Array.from(grouped.values());
}

export function SessionList({ sessions }: SessionListProps) {
  const groups = groupSessionsByDay(sessions);

  return (
    <section className="grid gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-accent/80">
            World of Warcraft
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text md:text-3xl">
            Recent sessions
          </h2>
        </div>
        <p className="text-sm text-muted">{sessions.length} zaznamu</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-panelMuted/60 px-5 py-8 text-sm text-muted">
          Zatim nejsou k dispozici zadne WoW sessions.
        </div>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <section key={group.dayKey} className="rounded-lg border border-line bg-panelMuted/72">
              <header className="border-b border-line px-5 py-4">
                <h3 className="text-lg font-medium capitalize text-text">{group.dayLabel}</h3>
              </header>

              <div className="divide-y divide-line">
                {group.sessions.map((session) => (
                  <article
                    key={session.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_160px_120px]"
                  >
                    <div className="grid gap-1">
                      <p className="text-sm font-medium text-text">
                        {formatTime(session.startedAt)} -{" "}
                        {session.endedAt ? formatTime(session.endedAt) : "bezi"}
                      </p>
                      <p className="text-xs text-muted">
                        Start: {formatDateTime(session.startedAt)}
                      </p>
                      <p className="text-xs text-muted">
                        End: {session.endedAt ? formatDateTime(session.endedAt) : "Aktivni session"}
                      </p>
                    </div>

                    <div className="flex items-center text-sm text-muted md:justify-end">
                      {session.endedAt ? "Dokonceno" : "Aktivni"}
                    </div>

                    <div className="flex items-center justify-start md:justify-end">
                      <span className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium text-text">
                        {formatDuration(session.durationSeconds)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
