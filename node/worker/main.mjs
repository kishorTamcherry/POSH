import { ServerOptions, cli, defineAgent, inference, voice } from "@livekit/agents";
import * as bey from "@livekit/agents-plugin-bey";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { Assistant } from "./assistant.mjs";

dotenv.config();

const agentName = process.env.LIVEKIT_AGENT_NAME || "posh-bey-agent";
const livekitLlmModel = process.env.LIVEKIT_LLM_MODEL || "openai/gpt-4o-mini";

function forwardAssistantChatToRoom(session, room) {
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

    speechHandle.addDoneCallback(() => {
      const wasInterrupted =
        safeFlagValue(speechHandle?.interrupted) ||
        safeFlagValue(speechHandle?.isInterrupted) ||
        safeFlagValue(speechHandle?.playoutInterrupted);
      if (wasInterrupted) {
        return;
      }
      for (const item of speechHandle.chatItems || []) {
        if (!item || item.type !== "message" || item.role !== "assistant") continue;
        if (forwardedItemIds.has(item.id)) continue;
        const text = typeof item.textContent === "string" ? item.textContent.trim() : "";
        if (!text) continue;
        forwardedItemIds.add(item.id);
        void room.localParticipant
          ?.sendText?.(text, { topic: "lk.chat" })
          .catch((error) => console.error("sendText failed", error));
        try {
          const payload = new TextEncoder().encode(
            JSON.stringify({
              type: "assistant_transcript",
              id: item.id,
              text,
              timestamp: Date.now(),
            }),
          );
          void room.localParticipant
            ?.publishData?.(payload, { reliable: true, topic: "posh.ai.transcript" })
            .catch((error) => console.error("publishData failed", error));
        } catch (error) {
          console.error("assistant transcript encode failed", error);
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
      if (event?.isFinal) {
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

    await ctx.connect();
    await session.start({
      room: ctx.room,
      agent: new Assistant(),
    });
    forwardAssistantChatToRoom(session, ctx.room);

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
      instructions: "Greet the user in one short sentence.",
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName,
  }),
);
