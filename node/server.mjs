import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const jwtSecret = process.env.JWT_SECRET || "dev-secret";
const mongoUri = process.env.MONGODB_URI || "";
const otpExpiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 1);
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const deepgramTtsModel = process.env.DEEPGRAM_TTS_MODEL || "aura-2-thalia-en";
const deepgramSttModel = process.env.DEEPGRAM_STT_MODEL || "nova-2";
const livekitUrl = process.env.LIVEKIT_URL || "";
const livekitApiKey = process.env.LIVEKIT_API_KEY || "";
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || "";
const livekitAgentName = process.env.LIVEKIT_AGENT_NAME || "posh-bey-agent";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const roomServiceClient =
  livekitUrl && livekitApiKey && livekitApiSecret
    ? new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret)
    : null;
const agentDispatchClient =
  livekitUrl && livekitApiKey && livekitApiSecret
    ? new AgentDispatchClient(livekitUrl.replace(/^wss:/, "https:"), livekitApiKey, livekitApiSecret)
    : null;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);
const User = mongoose.model("User", userSchema);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.EMAIL_SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
});

const io = new Server(server, {
  cors: {
    origin: frontendOrigin,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: frontendOrigin,
  }),
);
app.use(express.json());

function validateEnv() {
  const required = [
    "MONGODB_URI",
    "JWT_SECRET",
    "EMAIL_USER",
    "EMAIL_PASS",
    "OPENAI_API_KEY",
    "DEEPGRAM_API_KEY",
    "BEY_API_KEY",
    "BEY_AVATAR_ID",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.warn(`Missing env vars: ${missing.join(", ")}`);
  }
}

async function connectDatabase() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing.");
  }

  await mongoose.connect(mongoUri, {
    dbName: "posh_ai_app",
  });
  console.log("MongoDB connected.");
}

function buildDemoAiReply(userText) {
  const cleaned = userText.trim();
  return `Welcome to Posh assistant. I heard: "${cleaned}". In the next step we can wire GPT-4o mini streaming plus Deepgram STT/TTS and Beyond Presence avatar playback.`;
}

async function transcribeAudioWithDeepgram(base64Audio, mimeType = "audio/webm") {
  console.log("[STT] Sending audio to Deepgram", {
    mimeType,
    bytes: Buffer.from(base64Audio, "base64").length,
  });
  const response = await fetch(
    `https://api.deepgram.com/v1/listen?model=${deepgramSttModel}&smart_format=true&punctuate=true&interim_results=false`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": mimeType || "application/octet-stream",
      },
      body: Buffer.from(base64Audio, "base64"),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("[STT] Deepgram error", text);
    throw new Error(`Deepgram STT failed: ${text}`);
  }

  const payload = await response.json();
  const transcript =
    payload?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
  console.log("[STT] Transcript result", { transcript });
  return transcript;
}

