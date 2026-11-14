import type { CollectionName, Mood } from "@artei/shared";
import { parseLicenseUrl } from "../lib/license.js";
import { parseLyrics } from "../lib/lyrics.js";
import { parseRange } from "../lib/range.js";
import { renderWav, type SynthSpec } from "./synth.js";
import { UpstreamError, type CatalogSource, type SourceTrack, type StreamResult } from "./types.js";

/**
 * Offline demo catalog (MOCK_CATALOG=1). All titles, artists and lyrics here are
 * original placeholder content written for this project; audio is synthesized.
 */
interface MockDef {
  id: string;
  title: string;
  artist: string;
  license: string;
  tags: string[];
  moods: Mood[];
  synth: Omit<SynthSpec, "seed">;
  lyrics?: string;
}

const L = {
  by: "https://creativecommons.org/licenses/by/4.0/",
  bysa: "https://creativecommons.org/licenses/by-sa/4.0/",
  bync: "https://creativecommons.org/licenses/by-nc/3.0/",
  byncsa: "https://creativecommons.org/licenses/by-nc-sa/3.0/",
  byncnd: "https://creativecommons.org/licenses/by-nc-nd/3.0/",
  cc0: "https://creativecommons.org/publicdomain/zero/1.0/",
};

const DEFS: MockDef[] = [
  {
    id: "m01", title: "Paper Lanterns", artist: "Demo · Mira Vale", license: L.by,
    tags: ["chillout", "downtempo", "synth"], moods: ["chill", "latenight"],
    synth: { bpm: 92, root: 57, minor: true, duration: 96, energy: 0.3 },
    lyrics: "Paper lanterns on the water\nCarry every word I never said\nDrifting slow beyond the harbour\nLighting up the road ahead\nHold the flame and let it wander\nLet the river take the thread\nPaper lanterns on the water\nCarry every word I never said",
  },
  {
    id: "m02", title: "Glass Cathedral", artist: "Demo · North Signal", license: L.byncsa,
    tags: ["ambient", "minimal", "piano"], moods: ["focus"],
    synth: { bpm: 70, root: 60, minor: false, duration: 110, energy: 0.1 },
  },
  {
    id: "m03", title: "Voltage Run", artist: "Demo · Kilo Arcade", license: L.bysa,
    tags: ["electronic", "dance", "energetic"], moods: ["workout"],
    synth: { bpm: 128, root: 50, minor: true, duration: 90, energy: 0.9 },
    lyrics: "[00:12.00]Feel the current in the floor\n[00:17.50]Every heartbeat asking more\n[00:23.00]Run the voltage through my hands\n[00:28.50]Light the city where I stand\n[00:40.00]Higher, higher\n[00:43.00]We are made of wire\n[00:46.00]Higher, higher\n[00:49.00]Set the night on fire\n[01:05.00]Feel the current in the floor\n[01:10.50]Every heartbeat asking more",
  },
  {
    id: "m04", title: "Monsoon Letters", artist: "Demo · Ananya Ray", license: L.bync,
    tags: ["lofi", "jazz", "rain"], moods: ["latenight", "chill"],
    synth: { bpm: 84, root: 55, minor: true, duration: 100, energy: 0.4 },
    lyrics: "Grey clouds folding over rooftops\nTea gone cold beside the sill\nEvery drop a little letter\nWritten slow and reading still\nI will wait out all the thunder\nI will keep the window wide\nMonsoon letters on the glass\nAnd you on the other side",
  },
  {
    id: "m05", title: "Orbit Study", artist: "Demo · Lumen Hall", license: L.cc0,
    tags: ["ambient", "space", "instrumental"], moods: ["focus", "latenight"],
    synth: { bpm: 76, root: 62, minor: false, duration: 105, energy: 0.2 },
  },
  {
    id: "m06", title: "Concrete Bloom", artist: "Demo · Teo Marsh", license: L.byncnd,
    tags: ["rock", "indie", "energetic"], moods: ["workout"],
    synth: { bpm: 140, root: 52, minor: false, duration: 88, energy: 0.8 },
    lyrics: "Cracks in the sidewalk\nGreen coming through\nNobody planted it\nIt just grew\nConcrete bloom, concrete bloom\nMaking a garden out of the gloom",
  },
  {
    id: "m07", title: "Neon Tide", artist: "Demo · Sato & Wren", license: L.by,
    tags: ["synthwave", "electronic", "night"], moods: ["latenight", "workout"],
    synth: { bpm: 110, root: 53, minor: true, duration: 95, energy: 0.6 },
  },
  {
    id: "m08", title: "Slow Morning", artist: "Demo · Field Notes", license: L.bysa,
    tags: ["acoustic", "chillout", "folk"], moods: ["chill", "focus"],
    synth: { bpm: 80, root: 64, minor: false, duration: 92, energy: 0.25 },
    lyrics: "Light through the curtain\nCoffee and rain\nNothing is certain\nNothing to explain\nSlow morning, stay a while\nLet the day wait for a smile",
  },
];

