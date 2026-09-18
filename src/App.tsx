import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppProvider } from "./lib/store";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Callback = lazy(() => import("./pages/Callback"));
const Guilds = lazy(() => import("./pages/Guilds"));
const GuildLayout = lazy(() => import("./pages/GuildLayout"));
const Overview = lazy(() => import("./pages/Overview"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Moderation = lazy(() => import("./pages/Moderation"));
const Music = lazy(() => import("./pages/Music"));
const LastFM = lazy(() => import("./pages/LastFM"));
const Stocks = lazy(() => import("./pages/Stocks"));
const VoiceCall = lazy(() => import("./pages/VoiceCall"));
const Verification = lazy(() => import("./pages/Verification"));
const Settings = lazy(() => import("./pages/Settings"));
const General = lazy(() => import("./pages/General"));

function Loader() {
  return (
    <div className="min-h-screen bg-[#08090c] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white animate-pulse" />
        <div className="text-[12px] text-white/30">Loading…</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename="/">
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/callback" element={<Callback />} />
            <Route path="/guilds" element={<Guilds />} />
            <Route path="/g/:guildId" element={<GuildLayout />}>
              <Route index element={<Overview />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="moderation" element={<Moderation />} />
              <Route path="music" element={<Music />} />
              <Route path="lastfm" element={<LastFM />} />
              <Route path="stocks" element={<Stocks />} />
              <Route path="voice-call" element={<VoiceCall />} />
              <Route path="verification-activity" element={<Verification />} />
              <Route path="settings/:section" element={<Settings />} />
              <Route path="general" element={<General />} />
            </Route>
            <Route path="*" element={<Navigate to="/guilds" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}
