import { HeroStatus } from "../components/hero-status";
import { SessionList } from "../components/session-list";
import { getDashboardData } from "../lib/dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getDashboardData();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <HeroStatus worksNow={data.worksNow} latestObservation={data.latestObservation} />
      <SessionList sessions={data.recentWowSessions} />
    </main>
  );
}
