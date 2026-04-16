import { ServerOptions, cli, defineAgent, inference, voice } from "@livekit/agents";
import * as bey from "@livekit/agents-plugin-bey";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { Assistant } from "./assistant.mjs";
import { POSH_TRAINING_SECTIONS } from "./posh-training-script.mjs";

dotenv.config();

const agentName = process.env.LIVEKIT_AGENT_NAME || "posh-bey-agent";
const livekitLlmModel = process.env.LIVEKIT_LLM_MODEL || "openai/gpt-4o-mini";
const syncAiTranscription = process.env.LIVEKIT_SYNC_TRANSCRIPTION !== "false";
const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
const internalApiKey = process.env.INTERNAL_API_KEY || process.env.JWT_SECRET || "";
const completionSection =
  POSH_TRAINING_SECTIONS.find((section) => section.title === "Closing reminder and conduct expectations") ||
  POSH_TRAINING_SECTIONS[Math.max(0, POSH_TRAINING_SECTIONS.length - 2)];

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isCompletionSectionReached(text) {
  const candidate = normalizeForMatch(text);
  if (!candidate) return false;
  const completionBody = normalizeForMatch(completionSection?.body || "");
  if (completionBody && completionBody.includes(candidate)) return true;
  if (completionBody && candidate.includes(completionBody.slice(0, Math.min(80, completionBody.length)))) return true;
  return (
    candidate.includes("to conclude, a safe workplace is built through awareness, respect, and accountability") ||
    candidate.includes("shall we finish up with any questions") ||
    candidate.includes("before we finish") ||
    candidate.includes("do you have any doubts")
  );
}

function publishJson(room, topic, data) {
  try {
    const payload = new TextEncoder().encode(JSON.stringify(data));
    void room.localParticipant
      ?.publishData?.(payload, { reliable: true, topic })
      .catch((error) => console.error("publishData failed", topic, error.message));
  } catch (error) {
    console.error("publishJson failed", error);
  }
}

function extractUserIdFromRoomName(roomName) {
  const match = String(roomName || "").match(/^posh-(.+)$/);
  return match?.[1] || "";
}

async function markTrainingCompletionInternally(roomName, isLastQuestion) {
  const userId = extractUserIdFromRoomName(roomName);
  if (!userId || !isLastQuestion || !internalApiKey) return;
  try {
    const response = await fetch(`${apiBaseUrl}/internal/training/completion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalApiKey,
      },
      body: JSON.stringify({ userId, isLastQuestion }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn("[completion] internal mark failed", response.status, text);
    }
  } catch (error) {
    console.warn("[completion] internal mark error", error?.message || error);
  }
}

async function detectEndIntentInternally(text) {
  const transcript = String(text || "").trim();
  if (!transcript || !internalApiKey) return false;
  try {
    const response = await fetch(`${apiBaseUrl}/internal/training/end-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": internalApiKey,
      },
      body: JSON.stringify({ text: transcript }),
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    return Boolean(payload?.endIntent);
  } catch {
    return false;
  }
}

function forwardAssistantChatToRoom(session, room, aiSpeechIdRef, trainingStateRef) {
  const { SpeechCreated } = voice.AgentSessionEventTypes;
  const forwardedItemIds = new Set();
  let completionEventSent = false;
  const safeFlagValue = (value) => {
    if (typeof value === "function") {
      try {
        return Boolean(value());
      } catch {
        return false;
      }
    }
    return value === true;
  };

  session.on(SpeechCreated, (event) => {
    const speechHandle = event?.speechHandle;
    if (!speechHandle) return;

    if (aiSpeechIdRef) {
      aiSpeechIdRef.current = speechHandle.id;
    }

    speechHandle.addDoneCallback(() => {
      const wasInterrupted =
        safeFlagValue(speechHandle?.interrupted) ||
        safeFlagValue(speechHandle?.isInterrupted) ||
        safeFlagValue(speechHandle?.playoutInterrupted);
      for (const item of speechHandle.chatItems || []) {
        if (!item || item.type !== "message" || item.role !== "assistant") continue;
        const text = typeof item.textContent === "string" ? item.textContent.trim() : "";
        if (!text && !wasInterrupted) continue;
        if (text && !forwardedItemIds.has(item.id)) {
          forwardedItemIds.add(item.id);
          if (!wasInterrupted) {
            void room.localParticipant
              ?.sendText?.(text, { topic: "lk.chat" })
              .catch((error) => console.error("sendText failed", error));
          }
        }
        const isLastQuestion = isCompletionSectionReached(text);
        publishJson(room, "posh.ai.transcript", {
          type: "assistant_transcript",
          id: speechHandle.id,
          text,
          isLastQuestion,
          partial: false,
          interrupted: wasInterrupted,
          timestamp: Date.now(),
        });
        if (!completionEventSent && !wasInterrupted && isLastQuestion) {
          completionEventSent = true;
          if (trainingStateRef) {
            trainingStateRef.completionReached = true;
          }
          void markTrainingCompletionInternally(room?.name, true);
          publishJson(room, "posh.training.status", {
            type: "training_completion_reached",
            id: speechHandle.id,
            sectionTitle: completionSection?.title || "Closing reminder and conduct expectations",
            timestamp: Date.now(),
          });
        }
      }
    });
  });
}

