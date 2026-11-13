import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { VisualDnaSchema } from "@artei/shared";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModelReply {
  /** Raw text of the reply (expected to be JSON). */
  text: string;
  refused: boolean;
}

/** Narrow interface so tests can substitute a fake model. */
export interface DnaModel {
  readonly id: string;
  complete(system: string, turns: ChatTurn[]): Promise<ModelReply>;
}

/**
 * Claude via the official SDK. Requests strict JSON using structured outputs
 * (schema derived from the same zod schema we validate with), and opts into
 * server-side refusal fallbacks. If the API rejects either beta feature, we
 * drop back to prompt-only JSON (our own zod validation still applies).
 */
export class ClaudeDnaModel implements DnaModel {
  private client: Anthropic;
  private plain = false;

  constructor(
    apiKey: string,
    readonly id: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  }

  async complete(system: string, turns: ChatTurn[]): Promise<ModelReply> {
    if (!this.plain) {
      try {
        const res = await this.client.beta.messages.parse({
          model: this.id,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium", format: betaZodOutputFormat(VisualDnaSchema) },
          system,
          messages: turns,
        });
        return toReply(res.stop_reason, res.content);
      } catch (e) {
        if (!(e instanceof Anthropic.BadRequestError)) throw e;
        // Structured-output schema or fallback beta not accepted: use plain JSON mode from now on.
        console.warn("Structured outputs unavailable, using prompt-only JSON:", e.message);
        this.plain = true;
      }
    }
    const res = await this.client.messages.create({
      model: this.id,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system,
      messages: turns,
    });
    return toReply(res.stop_reason, res.content);
  }
}

function toReply(stop: string | null, content: Array<{ type: string; text?: string }>): ModelReply {
  if (stop === "refusal") return { text: "", refused: true };
  const text = content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  return { text, refused: false };
}
