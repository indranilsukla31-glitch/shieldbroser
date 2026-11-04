import { motion } from "framer-motion";
import { MOODS, MOOD_LABELS, type Mood } from "@artei/shared";
import { api } from "../api/client";
import { Shelf } from "../components/Shelf";

const MOOD_SUB: Record<Mood, string> = {
  chill: "Slow down, breathe out",
  focus: "Instrumental, low distraction",
  workout: "High tempo, high energy",
  latenight: "Lo-fi, jazz and city lights",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Home() {
  return (
    <div className="overflow-x-clip pb-6">
      <header className="pt-safe relative px-4 pb-2 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-glow/20 blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-10 h-96 w-96 rounded-full bg-glow-2/20 blur-[100px]" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="relative pt-8">
          <p className="text-sm font-medium text-mist">{greeting()}</p>
          <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            artei<span className="text-glow">.</span>
          </h1>
          <p className="mt-1 max-w-md text-sm text-mist">Free, Creative Commons music — and a living visual world for every song.</p>
        </motion.div>
      </header>
      <Shelf title="Trending this week" load={() => api.trending()} />
      {MOODS.map((m) => (
        <Shelf key={m} title={MOOD_LABELS[m]} subtitle={MOOD_SUB[m]} load={() => api.mood(m)} />
      ))}
    </div>
  );
}
