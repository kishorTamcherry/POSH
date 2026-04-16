import { useEffect, useMemo, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import { LocalAudioTrack, Room, RoomEvent, Track } from "livekit-client";
import { io } from "socket.io-client";
import { AdminDashboardPage } from "./pages/AdminDashboardPage.jsx";
import { AdminLoginPage } from "./pages/AdminLoginPage.jsx";
import { CandidateLoginPage } from "./pages/CandidateLoginPage.jsx";
import { CandidateSessionPage } from "./pages/CandidateSessionPage.jsx";
import "./App.css";

const API_BASE_URL = "http://localhost:4000";
const TOKEN_STORAGE_KEY = "posh_token";
const ADMIN_TOKEN_STORAGE_KEY = "posh_admin_token";
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
  const [sessionEndedScreen, setSessionEndedScreen] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [avatarLoaderStep, setAvatarLoaderStep] = useState(0);
  const [avatarReady, setAvatarReady] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState("checking");
  const [attendanceNote, setAttendanceNote] = useState("Verifying camera presence...");
  const [adminToken, setAdminToken] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminRows, setAdminRows] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminTab, setAdminTab] = useState("dashboard");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteListFilter, setInviteListFilter] = useState("all");
  const [candidateListFilter, setCandidateListFilter] = useState("all");
  const [dashboardListFilter, setDashboardListFilter] = useState("all");
  const [candidateRows, setCandidateRows] = useState([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [selectedCandidateEmail, setSelectedCandidateEmail] = useState("");

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
  const completionReportedRef = useRef(false);
  const completionEligibleRef = useRef(false);
  const pendingAutoEndRef = useRef(false);

  const isLoggedIn = Boolean(token);
  const isAdminPath = useMemo(() => {
    const path = String(window.location.pathname || "");
    const normalized = path.startsWith("/react/") ? path.slice("/react".length) : path;
    return normalized.startsWith("/admin");
  }, []);
  const isAdminLoggedIn = Boolean(adminToken);
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
  const candidateTotals = useMemo(() => {
    const invited = candidateRows.length;
    const attended = candidateRows.filter((row) => row?.attended).length;
    const pending = Math.max(0, invited - attended);
    return { invited, attended, pending };
  }, [candidateRows]);
  const selectedCandidate = useMemo(() => {
    if (!selectedCandidateEmail) return null;
    return candidateRows.find((row) => row.email === selectedCandidateEmail) || null;
  }, [candidateRows, selectedCandidateEmail]);

  useEffect(() => {
    if (isAdminPath) {
      const storedAdminToken = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      if (storedAdminToken) {
        setAdminToken(storedAdminToken);
      }
      return;
    }
    const storedCandidateToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedCandidateToken) {
      setToken(storedCandidateToken);
      setStatus("connecting");
      connectSocket(storedCandidateToken);
    }
  }, [isAdminPath]);

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
    if (isAdminPath || !isLoggedIn) return;
    const intervalId = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isAdminPath, isLoggedIn]);

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
  const reportTrainingCompletion = async () => {
    // Deprecated path: completion is now persisted by backend from attendance ping.
    completionReportedRef.current = true;
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
    if (isAdminPath || !token || !isLoggedIn || status === "offline") return;

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
  }, [attendanceNote, attendanceStatus, avatarReady, camOn, isAdminPath, isLoggedIn, status, token]);

  useEffect(() => {
    if (!isAdminPath || !adminToken) return;

    const loadAttendance = async () => {
      setAdminLoading(true);
      setAdminError("");
      try {
        const response = await fetch(`${API_BASE_URL}/attendance/camera/latest?limit=100`, {
          headers: { Authorization: `Bearer ${adminToken}` },
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
  }, [adminToken, isAdminPath]);

  useEffect(() => {
    if (!isAdminPath || !adminToken) return;

    const loadCandidates = async () => {
      setCandidateLoading(true);
      setCandidateError("");
      try {
        const response = await fetch(`${API_BASE_URL}/admin/candidates/invited`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || "Failed to fetch invited candidates.");
        }
        setCandidateRows(Array.isArray(payload?.records) ? payload.records : []);
        setSelectedCandidateEmail((prev) => {
          if (!prev) return "";
          return (payload?.records || []).some((row) => row?.email === prev) ? prev : "";
        });
      } catch (error) {
        setCandidateError(error.message || "Failed to fetch invited candidates.");
      } finally {
        setCandidateLoading(false);
      }
    };

    void loadCandidates();
    const intervalId = setInterval(() => {
      void loadCandidates();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [adminToken, isAdminPath]);

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

          if (topic === "posh.training.status") {
            if (parsed?.type === "training_completion_reached") {
              completionEligibleRef.current = true;
              completionReportedRef.current = true;
              appendMessage({
                id: `sys-complete-${Date.now()}`,
                role: "system",
                text: "Training completion checkpoint reached.",
              });
              if (pendingAutoEndRef.current) {
                void endConversation();
              }
              return;
            }
            if (parsed?.type === "training_end_requested") {
              if (endingConversation) return;
              void endConversation();
              return;
            }
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
          if (parsed?.isLastQuestion === true && !parsed?.interrupted) {
            completionEligibleRef.current = true;
            if (pendingAutoEndRef.current) {
              void endConversation();
            }
          }
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
      setSessionEndedScreen(false);
      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      setStatus("connecting");
      clearInterval(timerRef.current);
      connectSocket(payload.token);
    } catch (error) {
      setStatus("error");
      setSocketError(error.message);
    }
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setAdminError("");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Admin login failed.");
      }
      setAdminToken(payload.token);
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, payload.token);
      setAdminPassword("");
    } catch (error) {
      setAdminError(error.message || "Admin login failed.");
    }
  };

  const handleSendInvite = async (event) => {
    event.preventDefault();
    setInviteMessage("");
    setInviteError("");
    if (!inviteName.trim()) {
      setInviteError("Enter candidate name.");
      return;
    }
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setInviteError("Enter a valid candidate email.");
      return;
    }
    setInviteSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to send invitation.");
      }
      setInviteMessage(payload?.message || "Invitation sent.");
      setInviteName("");
      setInviteEmail("");
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/admin/candidates/invited`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const refreshPayload = await refreshResponse.json();
        if (refreshResponse.ok) {
          const refreshedRows = Array.isArray(refreshPayload?.records) ? refreshPayload.records : [];
          setCandidateRows(refreshedRows);
          setSelectedCandidateEmail((prev) => {
            if (!prev) return "";
            return refreshedRows.some((row) => row?.email === prev) ? prev : "";
          });
        }
      } catch {
        // no-op
      }
    } catch (error) {
      setInviteError(error.message || "Failed to send invitation.");
    } finally {
      setInviteSending(false);
    }
  };
  const handleBulkReminder = async (rows) => {
    const targets = Array.isArray(rows) ? rows : [];
    if (targets.length === 0) return { message: "No candidates selected." };
    let success = 0;
    for (const row of targets) {
      const name = String(row?.candidateName || row?.email || "").trim();
      const email = String(row?.email || "")
        .trim()
        .toLowerCase();
      if (!name || !email) continue;
      const response = await fetch(`${API_BASE_URL}/admin/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name, email }),
      });
      if (response.ok) success += 1;
    }
    const refreshed = await fetch(`${API_BASE_URL}/admin/candidates/invited`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const payload = await refreshed.json();
    if (refreshed.ok) {
      setCandidateRows(Array.isArray(payload?.records) ? payload.records : []);
    }
    return { message: `Reminder sent to ${success}/${targets.length} candidates.` };
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
    completionReportedRef.current = false;
    completionEligibleRef.current = false;
    pendingAutoEndRef.current = false;
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
      setSessionEndedScreen(true);
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

  if (!isLoggedIn && !isAdminPath) {
    return (
      <CandidateLoginPage
        otpRequested={otpRequested}
        otpDigits={otpDigits}
        email={email}
        emailError={emailError}
        socketError={socketError}
        countdown={countdown}
        cellRefs={cellRefs}
        onEmailChange={(event) => {
          setEmail(event.target.value);
          setEmailError(false);
        }}
        onRequestOtp={requestOtp}
        onBackToEmail={() => {
          setOtpRequested(false);
          setOtpDigits(["", "", "", "", "", ""]);
          clearInterval(timerRef.current);
          setCountdown(0);
        }}
        onSubmitLogin={handleLogin}
        onCellChange={handleCellChange}
        onCellKeyDown={handleCellKeyDown}
        onPasteOtp={handlePasteOtp}
      />
    );
  }

  if (isAdminPath) {
    if (!isAdminLoggedIn) {
      return (
        <AdminLoginPage
          adminEmail={adminEmail}
          adminPassword={adminPassword}
          adminError={adminError}
          onAdminEmailChange={(event) => setAdminEmail(event.target.value)}
          onAdminPasswordChange={(event) => setAdminPassword(event.target.value)}
          onSubmit={handleAdminLogin}
        />
      );
    }

    const todayLabel = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (
      <AdminDashboardPage
        adminStats={adminStats}
        adminRows={adminRows}
        adminLoading={adminLoading}
        adminError={adminError}
        activeTab={adminTab}
        inviteName={inviteName}
        inviteEmail={inviteEmail}
        inviteSending={inviteSending}
        inviteMessage={inviteMessage}
        inviteError={inviteError}
        inviteListFilter={inviteListFilter}
        candidateListFilter={candidateListFilter}
        dashboardListFilter={dashboardListFilter}
        candidateRows={candidateRows}
        candidateTotals={candidateTotals}
        candidateLoading={candidateLoading}
        candidateError={candidateError}
        selectedCandidate={selectedCandidate}
        todayLabel={todayLabel}
        onLogout={() => {
          window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
          setAdminToken("");
        }}
        onTabChange={(tab) => setAdminTab(tab)}
        onInviteFilterChange={(filter) => setInviteListFilter(filter)}
        onCandidateFilterChange={(filter) => setCandidateListFilter(filter)}
        onDashboardFilterChange={(filter) => setDashboardListFilter(filter)}
        onInviteNameChange={(event) => setInviteName(event.target.value)}
        onInviteEmailChange={(event) => setInviteEmail(event.target.value)}
        onSendInvite={handleSendInvite}
        onBulkReminder={handleBulkReminder}
        onSelectCandidate={(email) => setSelectedCandidateEmail(email)}
      />
    );
  }

  return (
    <CandidateSessionPage
      sessionEndedScreen={sessionEndedScreen}
      interruptAi={interruptAi}
      disconnectAndLogout={() => {
        disconnectRealtime();
        setSessionEndedScreen(false);
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
        setMessages([]);
      }}
      sessionTimer={sessionTimer}
      avatarContainerRef={avatarContainerRef}
      avatarLoading={avatarLoading}
      camOn={camOn}
      camVideoRef={camVideoRef}
      status={status}
      avatarLoaderStep={avatarLoaderStep}
      avatarLoaderSteps={AVATAR_LOADER_STEPS}
      avatarLoaderStatus={AVATAR_LOADER_STATUS}
      visibleMessages={visibleMessages}
      userMessageCount={userMessageCount}
      transcriptBodyRef={transcriptBodyRef}
      avatarReady={avatarReady}
      aiSpeaking={aiSpeaking}
      handleTalkPointerDown={handleTalkPointerDown}
      handleTalkPointerUp={handleTalkPointerUp}
      endConversation={endConversation}
      endingConversation={endingConversation}
      liveSttText={liveSttText}
      socketError={socketError}
    />
  );
}

export default App;
