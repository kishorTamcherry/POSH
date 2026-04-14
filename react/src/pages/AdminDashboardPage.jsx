import { formatAgo, formatMinutes, initialsFromEmail } from "../utils/formatters.js";

export function AdminDashboardPage({
  adminStats,
  adminRows,
  adminLoading,
  adminError,
  activeTab,
  inviteEmail,
  inviteSending,
  inviteMessage,
  inviteError,
  candidateRows,
  candidateTotals,
  candidateLoading,
  candidateError,
  selectedCandidate,
  todayLabel,
  onOpenTrainingUi,
  onLogout,
  onTabChange,
  onInviteEmailChange,
  onSendInvite,
  onSelectCandidate,
}) {
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
        <button
          type="button"
          className={`adm-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => onTabChange("dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`adm-nav-item ${activeTab === "invitations" ? "active" : ""}`}
          onClick={() => onTabChange("invitations")}
        >
          Invitations
        </button>
        <button
          type="button"
          className={`adm-nav-item ${activeTab === "candidates" ? "active" : ""}`}
          onClick={() => onTabChange("candidates")}
        >
          Candidates <span className="adm-badge">{candidateTotals.invited}</span>
        </button>
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
            <div className="adm-page-title">
              {activeTab === "invitations" ? "Invitations" : activeTab === "candidates" ? "Candidates" : "Dashboard"}
            </div>
            <div className="adm-page-sub">{todayLabel}</div>
          </div>
          <div className="adm-actions">
            <button className="adm-btn-outline" onClick={onOpenTrainingUi}>
              Open Training UI
            </button>
            <button className="adm-btn-primary" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        {activeTab === "invitations" ? (
          <div className="adm-content-row">
            <div className="adm-card">
              <div className="adm-card-header">
                <p>Send invitation</p>
                <span>Email candidate access link</span>
              </div>
              <form
                onSubmit={onSendInvite}
                style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "560px" }}
              >
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={onInviteEmailChange}
                  placeholder="candidate@company.com"
                  required
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d9d6ee",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
                <button className="adm-btn-primary" type="submit" disabled={inviteSending}>
                  {inviteSending ? "Sending..." : "Send Invite"}
                </button>
                {inviteMessage ? (
                  <p style={{ margin: 0, fontSize: "13px", color: "#1f7a52" }}>{inviteMessage}</p>
                ) : null}
                {inviteError ? (
                  <p style={{ margin: 0, fontSize: "13px", color: "#b42318" }}>{inviteError}</p>
                ) : null}
              </form>
            </div>
          </div>
        ) : activeTab === "candidates" ? (
          <>
            <div className="adm-stats-grid">
              <div className="adm-stat-card">
                <div className="adm-stat-label">Invited candidates</div>
                <div className="adm-stat-val">{candidateTotals.invited}</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Attended</div>
                <div className="adm-stat-val">{candidateTotals.attended}</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Pending</div>
                <div className="adm-stat-val">{candidateTotals.pending}</div>
              </div>
            </div>

            {candidateError ? <p className="error-note">{candidateError}</p> : null}
            <div className="adm-content-row adm-candidates-layout">
              <div className="adm-card">
                <div className="adm-card-header">
                  <p>Invited candidates</p>
                  <span>{candidateLoading ? "Refreshing..." : `Showing ${candidateRows.length} candidates`}</span>
                </div>
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Status</th>
                      <th>Invites</th>
                      <th>Invited</th>
                      <th>Last Attended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidateRows.map((row) => (
                      <tr
                        key={row.email}
                        onClick={() => onSelectCandidate(row.email)}
                        className={`adm-click-row ${selectedCandidate?.email === row.email ? "is-selected" : ""}`}
                      >
                        <td>
                          <div className="adm-candidate-cell">
                            <div className="adm-cand-avatar">{initialsFromEmail(row.email)}</div>
                            <div>
                              <div className="adm-cand-name">{row.email}</div>
                              <div className="adm-cand-sub">Invited by {row.invitedBy || "admin"}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`adm-status-pill ${row.attended ? "live" : "away"}`}>
                            {row.attended ? "Attended" : "Pending"}
                          </span>
                        </td>
                        <td>{row.inviteCount || 0}</td>
                        <td>{formatAgo(row.lastInvitedAt)}</td>
                        <td>{row.lastAttendedAt ? formatAgo(row.lastAttendedAt) : "-"}</td>
                      </tr>
                    ))}
                    {!candidateLoading && candidateRows.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No invited candidates yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="adm-side-col">
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>Candidate detail</p>
                    <span>{selectedCandidate ? selectedCandidate.email : "Select a candidate row"}</span>
                  </div>
                  {!selectedCandidate ? (
                    <p className="adm-detail-empty">Click a candidate to view attendance insights.</p>
                  ) : (
                    <div className="adm-detail-body">
                      <div className="adm-detail-row">
                        <span>Detected</span>
                        <b>{selectedCandidate?.insights?.currentlyDetected ? "Yes" : "No"}</b>
                      </div>
                      <div className="adm-detail-row">
                        <span>Out Since</span>
                        <b>{selectedCandidate?.insights?.outSince ? formatAgo(selectedCandidate.insights.outSince) : "-"}</b>
                      </div>
                      <div className="adm-detail-row">
                        <span>Last Seen</span>
                        <b>{selectedCandidate?.insights?.lastSeenAt ? formatAgo(selectedCandidate.insights.lastSeenAt) : "-"}</b>
                      </div>
                      <div className="adm-detail-row">
                        <span>In Front (min)</span>
                        <b>{formatMinutes(selectedCandidate?.insights?.presentMinutes || 0)}</b>
                      </div>
                      <div className="adm-detail-row">
                        <span>Away (min)</span>
                        <b>{formatMinutes(selectedCandidate?.insights?.awayMinutes || 0)}</b>
                      </div>
                      <div className="adm-detail-row">
                        <span>Updated</span>
                        <b>{selectedCandidate?.attendanceUpdatedAt ? formatAgo(selectedCandidate.attendanceUpdatedAt) : "-"}</b>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="adm-stats-grid">
              <div className="adm-stat-card">
                <div className="adm-stat-label">Total candidates</div>
                <div className="adm-stat-val">{Math.max(candidateTotals.invited, adminStats.total)}</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Invited candidates</div>
                <div className="adm-stat-val">{candidateTotals.invited}</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Candidates attended</div>
                <div className="adm-stat-val">{candidateTotals.attended}</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Candidates pending</div>
                <div className="adm-stat-val">{candidateTotals.pending}</div>
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
                    <div className="adm-donut-stat">
                      {adminStats.total ? `${Math.round((adminStats.detected / adminStats.total) * 100)}%` : "0%"}
                    </div>
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
          </>
        )}
      </section>
    </main>
  );
}