async function synthesizeTtsWithDeepgram(text) {
  console.log("[TTS] Requesting Deepgram audio", { textLength: text.length });
  const response = await fetch(
    `https://api.deepgram.com/v1/speak?model=${deepgramTtsModel}&encoding=mp3`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[TTS] Deepgram error", errText);
    throw new Error(`Deepgram TTS failed: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log("[TTS] Audio generated", { bytes: arrayBuffer.byteLength });
  return Buffer.from(arrayBuffer).toString("base64");
}

function splitIntoSpeakableChunks(buffer) {
  const parts = buffer.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return parts.map((part) => part.trim()).filter(Boolean);
}

function verifyHttpAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Missing bearer token." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid auth token." });
  }
}

async function createLivekitToken({ identity, name, roomName }) {
  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity,
    name,
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return token.toJwt();
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpTemplate(otp) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">Posh AI Login OTP</h2>
      <p style="margin-top: 0;">Use this one-time code to log in. It is valid for ${otpExpiryMinutes} minute(s).</p>
      <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; background: #f3f4f6; padding: 12px 16px; border-radius: 8px; display: inline-block;">
        ${otp}
      </div>
      <p style="margin-top: 18px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

async function sendOtpMail(email, otp) {
  await transporter.sendMail({
    from: `"Posh AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Posh AI OTP code",
    text: `Your OTP for login is: ${otp}`,
    html: otpTemplate(otp),
  });
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/login", async (req, res) => {
  const { email, otp } = req.body;
  console.log("[AUTH] /auth/login called", { email, hasOtp: Boolean(otp) });

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let userRecord = await User.findOne({ email: normalizedEmail });

  // Step 1: Request OTP
  if (!otp) {
    const generatedOtp = generateOtp();
    const otpExpires = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

    if (!userRecord) {
      const inferredName = normalizedEmail.split("@")[0] || "Posh User";
      userRecord = await User.create({
        name: inferredName,
        email: normalizedEmail,
        otp: generatedOtp,
        otpExpires,
        isVerified: false,
      });
    } else {
      userRecord.otp = generatedOtp;
      userRecord.otpExpires = otpExpires;
      await userRecord.save();
    }

    try {
      await sendOtpMail(normalizedEmail, generatedOtp);
      console.log("[AUTH] OTP sent", { email: normalizedEmail });
    } catch (error) {
      console.error("[AUTH] OTP send failed", error.message);
      return res.status(500).json({ message: "Failed to send OTP email.", error: error.message });
    }

    return res.json({
      message: "OTP sent successfully to your email",
      requiresOtp: true,
    });
  }

  // Step 2: Verify OTP
  if (!userRecord) {
    return res.status(400).json({ message: "Email not registered with us" });
  }

  if (!userRecord.otp || userRecord.otp !== otp) {
    return res.status(400).json({ message: "Incorrect OTP. Try again" });
  }

  if (!userRecord.otpExpires || new Date() > userRecord.otpExpires) {
    return res.status(409).json({ message: "Code timed out. Resend OTP" });
  }

  const user = { id: userRecord.id, name: userRecord.name, email: userRecord.email };

  const token = jwt.sign({ sub: user.id, email: user.email, name: user.name }, jwtSecret, {
    expiresIn: "8h",
  });

  userRecord.isVerified = true;
  userRecord.otp = null;
  userRecord.otpExpires = null;
  await userRecord.save();

  return res.json({ token, user });
});

app.post("/ai/respond", (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ message: "message is required." });
  }

  return res.json({ reply: buildDemoAiReply(message) });
});

app.post("/avatar/bey/session", verifyHttpAuth, async (req, res) => {
  try {
    if (!roomServiceClient || !agentDispatchClient) {
      return res.status(500).json({ message: "LiveKit is not configured." });
    }

    const roomName = `posh-${req.user.sub}`;
    console.log("[BEY] Starting avatar session", {
      roomName,
      user: req.user.email,
      avatarId: process.env.BEY_AVATAR_ID,
      livekitUrl,
      agentName: livekitAgentName,
    });
    try {
      await roomServiceClient.createRoom({
        name: roomName,
        emptyTimeout: 60 * 10,
        maxParticipants: 6,
      });
    } catch (error) {
      if (!String(error.message || "").includes("already exists")) {
        throw error;
      }
      console.log("[BEY] Room already exists", { roomName });
    }

    const participantToken = await createLivekitToken({
      identity: `user-${req.user.sub}`,
      name: req.user.name || "Posh User",
      roomName,
    });
    console.log("[BEY] User token generated", { identity: `user-${req.user.sub}`, roomName });
    const existingDispatches = await agentDispatchClient.listDispatch(roomName);
    const sameAgentDispatches = existingDispatches.filter(
      (dispatch) => dispatch.agentName === livekitAgentName,
    );
    for (const dispatch of sameAgentDispatches) {
      try {
        await agentDispatchClient.deleteDispatch(dispatch.id, roomName);
        console.log("[BEY] Deleted stale agent dispatch", {
          roomName,
          dispatchId: dispatch.id,
          agentName: livekitAgentName,
        });
      } catch (error) {
        console.warn("[BEY] Failed deleting stale dispatch", {
          roomName,
          dispatchId: dispatch.id,
          agentName: livekitAgentName,
          message: error.message,
        });
      }
    }
    const dispatch = await agentDispatchClient.createDispatch(roomName, livekitAgentName);
    console.log("[BEY] Agent dispatch created", {
      roomName,
      dispatchId: dispatch.id,
      agentName: livekitAgentName,
    });

    return res.json({
      roomName,
      livekitUrl,
      participantToken,
      dispatchAgent: livekitAgentName,
    });
  } catch (error) {
    console.error("[BEY] session endpoint failed", error.message);
    return res.status(500).json({ message: error.message || "Failed to start BEY session." });
  }
});

