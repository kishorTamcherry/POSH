import { useEffect, useMemo, useRef, useState } from "react";
import { LocalAudioTrack, Room, RoomEvent, Track } from "livekit-client";
import { io } from "socket.io-client";
import "./App.css";

const API_BASE_URL = "http://localhost:4000";
const TOKEN_STORAGE_KEY = "posh_token";

function App() {
  const [email, setEmail] = useState("demo@posh.app");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [status, setStatus] = useState("offline");
  const [token, setToken] = useState("");
  const [socketError, setSocketError] = useState("");
  const [liveSttText, setLiveSttText] = useState("");
  const [messages, setMessages] = useState([]);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [endingConversation, setEndingConversation] = useState(false);

  const socketRef = useRef(null);
  const livekitRoomRef = useRef(null);
  const avatarContainerRef = useRef(null);
  const avatarBootstrappedRef = useRef(false);
  const localMicTrackRef = useRef(null);
  const seenTranscriptIdsRef = useRef(new Set());
  const seenChatIdsRef = useRef(new Set());

  const isLoggedIn = Boolean(token);
  const userMessageCount = useMemo(
    () => messages.filter((message) => message.role === "user").length,
    [messages],
  );

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
      avatarBootstrappedRef.current = false;
    };
  }, []);

  const appendMessage = (message) => setMessages((prev) => [...prev, message]);

  const setupAvatarRoom = async (jwtToken) => {
    if (avatarBootstrappedRef.current) return;
    avatarBootstrappedRef.current = true;
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
          setAvatarLoading(false);
        }
        if (track.kind === "audio") {
          const el = track.attach();
          el.autoplay = true;
          el.style.display = "none";
          document.body.appendChild(el);
          void el.play().catch(() => {});
        }
      });
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const speakerIdentity = participant?.identity || "unknown";
        for (const segment of segments || []) {
          if (!segment.final || seenTranscriptIdsRef.current.has(segment.id)) continue;
          seenTranscriptIdsRef.current.add(segment.id);
          appendMessage({
            id: `stt-${segment.id}`,
            role: speakerIdentity.startsWith("user-") ? "user" : "system",
            text: segment.text,
          });
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
        if (topic !== "posh.ai.transcript") return;
        try {
          const text = new TextDecoder().decode(payload);
          const parsed = JSON.parse(text);
          if (parsed?.type !== "assistant_transcript" || !parsed?.id) return;
          if (seenChatIdsRef.current.has(parsed.id)) return;
          seenChatIdsRef.current.add(parsed.id);
          appendMessage({
            id: `ai-data-${parsed.id}`,
            role: participant?.identity?.includes("bey") ? "ai" : "ai",
            text: parsed.text || "",
          });
        } catch {
          // Ignore malformed payloads from unrelated data topics.
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        avatarBootstrappedRef.current = false;
        if (avatarContainerRef.current) avatarContainerRef.current.innerHTML = "";
      });

      await room.connect(payload.livekitUrl, payload.participantToken);
      livekitRoomRef.current = room;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micSource = stream.getAudioTracks()[0];
      const micTrack = new LocalAudioTrack(micSource);
      await micTrack.mute();
      await room.localParticipant.publishTrack(micTrack, { source: Track.Source.Microphone });
      localMicTrackRef.current = micTrack;
      setAvatarLoading(false);
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
    setSocketError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Failed to request OTP.");
      setOtpRequested(true);
      setStatus("otp-sent");
    } catch (error) {
      setStatus("error");
      setSocketError(error.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setSocketError("");
    try {
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
      connectSocket(payload.token);
    } catch (error) {
      setStatus("error");
      setSocketError(error.message);
    }
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

    if (livekitRoomRef.current) {
      livekitRoomRef.current.disconnect();
      livekitRoomRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    avatarBootstrappedRef.current = false;
    if (avatarContainerRef.current) avatarContainerRef.current.innerHTML = "";
    setLiveSttText("");
    setStatus("offline");
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

  if (!isLoggedIn) {
    return (
      <main className="screen login-screen">
        <section className="card">
          <h1>Posh AI Login</h1>
          <p>Login to start realtime AI avatar conversation.</p>
          <form onSubmit={handleLogin} className="stack">
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
            <button type="button" onClick={requestOtp}>
              {otpRequested ? "Resend OTP" : "Send OTP"}
            </button>
            <input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Enter OTP" />
            <button type="submit">Verify OTP & Login</button>
          </form>
          {socketError ? <p className="error">{socketError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="screen app-screen">
      <section className="avatar-panel card">
        <h2>AI Avatar</h2>
        <div className={`avatar ${status}`}>
          <div ref={avatarContainerRef} style={{ width: "100%", height: "100%" }} />
          {avatarLoading ? <span>Connecting avatar...</span> : null}
        </div>
        <p className="status">Status: {status}</p>
        <button
          onClick={() => {
            if (socketRef.current) socketRef.current.disconnect();
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
            setToken("");
            setMessages([]);
            setStatus("offline");
          }}
        >
          Logout
        </button>
        <div className="controls">
          <button onClick={interruptAi}>Interrupt AI</button>
          <button onMouseDown={beginHoldToTalk} onMouseUp={endHoldToTalk}>
            Hold To Talk
          </button>
          <button onClick={endConversation} disabled={endingConversation}>
            {endingConversation ? "Ending..." : "End Conversation"}
          </button>
        </div>
        {liveSttText ? <p className="status">{liveSttText}</p> : null}
        {socketError ? <p className="error">{socketError}</p> : null}
        <p className="status">Single pipeline mode: LiveKit worker handles STT/TTS/avatar.</p>
      </section>

      <section className="transcript-panel card">
        <h2>Transcript</h2>
        <p className="meta">User turns: {userMessageCount}</p>
        <div className="transcript-list">
          {messages.length === 0 ? <p className="empty">No conversation yet.</p> : null}
          {messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <strong>{message.role.toUpperCase()}</strong>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
