import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Route, Routes, useLocation } from "react-router-dom";
import { Home } from "./screens/Home";
import { Search } from "./screens/Search";
import { Library } from "./screens/Library";
import { YouTube } from "./screens/YouTube";
import { YouTubeHost } from "./components/YouTubeHost";
// The player (three.js + shaders) loads on demand so Home stays light.
const Player = lazy(() => import("./screens/Player").then((m) => ({ default: m.Player })));
const YouTubeWatch = lazy(() => import("./screens/YouTubeWatch").then((m) => ({ default: m.YouTubeWatch })));
import { BottomNav } from "./components/BottomNav";
import { MiniPlayer } from "./components/MiniPlayer";
import { api } from "./api/client";
import { useLibrary } from "./store/library";
import { useCards } from "./store/cards";
import { useOnline } from "./lib/pwa";
import { WifiOff } from "lucide-react";

export function App() {
  const location = useLocation();
  const online = useOnline();
  const loadLibrary = useLibrary((s) => s.load);
  const loadCards = useCards((s) => s.load);

  useEffect(() => {
    // Establish the anonymous session cookie, then load likes.
    api
      .session()
      .catch(() => {})
      .finally(() => {
        void loadLibrary();
        void loadCards();
      });
  }, [loadLibrary, loadCards]);

  return (
    <div className="min-h-dvh bg-ink text-fog">
      {!online && (
        <div role="status" className="pt-safe fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-ink">
          <WifiOff size={14} /> You're offline — showing what's saved. Streaming resumes when you reconnect.
        </div>
      )}
      <main className={`pb-40 ${online ? "" : "pt-10"}`}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/library" element={<Library />} />
          <Route path="/yt" element={<YouTube />} />
          <Route path="/now" element={null} />
          <Route path="/yt/watch" element={null} />
        </Routes>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30">
        <MiniPlayer />
        <BottomNav />
      </div>
      <Suspense fallback={null}>
        <AnimatePresence>{location.pathname === "/now" && <Player />}</AnimatePresence>
        <AnimatePresence>{location.pathname === "/yt/watch" && <YouTubeWatch />}</AnimatePresence>
      </Suspense>
      <YouTubeHost />
    </div>
  );
}
