import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Route, Routes, useLocation } from "react-router-dom";
import { Home } from "./screens/Home";
import { Search } from "./screens/Search";
import { Library } from "./screens/Library";
import { Player } from "./screens/Player";
import { BottomNav } from "./components/BottomNav";
import { MiniPlayer } from "./components/MiniPlayer";
import { api } from "./api/client";
import { useLibrary } from "./store/library";

export function App() {
  const location = useLocation();
  const loadLibrary = useLibrary((s) => s.load);

  useEffect(() => {
    // Establish the anonymous session cookie, then load likes.
    api.session().catch(() => {}).finally(() => void loadLibrary());
  }, [loadLibrary]);

  return (
    <div className="min-h-dvh bg-ink text-fog">
      <main className="pb-40">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/library" element={<Library />} />
          <Route path="/now" element={null} />
        </Routes>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30">
        <MiniPlayer />
        <BottomNav />
      </div>
      <AnimatePresence>{location.pathname === "/now" && <Player />}</AnimatePresence>
    </div>
  );
}
