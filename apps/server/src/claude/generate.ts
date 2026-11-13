import { validateVisualDna, type VisualDna } from "@artei/shared";
import type { DnaModel, ChatTurn } from "./model.js";
import { correctionPrompt, SYSTEM_PROMPT } from "./prompts.js";

export type GenerateResult =
  | { ok: true; dna: VisualDna; attempts: number }
  | { ok: false; reason: "invalid" | "refused" | "error"; detail: string; attempts: number };

/** Pull a JSON object out of a reply, tolerating stray code fences. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("No JSON object in reply");
  }
}

/**
 * Ask the model for Visual DNA, validate with zod, retry once with the
 * validation errors, and report failure so the caller can fall back to a preset.
 * The reply is only ever parsed as data — never executed.
 */
export async function generateDna(model: DnaModel, userPrompt: string): Promise<GenerateResult> {
  const turns: ChatTurn[] = [{ role: "user", content: userPrompt }];
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    let reply;
    try {
      reply = await model.complete(SYSTEM_PROMPT, turns);
    } catch (e) {
      return { ok: false, reason: "error", detail: (e as Error).message, attempts: attempt };
    }
    if (reply.refused) return { ok: false, reason: "refused", detail: "model declined", attempts: attempt };

    let parsed: unknown;
    try {
      parsed = extractJson(reply.text);
    } catch (e) {
      lastErrors = [(e as Error).message];
      turns.push({ role: "assistant", content: reply.text || "(empty)" }, { role: "user", content: correctionPrompt(lastErrors) });
      continue;
    }
    const v = validateVisualDna(parsed);
    if (v.ok) return { ok: true, dna: v.dna, attempts: attempt };
    lastErrors = v.errors;
    turns.push({ role: "assistant", content: reply.text }, { role: "user", content: correctionPrompt(v.errors) });
  }
  return { ok: false, reason: "invalid", detail: lastErrors.join("; "), attempts: 2 };
}