const SPECS = new Map(DEFS.map((d, i) => [d.id, { ...d.synth, seed: 1234 + i * 77 }]));

function toSource(d: MockDef): SourceTrack {
  const lyrics = parseLyrics(d.lyrics, "Demo lyrics (original placeholder text)");
  return {
    audioUrl: `mock://${d.id}`,
    lyrics,
    track: {
      ref: `mock:${d.id}`,
      title: d.title,
      artist: d.artist,
      album: "Artei Offline Demo",
      duration: d.synth.duration,
      license: parseLicenseUrl(d.license),
      tags: d.tags,
      tempo: d.synth.bpm,
      instrumental: !d.lyrics,
      hasLyrics: lyrics.kind !== "none",
    },
  };
}

export class MockSource implements CatalogSource {
  readonly name = "mock";
  private wavCache = new Map<string, Uint8Array>();

  async trending(limit: number) {
    return DEFS.slice(0, limit).map(toSource);
  }

  async byMood(mood: Mood, limit: number) {
    return DEFS.filter((d) => d.moods.includes(mood)).slice(0, limit).map(toSource);
  }

  async search(q: string, limit: number) {
    const needle = q.toLowerCase();
    return DEFS.filter((d) =>
      [d.title, d.artist, ...d.tags].some((s) => s.toLowerCase().includes(needle)),
    )
      .slice(0, limit)
      .map(toSource);
  }

  async collection(_name: CollectionName, _limit: number) {
    return [];
  }

  async get(id: string) {
    const d = DEFS.find((x) => x.id === id);
    return d ? toSource(d) : null;
  }

  private wav(id: string): Uint8Array {
    let w = this.wavCache.get(id);
    if (!w) {
      const spec = SPECS.get(id);
      if (!spec) throw new UpstreamError("Unknown mock track", 404);
      w = renderWav(spec);
      if (this.wavCache.size > 4) this.wavCache.delete(this.wavCache.keys().next().value!);
      this.wavCache.set(id, w);
    }
    return w;
  }

  async stream(audioUrl: string, range: string | undefined): Promise<StreamResult> {
    const id = audioUrl.replace("mock://", "");
    const wav = this.wav(id);
    const r = parseRange(range, wav.length);
    const base = { "content-type": "audio/wav", "accept-ranges": "bytes" };
    if (r === "unsatisfiable") {
      return { status: 416, headers: { ...base, "content-range": `bytes */${wav.length}` }, body: new Uint8Array() };
    }
    if (!r) {
      return { status: 200, headers: { ...base, "content-length": String(wav.length) }, body: wav };
    }
    const slice = wav.subarray(r.start, r.end + 1);
    return {
      status: 206,
      headers: {
        ...base,
        "content-length": String(slice.length),
        "content-range": `bytes ${r.start}-${r.end}/${wav.length}`,
      },
      body: slice,
    };
  }
}
