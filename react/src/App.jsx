import { useEffect, useMemo, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import { LocalAudioTrack, Room, RoomEvent, Track } from "livekit-client";
import { io } from "socket.io-client";
import "./App.css";

const API_BASE_URL = "http://localhost:4000";
const TOKEN_STORAGE_KEY = "posh_token";
const ACCENT = "#7f77dd";
const NAVY = "#1a1a2e";
const AVATAR_LOADER_STEPS = [
  "Connecting to POSH trainer",
  "Checking microphone",
  "Loading POSH training plan",
  "Preparing trainer guidance",
];
const AVATAR_LOADER_STATUS = [
  "Establishing secure connection...",
  "Microphone access granted...",
  "Loading your POSH session details...",
  "POSH trainer is ready!",
];

const loginStyles = {
  scene: {
    minHeight: "100vh",
    background: "#f5f4f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2.5rem 1rem",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  panel: {
    background: "#ffffff",
    borderRadius: "24px",
    width: "100%",
    maxWidth: "420px",
    overflow: "hidden",
    border: "1px solid #e8e6e0",
  },
  panelTop: {
    background: NAVY,
    padding: "2rem 2rem 2.5rem",
  },
  brandMark: {
    width: "42px",
    height: "42px",
    background: ACCENT,
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "1.5rem",
  },
  topTitle: {
    fontSize: "22px",
    fontWeight: 500,
    color: "#ffffff",
    marginBottom: "6px",
    lineHeight: 1.3,
  },
  topSub: {
    fontSize: "13px",
    color: "#a0a0be",
    lineHeight: 1.6,
    margin: 0,
  },
  stepsRow: {
    display: "flex",
    gap: "6px",
    marginTop: "1.5rem",
  },
  panelBody: {
    padding: "2rem",
  },
  fieldLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#888",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "8px",
    display: "block",
  },
  infoBox: {
    background: "#fafaf8",
    border: "1px solid #e8e6e0",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "13px",
    color: "#666",
    marginTop: "1rem",
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  divider: {
    height: "1px",
    background: "#f0ede8",
    margin: "1.5rem 0",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#888",
  },
};

function StepPip({ active }) {
  return (
    <div
      style={{
        height: "3px",
        borderRadius: "2px",
        flex: 1,
        background: active ? ACCENT : "rgba(255,255,255,0.15)",
        transition: "background 0.3s",
      }}
    />
  );
}

function PrimaryBtn({ children, onClick, disabled, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "14px",
        fontSize: "15px",
        fontWeight: 500,
        borderRadius: "12px",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#c8c6d8" : NAVY,
        color: "#fff",
        marginTop: "1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", error, autoFocus }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: "100%",
        padding: "13px 16px",
        fontSize: "15px",
        borderRadius: "12px",
        border: `1.5px solid ${error ? "#e24b4a" : "#e8e6e0"}`,
        background: "#fafaf8",
        color: NAVY,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}

function OtpCell({ value, onChange, onKeyDown, onPaste, inputRef, done }) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      style={{
        width: "48px",
        minWidth: "48px",
        maxWidth: "48px",
        height: "56px",
        flex: "0 0 48px",
        textAlign: "center",
        fontSize: "20px",
        fontWeight: 500,
        borderRadius: "12px",
        border: `1.5px solid ${done ? "#5dcaa5" : "#e8e6e0"}`,
        background: done ? "#f0fdf8" : "#fafaf8",
        color: done ? "#085041" : NAVY,
        outline: "none",
        caretColor: "transparent",
      }}
    />
  );
}

function SentBadge({ email }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 12px",
        borderRadius: "99px",
        background: "#eeedfe",
        border: "1px solid #afa9ec",
        fontSize: "12px",
        fontWeight: 500,
        color: "#3c3489",
        marginBottom: "1rem",
      }}
    >
      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: ACCENT }} />
      <span>{email}</span>
    </div>
  );
}

function formatAgo(input) {
  if (!input) return "n/a";
  const ts = new Date(input).getTime();
  if (Number.isNaN(ts)) return "n/a";
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function formatMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(1);
}