app.post("/avatar/bey/end", verifyHttpAuth, async (req, res) => {
  try {
    if (!roomServiceClient || !agentDispatchClient) {
      return res.status(500).json({ message: "LiveKit is not configured." });
    }

    const roomName = `posh-${req.user.sub}`;
    const userIdentity = `user-${req.user.sub}`;
    const avatarIdentity = process.env.BEY_AVATAR_IDENTITY || "bey-avatar-agent";

    const existingDispatches = await agentDispatchClient.listDispatch(roomName);
    for (const dispatch of existingDispatches) {
      if (dispatch.agentName !== livekitAgentName) continue;
      try {
        await agentDispatchClient.deleteDispatch(dispatch.id, roomName);
        console.log("[BEY] End conversation deleted dispatch", {
          roomName,
          dispatchId: dispatch.id,
          agentName: livekitAgentName,
        });
      } catch (error) {
        console.warn("[BEY] End conversation delete dispatch failed", {
          roomName,
          dispatchId: dispatch.id,
          message: error.message,
        });
      }
    }

    const participants = await roomServiceClient.listParticipants(roomName).catch(() => []);
    for (const participant of participants) {
      const identity = participant.identity;
      const shouldRemove =
        identity === userIdentity ||
        identity === avatarIdentity ||
        identity?.startsWith("agent-");
      if (!shouldRemove) continue;
      try {
        await roomServiceClient.removeParticipant(roomName, identity);
        console.log("[BEY] End conversation removed participant", { roomName, identity });
      } catch (error) {
        console.warn("[BEY] End conversation remove participant failed", {
          roomName,
          identity,
          message: error.message,
        });
      }
    }

    return res.json({ ok: true, roomName });
  } catch (error) {
    console.error("[BEY] end conversation failed", error.message);
    return res.status(500).json({ message: error.message || "Failed to end conversation." });
  }
});

