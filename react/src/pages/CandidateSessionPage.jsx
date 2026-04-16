export function CandidateSessionPage({
  sessionEndedScreen,
  interruptAi,
  disconnectAndLogout,
  sessionTimer,
  avatarContainerRef,
  avatarLoading,
  camOn,
  camVideoRef,
  status,
  avatarLoaderStep,
  avatarLoaderSteps,
  avatarLoaderStatus,
  visibleMessages,
  userMessageCount,
  transcriptBodyRef,
  avatarReady,
  aiSpeaking,
  handleTalkPointerDown,
  handleTalkPointerUp,
  endConversation,
  endingConversation,
  liveSttText,
  socketError,
}) {
  if (sessionEndedScreen) {
    return (
      <main className="interview-root">
        <div className="session-ended-wrap">
          <div className="session-ended-card">
            <h2>POSH training session completed</h2>
            <p>You can close this window.</p>
            <button className="icon-btn danger" onClick={disconnectAndLogout}>
              Back to login
            </button>
          </div>
        </div>
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
          <button className="icon-btn danger" onClick={disconnectAndLogout}>
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
                    {avatarLoaderSteps.map((label, index) => {
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

                  <div className="av-status-msg">{avatarLoaderStatus[avatarLoaderStep]}</div>
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
            <div className="video-badge">POSH trainer</div>
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
