import { voice } from "@livekit/agents";
import { POSH_TRAINING_SECTIONS } from "./posh-training-script.mjs";

/** @typedef {{ getSpeechId: () => string | null; publishPartial: (data: Record<string, unknown>) => void }} AiTranscriptHooks */

function chunkTextDelta(chunk) {
  if (typeof chunk === "string") return chunk;
  if (chunk && typeof chunk === "object" && chunk.delta && typeof chunk.delta.content === "string") {
    return chunk.delta.content;
  }
  return "";
}

/**
 * Wraps the default LLM stream so POSH can push growing assistant text over the data channel
 * while tokens arrive (the SDK only commits the assistant chat item after audio playout ends).
 */
function wrapLlmStreamForLiveTranscript(innerStream, hooks) {
  const minIntervalMs = 300;
  let accumulated = "";
  let lastPublishAt = 0;
  let pendingTimer = null;
  /** First speech id used for this LLM stream (ref can change if another turn is queued). */
  let lockedSpeechId = null;

  const clearTimer = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };

  const publishNow = (force) => {
    if (!lockedSpeechId) {
      lockedSpeechId = hooks.getSpeechId();
    }
    const speechId = lockedSpeechId;
    if (!speechId || !accumulated) return;
    const now = Date.now();
    if (!force && now - lastPublishAt < minIntervalMs) {
      if (!pendingTimer) {
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          publishNow(true);
        }, minIntervalMs - (now - lastPublishAt));
      }
      return;
    }
    lastPublishAt = Date.now();
    hooks.publishPartial({
      type: "assistant_transcript",
      id: speechId,
      text: accumulated,
      partial: true,
      timestamp: Date.now(),
    });
  };

  return new ReadableStream({
    async start(controller) {
      const reader = innerStream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const delta = chunkTextDelta(value);
          if (delta) {
            accumulated += delta;
            publishNow(false);
          }
          controller.enqueue(value);
        }
        clearTimer();
        publishNow(true);
        controller.close();
      } catch (err) {
        clearTimer();
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      clearTimer();
      return innerStream.cancel(reason);
    },
  });
}

const SECTIONS_FOR_PROMPT = POSH_TRAINING_SECTIONS.map(
  (section, index) =>
    `### Section ${index + 1} of ${POSH_TRAINING_SECTIONS.length}: ${section.title}\n${section.body}`,
).join("\n\n");

const ASSISTANT_INSTRUCTIONS = `You are the voice trainer for SFO Technologies conducting a POSH (Prevention of Sexual Harassment at Workplace) awareness session. You must deliver the approved content in a **conversational, turn-by-turn way** — never as one long lecture.

## Approved content (cover every section in order)
Each block below is official training material. Preserve meaning, facts, names (SFO Technologies, ICC, Act 2013), and policy points. You may use natural spoken phrasing, but do not skip or contradict any section.

${SECTIONS_FOR_PROMPT}

## Conversational delivery (mandatory)
- **One section per assistant turn** (Sections 1 through ${POSH_TRAINING_SECTIONS.length}). Exception: if a section is very long for voice, you may split that single section across two turns, but still end the second part with a check-in.
- **Do not** chain multiple sections in one reply. Do not read the whole script in a single go.
- Speak in a calm, clear, slightly slower pace suitable for training delivery. Use short natural pauses with punctuation, and avoid rushing.
- After almost every section, add a **short check-in** before waiting for the candidate, for example: "Does that make sense so far?", "Any question on that?", or "Shall we continue to the next part?" — unless they just said "continue", "okay", "go ahead", or similar, in which case you may move to the next section with a brief bridge ("Great — next, let's talk about…").
- Sound human: brief bridges between sections are fine ("Alright, next I'd like to cover…").
- Track progress implicitly: if they ask "where were we?", summarize the last section title and offer to continue.
- If they interrupt with a question, answer from the script or POSH Act 2013, then ask whether to continue from the same section or the next.

## After all sections
- Section ${POSH_TRAINING_SECTIONS.length} already invites doubts. If they have none, acknowledge warmly and close. If they have doubts, answer only about: this training, SFO's policy above, POSH Act 2013, ICC, complaints, and redressal. Refuse unrelated topics.

## If unsure
Suggest HR, the ICC, or a qualified legal professional for case-specific advice.`;

export class Assistant extends voice.Agent {
  /** @param {AiTranscriptHooks | null | undefined} aiTranscriptHooks */
  constructor(aiTranscriptHooks) {
    super({
      instructions: ASSISTANT_INSTRUCTIONS,
    });
    this._aiTranscriptHooks = aiTranscriptHooks ?? null;
  }

  async llmNode(chatCtx, toolCtx, modelSettings) {
    const inner = await voice.Agent.default.llmNode(this, chatCtx, toolCtx, modelSettings);
    const hooks = this._aiTranscriptHooks;
    if (!inner || !hooks?.publishPartial || !hooks?.getSpeechId) {
      return inner;
    }
    return wrapLlmStreamForLiveTranscript(inner, hooks);
  }
}
