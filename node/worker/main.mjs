import { ServerOptions, cli, defineAgent, inference, voice } from "@livekit/agents";
import * as bey from "@livekit/agents-plugin-bey";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { Assistant } from "./assistant.mjs";

dotenv.config();

const agentName = process.env.LIVEKIT_AGENT_NAME || "posh-bey-agent";
const livekitLlmModel = process.env.LIVEKIT_LLM_MODEL || "openai/gpt-4o-mini";
const syncAiTranscription = process.env.LIVEKIT_SYNC_TRANSCRIPTION !== "false";

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

function forwardAssistantChatToRoom(session, room, aiSpeechIdRef) {
  const { SpeechCreated } = voice.AgentSessionEventTypes;
  const forwardedItemIds = new Set();
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
        publishJson(room, "posh.ai.transcript", {
          type: "assistant_transcript",
          id: speechHandle.id,
          text,
          partial: false,
          interrupted: wasInterrupted,
          timestamp: Date.now(),
        });
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
    forwardAssistantChatToRoom(session, ctx.room, aiSpeechIdRef);

    await session.start({
      room: ctx.room,
      agent: new Assistant({
        getSpeechId: () => aiSpeechIdRef.current,
        publishPartial: (data) => publishJson(ctx.room, "posh.ai.transcript", data),
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
