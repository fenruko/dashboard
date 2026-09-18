import { Outlet, useParams, Navigate } from "react-router-dom";
import { Sidebar, MobileNav } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { Background } from "../components/layout/Background";
import { useApp } from "../lib/store";

export default function GuildLayout() {
  const { guildId } = useParams();
  const { guilds, loading, token } = useApp();

  if (!token) return <Navigate to="/login" replace />;
  if (!loading && guilds.length > 0 && guildId && !guilds.find(g => g.id === guildId)) {
    // Allow anyway for analytics demo, but show warning
  }

  return (
    <div className="min-h-screen bg-[#08090c] text-white flex">
      <Background />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