export default defineAgent({
  entry: async (ctx) => {
    ctx.logContextFields = { room: ctx.room.name };
    let lastInterimTranscript = "";
    let lastInterimAtMs = 0;
    let userTurnSeq = 0;
    const trainingStateRef = { completionReached: false };

    const session = new voice.AgentSession({
      stt: new deepgram.STT({
        model: "nova-2-general",
        language: "en",
      }),
      llm: new inference.LLM({
        model: livekitLlmModel,
      }),
      tts: new deepgram.TTS({
        model: "aura-2-asteria-en",
      }),
      allowInterruptions: true,
      preemptiveGeneration: false,
      userAwayTimeout: 12,
      turnHandling: {
        endpointing: {
          mode: "fixed",
          minDelay: 1800,
          maxDelay: 1800,
        },
        interruption: {
          enabled: true,
          minDuration: 800,
          minWords: 1,
        },
      },
    });

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      const transcript = (event?.transcript || "").trim();
      if (!transcript) return;

      publishJson(ctx.room, "posh.user.transcript", {
        type: "user_transcript",
        id: `user-turn-${userTurnSeq}`,
        text: transcript,
        final: Boolean(event?.isFinal),
        timestamp: Date.now(),
      });

      if (event?.isFinal) {
        if (trainingStateRef.completionReached) {
          void (async () => {
            const shouldEnd = await detectEndIntentInternally(transcript);
            if (!shouldEnd) return;
            publishJson(ctx.room, "posh.training.status", {
              type: "training_end_requested",
              text: transcript,
              timestamp: Date.now(),
            });
          })();
        }
        userTurnSeq += 1;
        lastInterimTranscript = "";
        lastInterimAtMs = 0;
        return;
      }
      lastInterimTranscript = transcript;
      lastInterimAtMs = Date.now();
    });

    session.on(voice.AgentSessionEventTypes.UserStateChanged, (event) => {
      if (event?.newState !== "away") return;
      if (!lastInterimTranscript) return;
      const ageMs = Date.now() - lastInterimAtMs;
      if (ageMs > 15000) return;

      const fallbackText = lastInterimTranscript;
      lastInterimTranscript = "";
      lastInterimAtMs = 0;
      console.warn("[STT fallback] using last interim transcript", { fallbackText });
      session.generateReply({ userInput: fallbackText });
    });

    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      const message = String(event?.error?.message || "");
      const isAbort =
        message.toLowerCase().includes("request was aborted") ||
        message.toLowerCase().includes("user_initiated");
      if (isAbort) {
        // Interruptions can cancel in-flight LLM calls; treat as expected.
        console.warn("[AGENT] Ignoring expected abort during interruption", { message });
        return;
      }
      console.error("[AGENT] Session error", {
        message,
        name: event?.error?.name,
      });
    });

    await ctx.connect();

    const aiSpeechIdRef = { current: null };
    forwardAssistantChatToRoom(session, ctx.room, aiSpeechIdRef, trainingStateRef);

    await session.start({
      room: ctx.room,
      agent: new Assistant({
        getSpeechId: () => aiSpeechIdRef.current,
        publishPartial: (data) =>
          publishJson(ctx.room, "posh.ai.transcript", {
            ...data,
            isLastQuestion: isCompletionSectionReached(data?.text),
          }),
      }),
      outputOptions: {
        // Keep AI transcript aligned with avatar playout unless explicitly disabled.
        syncTranscription: syncAiTranscription,
      },
    });

    const avatar = new bey.AvatarSession({
      apiKey: process.env.BEY_API_KEY,
      avatarId: process.env.BEY_AVATAR_ID || undefined,
      avatarParticipantIdentity: process.env.BEY_AVATAR_IDENTITY || "bey-avatar-agent",
      avatarParticipantName: "Beyond Presence Avatar",
    });

    await avatar.start(session, ctx.room, {
      livekitUrl: process.env.LIVEKIT_URL,
      livekitApiKey: process.env.LIVEKIT_API_KEY,
      livekitApiSecret: process.env.LIVEKIT_API_SECRET,
    });

    session.generateReply({
      instructions:
        "Welcome them warmly to the SFO Technologies POSH training. Speak clearly and a bit slower than normal, with a calm tone. Deliver only Section 1 (welcome and purpose) in a conversational way, then ask a short check-in before continuing (do not read ahead to other sections).",
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName,
    requestFunc: async (job) => {
      const roomName = job.room?.name || "posh-room";
      const safeRoom = roomName.replace(/[^a-zA-Z0-9_-]/g, "-");
      await job.accept("POSH Act Agent", `agent-${safeRoom}`);
    },
  }),
);
