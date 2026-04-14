import { OtpCell, PrimaryBtn, SentBadge, StepPip, TextInput, loginStyles } from "../ui/authUi.jsx";

export function CandidateLoginPage(props) {
  const {
    otpRequested,
    otpDigits,
    email,
    emailError,
    socketError,
    countdown,
    cellRefs,
    onEmailChange,
    onRequestOtp,
    onBackToEmail,
    onSubmitLogin,
    onCellChange,
    onCellKeyDown,
    onPasteOtp,
  } = props;

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
                onChange={onEmailChange}
                placeholder="you@example.com"
                error={emailError}
                autoFocus
              />
              <PrimaryBtn onClick={onRequestOtp}>
                Send code
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22 11 13 2 9l20-7z" />
                </svg>
              </PrimaryBtn>
            </div>
          ) : (
            <form onSubmit={onSubmitLogin}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1rem" }}>
                <button
                  type="button"
                  onClick={onBackToEmail}
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
                    onChange={(event) => onCellChange(index, event)}
                    onKeyDown={(event) => onCellKeyDown(index, event)}
                    onPaste={onPasteOtp}
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
                  onClick={onRequestOtp}
                  disabled={countdown > 0}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: countdown > 0 ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    color: countdown > 0 ? "#b8b4d8" : "#7f77dd",
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