function initialsFromEmail(email) {
  const base = String(email || "").split("@")[0] || "NA";
  const parts = base.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function App() {
  const [email, setEmail] = useState("demo@posh.app");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpRequested, setOtpRequested] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [emailError, setEmailError] = useState(false);
  const [status, setStatus] = useState("offline");
  const [token, setToken] = useState("");
  const [socketError, setSocketError] = useState("");
  const [liveSttText, setLiveSttText] = useState("");
  const [messages, setMessages] = useState([]);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [endingConversation, setEndingConversation] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [avatarLoaderStep, setAvatarLoaderStep] = useState(0);
  const [avatarReady, setAvatarReady] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState("checking");
  const [attendanceNote, setAttendanceNote] = useState("Verifying camera presence...");
  const [adminRows, setAdminRows] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const socketRef = useRef(null);
  const livekitRoomRef = useRef(null);
  const avatarContainerRef = useRef(null);
  const avatarBootstrappedRef = useRef(false);
  const localMicTrackRef = useRef(null);
  const camVideoRef = useRef(null);
  const camStreamRef = useRef(null);
  const transcriptBodyRef = useRef(null);
  const avatarVideoReadyRef = useRef(false);
  const avatarAudioElsRef = useRef([]);
  const pendingAvatarAudioElsRef = useRef([]);
  const seenTranscriptIdsRef = useRef(new Set());
  const seenChatIdsRef = useRef(new Set());
  const timerRef = useRef(null);
  const cellRefs = useRef([]);
  const spacePressedRef = useRef(false);
  const aiSmoothStateRef = useRef(new Map());
  const detectorModelRef = useRef(null);
  const detectorIntervalRef = useRef(null);
  const absentSinceRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);

  const isLoggedIn = Boolean(token);
  const isAdminMode = useMemo(
    () => new URLSearchParams(window.location.search).get("admin") === "1",
    [],
  );
  const visibleMessages = avatarReady ? messages : [];
  const userMessageCount = useMemo(
    () => visibleMessages.filter((message) => message.role === "user").length,
    [visibleMessages],
  );
  const sessionTimer = useMemo(() => {
    const mm = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
    const ss = String(sessionSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [sessionSeconds]);
  const adminStats = useMemo(() => {
    const total = adminRows.length;
    const detected = adminRows.filter((row) => row?.insights?.currentlyDetected).length;
    const notDetected = Math.max(0, total - detected);
    const totalPresent = adminRows.reduce(
      (sum, row) => sum + Number(row?.insights?.presentMinutes || 0),
      0,
    );
    return { total, detected, notDetected, totalPresent };
  }, [adminRows]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      setToken(storedToken);
      setStatus("connecting");
      connectSocket(storedToken);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (livekitRoomRef.current) livekitRoomRef.current.disconnect();
      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach((track) => track.stop());
        camStreamRef.current = null;
      }
      avatarBootstrappedRef.current = false;
      clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const intervalId = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!camOn) return;
    const videoEl = camVideoRef.current;
    const stream = camStreamRef.current;
    if (!videoEl || !stream) return;
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    void videoEl.play().catch(() => {});
  }, [camOn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const onKeyDown = (event) => {
      if (event.code !== "Space" || event.repeat || spacePressedRef.current) return;
      const tagName = event.target?.tagName?.toLowerCase?.() || "";
      if (tagName === "input" || tagName === "textarea") return;
      event.preventDefault();
      spacePressedRef.current = true;
      void beginHoldToTalk();
    };

    const onKeyUp = (event) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (!spacePressedRef.current) return;
      spacePressedRef.current = false;
      void endHoldToTalk();
    };

    const onBlur = () => {
      if (!spacePressedRef.current) return;
      spacePressedRef.current = false;
      void endHoldToTalk();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [isLoggedIn]);

  const appendMessage = (message) => setMessages((prev) => [...prev, message]);
  const upsertMessage = (nextMessage) => {
    setMessages((prev) => {
      const index = prev.findIndex((message) => message.id === nextMessage.id);
      if (index === -1) return [...prev, nextMessage];
      const updated = [...prev];
      updated[index] = { ...updated[index], ...nextMessage };
      return updated;
    });
  };
  const clearAiSmoothers = () => {
    for (const state of aiSmoothStateRef.current.values()) {
      if (state.intervalId) clearInterval(state.intervalId);
    }
    aiSmoothStateRef.current.clear();
  };
  const smoothUpsertAiMessage = (id, targetText) => {
    const safeTarget = typeof targetText === "string" ? targetText : "";
    const stateMap = aiSmoothStateRef.current;
    let state = stateMap.get(id);
    if (!state) {
      state = { display: "", target: safeTarget, intervalId: null };
      stateMap.set(id, state);
    }

    state.target = safeTarget;
    if (state.display === state.target) {
      upsertMessage({ id, role: "ai", text: state.display });
      return;
    }
    if (state.intervalId) return;

    state.intervalId = setInterval(() => {
      const current = state.display;
      const nextTarget = state.target;

      if (current === nextTarget) {
        clearInterval(state.intervalId);
        state.intervalId = null;
        return;
      }

      // If upstream sends a non-prefix replacement, snap to target to avoid weird rewinds.
      if (!nextTarget.startsWith(current)) {
        state.display = nextTarget;
      } else {
        const remaining = nextTarget.length - current.length;
        const step = remaining > 30 ? 4 : remaining > 15 ? 3 : remaining > 6 ? 2 : 1;
        state.display = nextTarget.slice(0, current.length + step);
      }

      upsertMessage({ id, role: "ai", text: state.display });

      if (state.display === nextTarget) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
    }, 180);
  };

  useEffect(() => {
    return () => {
      clearAiSmoothers();
    };
  }, []);

  useEffect(() => {
    const stopDetector = () => {
      if (detectorIntervalRef.current) {
        clearInterval(detectorIntervalRef.current);
        detectorIntervalRef.current = null;
      }
      absentSinceRef.current = null;
    };

    if (!isLoggedIn || !camOn || !avatarReady) {
      stopDetector();
      if (!isLoggedIn) {
        setAttendanceStatus("checking");
        setAttendanceNote("Verifying camera presence...");
      } else if (!camOn && avatarReady) {
        setAttendanceStatus("away");
        setAttendanceNote("Camera appears off. Please enable camera.");
      }
      return;
    }

    let cancelled = false;

    const runDetection = async () => {
      const videoEl = camVideoRef.current;
      const cameraTrack =
        cameraVideoTrackRef.current || camStreamRef.current?.getVideoTracks?.()[0] || null;
      const hasLiveTrack = Boolean(
        cameraTrack &&
          cameraTrack.readyState === "live" &&
          cameraTrack.enabled &&
          !cameraTrack.muted,
      );
      if (!hasLiveTrack) {
        absentSinceRef.current = null;
        if (!cancelled) {
          setAttendanceStatus("away");
          setAttendanceNote("Camera appears off. Please enable camera.");
        }
        return;
      }
      if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
        if (!cancelled) {
          setAttendanceStatus("checking");
          setAttendanceNote("Waiting for camera frames...");
        }
        return;
      }

      try {
        if (!detectorModelRef.current) {
          detectorModelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        }
        const predictions = await detectorModelRef.current.detect(videoEl, 6);
        const hasPerson = predictions.some(
          (prediction) => prediction.class === "person" && prediction.score >= 0.55,
        );
        if (hasPerson) {
          absentSinceRef.current = null;
          if (!cancelled) {
            setAttendanceStatus("present");
            setAttendanceNote("Candidate detected on camera.");
          }
          return;
        }

        if (!absentSinceRef.current) {
          absentSinceRef.current = Date.now();
        }
        const awaySeconds = Math.floor((Date.now() - absentSinceRef.current) / 1000);
        if (!cancelled) {
          if (awaySeconds >= 10) {
            setAttendanceStatus("away");
            setAttendanceNote("No person detected for 10s. Please stay in frame.");
          } else {
            setAttendanceStatus("checking");
            setAttendanceNote("No person detected. Waiting...");
          }
        }
      } catch {
        if (!cancelled) {
          setAttendanceStatus("error");
          setAttendanceNote("Object detection unavailable on this device.");
        }
      }
    };

    void runDetection();
    detectorIntervalRef.current = setInterval(() => {
      void runDetection();
    }, 2000);

    return () => {
      cancelled = true;
      stopDetector();
    };
  }, [avatarReady, camOn, isLoggedIn]);

  useEffect(() => {
    const container = transcriptBodyRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, aiSpeaking]);

  useEffect(() => {
    if (!avatarLoading) {
      setAvatarLoaderStep(0);
      return;
    }
    setAvatarLoaderStep(0);
    const intervalId = setInterval(() => {
      setAvatarLoaderStep((prev) => Math.min(prev + 1, AVATAR_LOADER_STEPS.length - 1));
    }, 1400);
    return () => clearInterval(intervalId);
  }, [avatarLoading]);

  useEffect(() => {
    if (!token || !isLoggedIn) return;

    const sendAttendancePing = async () => {
      try {
        await fetch(`${API_BASE_URL}/attendance/camera`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: attendanceStatus,
            note: attendanceNote,
            cameraOn: camOn,
            avatarReady,
            personDetected: attendanceStatus === "present",
            roomName: null,
            clientTs: new Date().toISOString(),
          }),
        });
      } catch {
        // best-effort telemetry; do not block UX
      }
    };

    void sendAttendancePing();
    const intervalId = setInterval(() => {
      void sendAttendancePing();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [attendanceNote, attendanceStatus, avatarReady, camOn, isLoggedIn, token]);

  useEffect(() => {
    if (!isAdminMode || !token) return;

    const loadAttendance = async () => {
      setAdminLoading(true);
      setAdminError("");
      try {
        const response = await fetch(`${API_BASE_URL}/attendance/camera/latest?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to fetch attendance.");
        }
        setAdminRows(Array.isArray(payload?.records) ? payload.records : []);
      } catch (error) {
        setAdminError(error.message || "Failed to fetch attendance.");
      } finally {
        setAdminLoading(false);
      }
    };

    void loadAttendance();
    const intervalId = setInterval(() => {
      void loadAttendance();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [isAdminMode, token]);

  const setupAvatarRoom = async (jwtToken) => {
    if (avatarBootstrappedRef.current) return;
    avatarBootstrappedRef.current = true;
    setAvatarReady(false);
    setAvatarLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/avatar/bey/session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to start avatar session.");
      }

      if (livekitRoomRef.current) livekitRoomRef.current.disconnect();

      const room = new Room();
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "video" && avatarContainerRef.current) {
          avatarContainerRef.current.innerHTML = "";
          const el = track.attach();
          el.style.width = "100%";
          el.style.height = "100%";
          el.style.objectFit = "cover";
          el.style.borderRadius = "10px";
          avatarContainerRef.current.appendChild(el);
          avatarVideoReadyRef.current = true;
          setAvatarReady(true);
          for (const audioEl of pendingAvatarAudioElsRef.current) {
            void audioEl.play().catch(() => {});
          }
          pendingAvatarAudioElsRef.current = [];
          setAvatarLoading(false);
        }
        if (track.kind === "audio") {
          const el = track.attach();
          el.autoplay = false;
          el.style.display = "none";
          document.body.appendChild(el);
          avatarAudioElsRef.current.push(el);
          if (avatarVideoReadyRef.current) {
            void el.play().catch(() => {});
          } else {
            pendingAvatarAudioElsRef.current.push(el);
          }
        }
      });
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const speakerIdentity = participant?.identity || "unknown";
        // User + agent text comes immediately via worker data channel (posh.user.transcript / posh.ai.transcript).
        // Room transcription is often delayed (synced to playout); skip here to avoid "nothing until AI finishes".
        if (
          speakerIdentity.startsWith("user-") ||
          speakerIdentity.includes("bey") ||
          speakerIdentity.startsWith("agent-")
        ) {
          return;
        }
        for (const segment of segments || []) {
          const text = (segment?.text || "").trim();
          if (!text || !segment?.id) continue;
          const safeIdentity = speakerIdentity.replace(/[^a-zA-Z0-9_-]/g, "_");
          upsertMessage({
            id: `stt-${safeIdentity}-${segment.id}`,
            role: "system",
            text,
          });
          if (segment.final) {
            seenTranscriptIdsRef.current.add(segment.id);
          }
        }
      });
      room.on(RoomEvent.ChatMessage, (message, participant) => {
        if (!message?.id || seenChatIdsRef.current.has(message.id)) return;
        seenChatIdsRef.current.add(message.id);
        appendMessage({
          id: `chat-${message.id}`,
          role: participant?.identity?.includes("bey") ? "ai" : "system",
          text: message.message || "",
        });
      });
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        try {
          const raw = new TextDecoder().decode(payload);
          const parsed = JSON.parse(raw);

          if (topic === "posh.user.transcript") {
            if (parsed?.type !== "user_transcript" || !parsed?.id) return;
            upsertMessage({
              id: `user-data-${parsed.id}`,
              role: "user",
              text: parsed.text || "",
            });
            return;
          }

          if (topic !== "posh.ai.transcript") return;
          if (parsed?.type !== "assistant_transcript" || !parsed?.id) return;
          const displayText =
            parsed.interrupted && parsed.text
              ? `${parsed.text} (interrupted)`
              : parsed.interrupted
                ? "(interrupted)"
                : parsed.text || "";
          smoothUpsertAiMessage(`ai-data-${parsed.id}`, displayText);
        } catch {
          // Ignore malformed payloads from unrelated data topics.
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        avatarBootstrappedRef.current = false;
        avatarVideoReadyRef.current = false;
        setAvatarReady(false);
        for (const audioEl of avatarAudioElsRef.current) {
          audioEl.remove();
        }
        avatarAudioElsRef.current = [];
        for (const audioEl of pendingAvatarAudioElsRef.current) {
          audioEl.remove();
        }
        pendingAvatarAudioElsRef.current = [];
        if (avatarContainerRef.current) avatarContainerRef.current.innerHTML = "";
        setAiSpeaking(false);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speaking = (speakers || []).some((participant) => {
          const identity = participant?.identity || "";
          return identity.includes("bey") || identity.startsWith("agent-");
        });
        setAiSpeaking(speaking);
      });

      await room.connect(payload.livekitUrl, payload.participantToken);
      livekitRoomRef.current = room;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micSource = stream.getAudioTracks()[0];
      const micTrack = new LocalAudioTrack(micSource);
      await micTrack.mute();
      await room.localParticipant.publishTrack(micTrack, { source: Track.Source.Microphone });
      localMicTrackRef.current = micTrack;
      try {
        if (camStreamRef.current) {
          camStreamRef.current.getTracks().forEach((track) => track.stop());
          camStreamRef.current = null;
        }
        if (cameraVideoTrackRef.current) {
          cameraVideoTrackRef.current.onended = null;
          cameraVideoTrackRef.current.onmute = null;
          cameraVideoTrackRef.current.onunmute = null;
          cameraVideoTrackRef.current = null;
        }
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        camStreamRef.current = camStream;
        const camTrack = camStream.getVideoTracks()[0] || null;
        cameraVideoTrackRef.current = camTrack;
        if (camTrack) {
          camTrack.onended = () => setCamOn(false);
          camTrack.onmute = () => setCamOn(false);
          camTrack.onunmute = () => setCamOn(true);
        }
        if (camVideoRef.current) {
          camVideoRef.current.srcObject = camStream;
          void camVideoRef.current.play().catch(() => {});
        }
        setCamOn(true);
      } catch {
        setCamOn(false);
      }
    } catch (error) {
      setSocketError(error.message || "Avatar setup failed.");
      setAvatarLoading(false);
      avatarBootstrappedRef.current = false;
    }
  };

  const connectSocket = (jwtToken) => {
    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
      auth: { token: jwtToken },
    });

    socket.on("connect", () => {
      setStatus("connected");
      setSocketError("");
      setupAvatarRoom(jwtToken);
    });

    socket.on("connect_error", (error) => {
      setStatus("error");
      setSocketError(error.message || "Socket connection failed.");
      if ((error.message || "").toLowerCase().includes("auth")) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
      }
    });

    socket.on("session_ready", () => {
      appendMessage({
        id: `sys-${Date.now()}`,
        role: "system",
        text: "Realtime avatar session ready. Hold to talk.",
      });
    });

    socket.on("disconnect", () => {
      setStatus("offline");
    });

    socketRef.current = socket;
  };

  const requestOtp = async () => {
    if (!email || !email.includes("@")) {
      setEmailError(true);
      return;
    }
    setSocketError("");
    setEmailError(false);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to request OTP.");
      setOtpRequested(true);
      setOtpDigits(["", "", "", "", "", ""]);
      setStatus("otp-sent");
      clearInterval(timerRef.current);
      setCountdown(30);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimeout(() => cellRefs.current[0]?.focus(), 80);
    } catch (error) {
      setStatus("error");
      setSocketError(error.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setSocketError("");
    try {
      const otp = otpDigits.join("");
      if (otp.length !== 6) {
        setSocketError("Please enter 6-digit OTP.");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Login failed.");
      setToken(payload.token);
      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      setStatus("connecting");
      clearInterval(timerRef.current);
      connectSocket(payload.token);
    } catch (error) {
      setStatus("error");
      setSocketError(error.message);
    }
  };

  const handleCellChange = (i, event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
    if (value && i < 5) setTimeout(() => cellRefs.current[i + 1]?.focus(), 0);
  };

  const handleCellKeyDown = (i, event) => {
    if (event.key === "Backspace" && !otpDigits[i] && i > 0) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[i - 1] = "";
        return next;
      });
      cellRefs.current[i - 1]?.focus();
    }
  };

  const handlePasteOtp = (event) => {
    event.preventDefault();
    const pasted = (event.clipboardData || window.clipboardData)
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    setOtpDigits((prev) => {
      const next = [...prev];
      pasted.split("").forEach((ch, index) => {
        next[index] = ch;
      });
      return next;
    });
    const nextFocus = Math.min(pasted.length, 5);
    setTimeout(() => cellRefs.current[nextFocus]?.focus(), 0);
  };

  const interruptAi = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("interrupt");
  };

  const disconnectRealtime = () => {
    try {
      void localMicTrackRef.current?.mute?.();
      localMicTrackRef.current?.stop?.();
    } catch {
      // no-op
    }
    localMicTrackRef.current = null;
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((track) => track.stop());
      camStreamRef.current = null;
    }
    if (cameraVideoTrackRef.current) {
      cameraVideoTrackRef.current.onended = null;
      cameraVideoTrackRef.current.onmute = null;
      cameraVideoTrackRef.current.onunmute = null;
      cameraVideoTrackRef.current = null;
    }
    if (camVideoRef.current) {
      camVideoRef.current.srcObject = null;
    }
    setCamOn(false);

    if (livekitRoomRef.current) {
      livekitRoomRef.current.disconnect();
      livekitRoomRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    avatarBootstrappedRef.current = false;
    avatarVideoReadyRef.current = false;
    setAvatarReady(false);
    for (const audioEl of avatarAudioElsRef.current) {
      audioEl.remove();
    }
    avatarAudioElsRef.current = [];
    for (const audioEl of pendingAvatarAudioElsRef.current) {
      audioEl.remove();
    }
    pendingAvatarAudioElsRef.current = [];
    if (avatarContainerRef.current) avatarContainerRef.current.innerHTML = "";
    clearAiSmoothers();
    setLiveSttText("");
    setStatus("offline");
    setSessionSeconds(0);
    setAiSpeaking(false);
    setAttendanceStatus("checking");
    setAttendanceNote("Verifying camera presence...");
  };

  const endConversation = async () => {
    if (!token || endingConversation) return;
    setEndingConversation(true);
    setSocketError("");
    try {
      await fetch(`${API_BASE_URL}/avatar/bey/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      disconnectRealtime();
      appendMessage({
        id: `sys-end-${Date.now()}`,
        role: "system",
        text: "Conversation ended. Start again by logging in.",
      });
    } catch (error) {
      setSocketError(error.message || "Failed to end conversation.");
    } finally {
      setEndingConversation(false);
    }
  };

  const beginHoldToTalk = async () => {
    setStatus("listening");
    setLiveSttText("Talking...");
    try {
      await localMicTrackRef.current?.unmute();
    } catch {
      setSocketError("Could not unmute microphone track.");
      setStatus("error");
    }
  };

  const endHoldToTalk = async () => {
    try {
      await localMicTrackRef.current?.mute();
      setLiveSttText("");
      setStatus("connected");
    } catch {
      setSocketError("Could not mute microphone track.");
    }
  };

  const handleTalkPointerDown = async (event) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture errors on unsupported environments.
    }
    await beginHoldToTalk();
  };

  const handleTalkPointerUp = async (event) => {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore release errors.
    }
    await endHoldToTalk();
  };

  if (!isLoggedIn) {
    const stepConfig = otpRequested
      ? {
          title: "Check your inbox",
          sub: "Enter the 6-digit code we emailed you. It expires in 10 minutes.",
          pip: [false, true, false],
        }
      : {
          title: "Welcome back",
          sub: "Sign in securely with a one-time code sent to your inbox - no password needed.",
          pip: [true, false, false],
        };
    const otpFull = otpDigits.every((digit) => digit !== "");

    return (
      <main style={loginStyles.scene}>
        <section style={loginStyles.panel}>
          <div style={loginStyles.panelTop}>
            <div style={loginStyles.brandMark}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="M2 8l10 6 10-6" />
              </svg>
            </div>
            <p style={loginStyles.topTitle}>{stepConfig.title}</p>
            <p style={loginStyles.topSub}>{stepConfig.sub}</p>
            <div style={loginStyles.stepsRow}>
              {stepConfig.pip.map((active, index) => (
                <StepPip key={index} active={active} />
              ))}
            </div>
          </div>

          <div style={loginStyles.panelBody}>
            {!otpRequested ? (
              <div>
                <span style={loginStyles.fieldLabel}>Email address</span>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setEmailError(false);
                  }}
                  placeholder="you@example.com"
                  error={emailError}
                  autoFocus
                />
                <PrimaryBtn onClick={requestOtp}>
                  Send code
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22 11 13 2 9l20-7z" />
                  </svg>
                </PrimaryBtn>
              </div>
            ) : (
              <form onSubmit={handleLogin}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpRequested(false);
                      setOtpDigits(["", "", "", "", "", ""]);
                      clearInterval(timerRef.current);
                      setCountdown(0);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: "#888",
                      padding: 0,
                    }}
                  >
                    Change email
                  </button>
                </div>
                <SentBadge email={email} />
                <span style={loginStyles.fieldLabel}>Enter 6-digit code</span>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "1.25rem",
                    justifyContent: "space-between",
                  }}
                >
                  {otpDigits.map((digit, index) => (
                    <OtpCell
                      key={index}
                      value={digit}
                      done={Boolean(digit)}
                      inputRef={(el) => {
                        cellRefs.current[index] = el;
                      }}
                      onChange={(event) => handleCellChange(index, event)}
                      onKeyDown={(event) => handleCellKeyDown(index, event)}
                      onPaste={handlePasteOtp}
                    />
                  ))}
                </div>
                <PrimaryBtn type="submit" disabled={!otpFull}>
                  Verify & sign in
                </PrimaryBtn>

                <div style={loginStyles.divider} />
                <div style={loginStyles.metaRow}>
                  {countdown > 0 ? (
                    <span>
                      Resend available in <strong>{countdown}s</strong>
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={countdown > 0}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: countdown > 0 ? "not-allowed" : "pointer",
                      fontSize: "13px",
                      color: countdown > 0 ? "#b8b4d8" : ACCENT,
                      fontWeight: 500,
                      padding: 0,
                    }}
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}
            {socketError ? <p className="error">{socketError}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  if (isAdminMode) {
    const todayLabel = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (
      <main className="adm-shell">
        <aside className="adm-sidebar">
          <div className="adm-sb-brand">
            <div className="adm-sb-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="M2 8l10 6 10-6" />
              </svg>
            </div>
            <div>
              <div className="adm-sb-title">InterviewAI</div>
              <div className="adm-sb-sub">Admin console</div>
            </div>
          </div>

          <div className="adm-sb-section">Overview</div>
          <div className="adm-nav-item active">Dashboard</div>
          <div className="adm-nav-item">
            Candidates <span className="adm-badge">{adminStats.total}</span>
          </div>
          <div className="adm-nav-item">Sessions</div>
          <div className="adm-nav-item">Analytics</div>
          <div className="adm-sb-spacer" />
          <div className="adm-sb-user">
            <div className="adm-sb-avatar">AD</div>
            <div>
              <p>Admin</p>
              <span>admin@interviewai.io</span>
            </div>
          </div>
        </aside>

        <section className="adm-main">
          <div className="adm-top">
            <div>
              <div className="adm-page-title">Dashboard</div>
              <div className="adm-page-sub">{todayLabel}</div>
            </div>
            <div className="adm-actions">
              <button className="adm-btn-outline" onClick={() => window.location.assign("/")}>
                Open Training UI
              </button>
              <button
                className="adm-btn-primary"
                onClick={() => {
                  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
                  setToken("");
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <div className="adm-stats-grid">
            <div className="adm-stat-card">
              <div className="adm-stat-label">Candidates tracked</div>
              <div className="adm-stat-val">{adminStats.total}</div>
            </div>
            <div className="adm-stat-card">
              <div className="adm-stat-label">Detected now</div>
              <div className="adm-stat-val">{adminStats.detected}</div>
            </div>
            <div className="adm-stat-card">
              <div className="adm-stat-label">Not detected</div>
              <div className="adm-stat-val">{adminStats.notDetected}</div>
            </div>
            <div className="adm-stat-card">
              <div className="adm-stat-label">Total present minutes</div>
              <div className="adm-stat-val">{formatMinutes(adminStats.totalPresent)}</div>
            </div>
          </div>

          {adminError ? <p className="error-note">{adminError}</p> : null}
          <div className="adm-content-row">
            <div className="adm-card">
              <div className="adm-card-header">
                <p>Candidate attendance</p>
                <span>{adminLoading ? "Refreshing..." : `Showing ${adminRows.length} candidates`}</span>
              </div>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Detected</th>
                    <th>Out Since</th>
                    <th>Last Seen</th>
                    <th>In Front (min)</th>
                    <th>Away (min)</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {adminRows.map((row) => (
                    <tr key={row.userId || row._id}>
                      <td>
                        <div className="adm-candidate-cell">
                          <div className="adm-cand-avatar">{initialsFromEmail(row.email || row.userId)}</div>
                          <div>
                            <div className="adm-cand-name">{row.email || row.userId || "unknown"}</div>
                            <div className="adm-cand-sub">{row.note || "No note"}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`adm-status-pill ${row?.insights?.currentlyDetected ? "live" : "away"}`}>
                          {row?.insights?.currentlyDetected ? "Detected" : "Not detected"}
                        </span>
                      </td>
                      <td>{row?.insights?.outSince ? formatAgo(row.insights.outSince) : "-"}</td>
                      <td>{row?.insights?.lastSeenAt ? formatAgo(row.insights.lastSeenAt) : "-"}</td>
                      <td>{formatMinutes(row?.insights?.presentMinutes)}</td>
                      <td>{formatMinutes(row?.insights?.awayMinutes)}</td>
                      <td>{formatAgo(row.updatedAt)}</td>
                    </tr>
                  ))}
                  {!adminLoading && adminRows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>No attendance data yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="adm-side-col">
              <div className="adm-card">
                <div className="adm-card-header">
                  <p>Presence split</p>
                  <span>Current snapshot</span>
                </div>
                <div className="adm-donut-wrap">
                  <div className="adm-donut-stat">{adminStats.total ? `${Math.round((adminStats.detected / adminStats.total) * 100)}%` : "0%"}</div>
                  <div className="adm-donut-sub">currently detected</div>
                  <div className="adm-legend-row">
                    <span>Detected</span>
                    <b>{adminStats.detected}</b>
                  </div>
                  <div className="adm-legend-row">
                    <span>Not detected</span>
                    <b>{adminStats.notDetected}</b>
                  </div>
                </div>
              </div>
              <div className="adm-card">
                <div className="adm-card-header">
                  <p>Live activity</p>
                  <span>Latest updates</span>
                </div>
                <div className="adm-activity-list">
                  {adminRows.slice(0, 5).map((row) => (
                    <div className="adm-activity-item" key={`act-${row.userId || row._id}`}>
                      <div className={`adm-act-dot ${row?.insights?.currentlyDetected ? "live" : "away"}`} />
                      <div>
                        <p>
                          {(row.email || row.userId || "Candidate")} is{" "}
                          {row?.insights?.currentlyDetected ? "in frame" : "out of frame"}
                        </p>
                        <span>{formatAgo(row.updatedAt)}</span>
                      </div>
                    </div>
                  ))}
                  {!adminLoading && adminRows.length === 0 ? (
                    <div className="adm-activity-item">
                      <div className="adm-act-dot away" />
                      <div>
                        <p>No recent activity</p>
                        <span>Waiting for pings...</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="interview-root">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <path d="M2 8l10 6 10-6" />
            </svg>
          </div>
          <div className="session-info">
            <p>POSH Trainer</p>
            <span>POSH Act, 2013 · Awareness session</span>
          </div>
        </div>
        <div className="live-dot">
          <div className="dot-pulse" />
          Live <span className="session-timer">{sessionTimer}</span>
        </div>
        <div className="topbar-right">
          <button className="icon-btn" onClick={interruptAi}>
            Interrupt
          </button>
          <button
            className="icon-btn danger"
            onClick={() => {
              disconnectRealtime();
              window.localStorage.removeItem(TOKEN_STORAGE_KEY);
              setToken("");
              setMessages([]);
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="feeds-col">
          <div className="video-card">
            <div className="video-inner">
              <div ref={avatarContainerRef} className="avatar-host" />
              {avatarLoading ? (
                <div className="av-loader-wrap">
                  <div className="av-logo-ring">
                    <div className="av-ring-outer" />
                    <div className="av-ring-spin" />
                    <div className="av-ring-spin2" />
                    <div className="av-logo-inner">
                      <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#7f77dd"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        <circle cx="18" cy="6" r="2" fill="#7f77dd" stroke="none" />
                        <path d="M20 4l1-1M22 6h1M20 8l1 1" />
                      </svg>
                    </div>
                  </div>

                  <div className="av-loader-text">
                    <div className="av-loader-title">Setting up your POSH training</div>
                    <div className="av-soundwave">
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                      <div className="av-sw-bar" />
                    </div>
                  </div>

                  <div className="av-steps">
                    {AVATAR_LOADER_STEPS.map((label, index) => {
                      const isDone = index < avatarLoaderStep;
                      const isActive = index === avatarLoaderStep;
                      const stateClass = isDone ? "done" : isActive ? "active" : "pending";
                      return (
                        <div key={label} className="av-step">
                          <div className={`av-step-dot ${stateClass}`}>
                            {isDone ? (
                              <svg width="11" height="11" viewBox="0 0 11 11">
                                <polyline
                                  points="2,5.5 4.5,8 9,3"
                                  fill="none"
                                  stroke="#5dcaa5"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 10 10">
                                <circle cx="5" cy="5" r="3" fill={isActive ? "#7f77dd" : "#4a4a6a"} />
                              </svg>
                            )}
                          </div>
                          <span className={`av-step-label ${stateClass}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="av-status-msg">{AVATAR_LOADER_STATUS[avatarLoaderStep]}</div>
                </div>
              ) : null}
              <div className={`pip-cam ${camOn ? "cam-on" : ""}`}>
                {camOn ? (
                  <video ref={camVideoRef} className="pip-cam-video" autoPlay muted playsInline />
                ) : (
                  <>
                    <div className="pip-user-avatar">U</div>
                    <span className="pip-cam-label">Camera off</span>
                  </>
                )}
                <div className="pip-mic-badge">
                  <span>{status === "listening" ? "Listening" : "Live"}</span>
                </div>
              </div>
            </div>
            <div className="video-badge">AI interviewer</div>
          </div>
        </div>

        <div className="right-col">
          <div className="transcript-card">
            <div className="transcript-header">
              <p>Conversation transcript</p>
              <span>{visibleMessages.length} messages · {userMessageCount} user turns</span>
            </div>
            <div ref={transcriptBodyRef} className="transcript-body">
              {!avatarReady ? <p className="empty">Transcript will appear once avatar is ready.</p> : null}
              {avatarReady && visibleMessages.length === 0 ? <p className="empty">No conversation yet.</p> : null}
              {visibleMessages.map((message) => {
                const isUser = message.role === "user";
                const isAi = message.role === "ai";
                return (
                  <div key={message.id} className={`msg ${isUser ? "right" : ""}`}>
                    <span className={`msg-label ${isAi ? "ai" : isUser ? "user" : "system"}`}>
                      {isAi ? "POSH trainer" : isUser ? "You" : "System"}
                    </span>
                    <div className={`msg-bubble ${isAi ? "ai" : isUser ? "user" : "system"}`}>
                      {message.text}
                    </div>
                  </div>
                );
              })}
              {avatarReady && aiSpeaking ? (
                <div className="msg">
                  <span className="msg-label ai">POSH trainer</span>
                  <div className="typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="controls-bar">
            <button
              className={`ptalk-btn ${status === "listening" ? "talking" : ""}`}
              onPointerDown={handleTalkPointerDown}
              onPointerUp={handleTalkPointerUp}
              onPointerCancel={handleTalkPointerUp}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>{status === "listening" ? "Listening" : "Talk"}</span>
            </button>
            <button className="end-btn" onClick={endConversation} disabled={endingConversation}>
              {endingConversation ? "Ending..." : "End call"}
            </button>
          </div>
          <p className="status-note">Tip: Hold the Talk button or Space to speak, then release to send.</p>
          {liveSttText ? <p className="status-note">{liveSttText}</p> : null}
          {socketError ? <p className="error-note">{socketError}</p> : null}
        </div>
      </div>
    </main>
  );
}

export default App;