app.get("/avatar/bey/room/:roomName/participants", verifyHttpAuth, async (req, res) => {
  try {
    if (!roomServiceClient) {
      return res.status(500).json({ message: "LiveKit is not configured." });
    }
    const participants = await roomServiceClient.listParticipants(req.params.roomName);
    return res.json({
      roomName: req.params.roomName,
      count: participants.length,
      participants: participants.map((p) => ({
        identity: p.identity,
        name: p.name,
        state: p.state,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to list participants." });
  }
});

io.use((socket, next) => {
  const authToken = socket.handshake.auth?.token;

  if (!authToken) {
    return next(new Error("Missing auth token"));
  }

  try {
    const payload = jwt.verify(authToken, jwtSecret);
    socket.user = payload;
    return next();
  } catch {
    return next(new Error("Invalid auth token"));
  }
});

io.on("connection", (socket) => {
  console.log("[SOCKET] Client connected", { socketId: socket.id, user: socket.user?.email });
  let currentAiMessageId = null;
  let currentAiRunId = null;
  let aiAbortController = null;
  let wasInterrupted = false;
  let ttsQueue = [];
  let isTtsPlaying = false;
  const conversationHistory = [
    {
      role: "system",
      content:
        "You are a concise, friendly POS assistant for a store cashier. Keep responses short and practical.",
    },
  ];

  const stopActiveReply = (reason = "interrupted") => {
    console.log("[AI] stopActiveReply", { reason, socketId: socket.id });
    wasInterrupted = true;
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    ttsQueue = [];
    isTtsPlaying = false;
    if (currentAiMessageId) {
      socket.emit("ai_interrupted", { messageId: currentAiMessageId, reason });
      currentAiMessageId = null;
      currentAiRunId = null;
    }
  };

  const flushTtsQueue = async () => {
    if (isTtsPlaying || ttsQueue.length === 0 || wasInterrupted) {
      return;
    }

    isTtsPlaying = true;
    while (ttsQueue.length > 0 && !wasInterrupted) {
      const chunk = ttsQueue.shift();
      try {
        const audioBase64 = await synthesizeTtsWithDeepgram(chunk);
        console.log("[TTS] Emitting ai_audio", { chunkPreview: chunk.slice(0, 60) });
        socket.emit("ai_audio", {
          mimeType: "audio/mpeg",
          audioBase64,
          text: chunk,
        });
      } catch (error) {
        console.error("[TTS] Queue playback failed", error.message);
        socket.emit("conversation_error", { message: error.message });
      }
    }
    isTtsPlaying = false;
  };

  const runAiConversation = async (userText) => {
    console.log("[AI] Starting run", { socketId: socket.id, userText });
    stopActiveReply("new_user_message");
    wasInterrupted = false;
    aiAbortController = new AbortController();
    currentAiMessageId = `ai-${Date.now()}`;
    currentAiRunId = `run-${Date.now()}`;

    socket.emit("ai_started", { messageId: currentAiMessageId, runId: currentAiRunId });

    conversationHistory.push({ role: "user", content: userText });

    let aiBuffer = "";
    let fullResponse = "";

    try {
      const stream = await openai.chat.completions.create(
        {
          model: openAiModel,
          stream: true,
          temperature: 0.3,
          messages: conversationHistory,
        },
        { signal: aiAbortController.signal },
      );

      for await (const event of stream) {
        if (wasInterrupted) {
          break;
        }

        const chunk = event.choices?.[0]?.delta?.content || "";
        if (!chunk) {
          continue;
        }

        fullResponse += chunk;
        aiBuffer += chunk;
        socket.emit("ai_chunk", { messageId: currentAiMessageId, chunk });

        const speakableChunks = splitIntoSpeakableChunks(aiBuffer);
        if (speakableChunks.length > 1) {
          const readyChunks = speakableChunks.slice(0, -1);
          aiBuffer = speakableChunks[speakableChunks.length - 1];
          ttsQueue.push(...readyChunks);
          flushTtsQueue();
        }
      }

      if (!wasInterrupted && aiBuffer.trim()) {
        ttsQueue.push(aiBuffer.trim());
        aiBuffer = "";
        await flushTtsQueue();
      }

      if (!wasInterrupted) {
        conversationHistory.push({ role: "assistant", content: fullResponse });
        console.log("[AI] Run finished", { responseLength: fullResponse.length });
        socket.emit("ai_finished", { messageId: currentAiMessageId });
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("[AI] Stream error", error.message);
        socket.emit("conversation_error", { message: error.message || "AI stream failed." });
      }
    } finally {
      aiAbortController = null;
      currentAiMessageId = null;
      currentAiRunId = null;
    }
  };

  socket.emit("session_ready", {
    user: {
      id: socket.user.sub,
      name: socket.user.name,
      email: socket.user.email,
    },
    status: "connected",
  });

  socket.on("interrupt", () => {
    console.log("[SOCKET] interrupt event", { socketId: socket.id });
    stopActiveReply("user_interrupt");
  });

  socket.on("user_message", async ({ text }) => {
    console.log("[SOCKET] user_message", { socketId: socket.id, text });
    if (!text || typeof text !== "string") {
      socket.emit("conversation_error", { message: "Text is required." });
      return;
    }
    await runAiConversation(text.trim());
  });

  socket.on("stt_audio", async ({ audioBase64, mimeType }) => {
    console.log("[SOCKET] stt_audio event", {
      socketId: socket.id,
      mimeType,
      hasAudio: Boolean(audioBase64),
    });
    if (!audioBase64) {
      socket.emit("conversation_error", { message: "Audio payload is required." });
      return;
    }

    try {
      socket.emit("stt_status", { status: "processing" });
      const transcript = await transcribeAudioWithDeepgram(audioBase64, mimeType);
      if (!transcript) {
        socket.emit("stt_status", { status: "empty" });
        return;
      }

      socket.emit("stt_final", { transcript });
      await runAiConversation(transcript);
    } catch (error) {
      console.error("[STT] stt_audio flow failed", error.message);
      socket.emit("conversation_error", { message: error.message || "STT failed." });
    }
  });

  socket.on("disconnect", () => {
    console.log("[SOCKET] Client disconnected", { socketId: socket.id });
    stopActiveReply("disconnect");
  });
});

validateEnv();

try {
  await connectDatabase();
  server.listen(port, () => {
    console.log(`Node API + socket running on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}
