import { useMemo, useState } from "react";
import { formatAgo, formatMinutes, initialsFromEmail } from "../utils/formatters.js";

export function AdminDashboardPage({
  adminStats,
  adminRows,
  adminLoading,
  adminError,
  activeTab,
  inviteName,
  inviteEmail,
  inviteSending,
  inviteMessage,
  inviteError,
  inviteListFilter,
  candidateListFilter,
  dashboardListFilter,
  candidateRows,
  candidateTotals,
  candidateLoading,
  candidateError,
  selectedCandidate,
  todayLabel,
  onLogout,
  onTabChange,
  onInviteFilterChange,
  onCandidateFilterChange,
  onDashboardFilterChange,
  onInviteNameChange,
  onInviteEmailChange,
  onSendInvite,
  onBulkReminder,
  onSelectCandidate,
}) {
  const [selectedInvitationEmails, setSelectedInvitationEmails] = useState([]);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [bulkActionMsg, setBulkActionMsg] = useState("");
  const [overviewTooltip, setOverviewTooltip] = useState(null);
  const [agingTooltip, setAgingTooltip] = useState(null);
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  const invitationStatus = (row) => {
    if (row?.attended) return "completed";
    const minutes = Number(row?.insights?.totalTrainingMinutes || 0);
    if (minutes > 0) return "inprogress";
    return "pending";
  };
  const statusConfig = {
    pending: { label: "Pending", className: "away" },
    inprogress: { label: "In progress", className: "live" },
    completed: { label: "Completed", className: "live" },
  };

  const filteredInvitationRows =
    inviteListFilter === "completed"
      ? candidateRows.filter((row) => row.attended)
      : inviteListFilter === "pending"
        ? candidateRows.filter((row) => !row.attended)
        : candidateRows;
  const invitationStats = (() => {
    const total = candidateRows.length;
    const completed = candidateRows.filter((row) => invitationStatus(row) === "completed").length;
    const inprogress = candidateRows.filter((row) => invitationStatus(row) === "inprogress").length;
    const pending = Math.max(0, total - completed - inprogress);
    return { total, completed, inprogress, pending };
  })();
  const weeklyInvites = (() => {
    const now = new Date();
    const slots = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return {
        key: d.toISOString().slice(0, 10),
        day: d.toLocaleDateString(undefined, { weekday: "short" }),
        val: 0,
      };
    });
    const byDay = new Map(slots.map((s) => [s.key, s]));
    for (const row of candidateRows) {
      const ts = new Date(row?.lastInvitedAt || row?.firstInvitedAt || Date.now());
      if (Number.isNaN(ts.getTime())) continue;
      ts.setHours(0, 0, 0, 0);
      const key = ts.toISOString().slice(0, 10);
      const slot = byDay.get(key);
      if (slot) slot.val += 1;
    }
    return slots;
  })();
  const weeklyMax = Math.max(1, ...weeklyInvites.map((item) => item.val));
  const recentWeekInvited = weeklyInvites.reduce((sum, item) => sum + item.val, 0);
  const recentWeekCompleted = candidateRows.filter((row) => {
    const ts = new Date(row?.completedAt || 0).getTime();
    if (!Number.isFinite(ts) || ts <= 0) return false;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return ts >= sevenDaysAgo;
  }).length;
  const needsAttentionRows = useMemo(
    () =>
      candidateRows
        .filter((row) => !row.attended)
        .map((row) => {
          const invitedAt = new Date(row?.lastInvitedAt || row?.firstInvitedAt || Date.now()).getTime();
          const ageHours = Number.isFinite(invitedAt) ? Math.max(0, (Date.now() - invitedAt) / 3600000) : 0;
          const status = invitationStatus(row);
          const reason =
            ageHours >= 72
              ? "Pending for over 3 days"
              : status === "inprogress"
                ? "Started but not completed"
                : "Invite sent, no progress yet";
          return { ...row, ageHours, reason };
        })
        .filter((row) => {
          // Show only true follow-up cases:
          // - pending with no progress after 48h
          // - in-progress but unfinished after 24h
          const status = invitationStatus(row);
          if (status === "pending") return row.ageHours >= 48;
          if (status === "inprogress") return row.ageHours >= 24;
          return false;
        })
        .sort((a, b) => b.ageHours - a.ageHours)
        .slice(0, 5),
    [candidateRows],
  );

  const filteredCandidateRows =
    candidateListFilter === "completed"
      ? candidateRows.filter((row) => row.attended)
      : candidateListFilter === "pending"
        ? candidateRows.filter((row) => !row.attended)
        : candidateRows;
  const isRowSelected = (email) => selectedInvitationEmails.includes(email);
  const allFilteredSelected =
    filteredInvitationRows.length > 0 &&
    filteredInvitationRows.every((row) => selectedInvitationEmails.includes(row.email));
  const toggleInvitationRow = (email) => {
    setSelectedInvitationEmails((prev) =>
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email],
    );
  };
  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedInvitationEmails((prev) =>
        prev.filter((email) => !filteredInvitationRows.some((row) => row.email === email)),
      );
      return;
    }
    setSelectedInvitationEmails((prev) => {
      const next = new Set(prev);
      for (const row of filteredInvitationRows) next.add(row.email);
      return [...next];
    });
  };
  const selectedInvitationRows = filteredInvitationRows.filter((row) =>
    selectedInvitationEmails.includes(row.email),
  );
  const runBulkReminder = async () => {
    if (!selectedInvitationRows.length || typeof onBulkReminder !== "function") return;
    setBulkActionBusy(true);
    setBulkActionMsg("");
    try {
      const result = await onBulkReminder(selectedInvitationRows);
      setBulkActionMsg(result?.message || `Reminder sent to ${selectedInvitationRows.length} candidate(s).`);
    } catch (error) {
      setBulkActionMsg(error?.message || "Failed to send reminders.");
    } finally {
      setBulkActionBusy(false);
    }
  };
  const completionByEmail = new Map(
    candidateRows.map((row) => [String(row.email || "").toLowerCase(), Boolean(row.attended)]),
  );
  const attendanceByEmail = new Map(
    adminRows.map((row) => [String(row?.email || "").toLowerCase(), row]),
  );
  const dashboardBaseRows =
    candidateRows.length > 0
      ? candidateRows.map((candidate) => {
          const email = String(candidate?.email || "").toLowerCase();
          const attendance = attendanceByEmail.get(email);
          return {
            ...(attendance || {}),
            email: candidate.email,
            candidateName: candidate.candidateName || attendance?.candidateName || "",
            updatedAt: attendance?.updatedAt || candidate.lastInvitedAt || candidate.firstInvitedAt || null,
            completed: Boolean(candidate.attended),
            insights: attendance?.insights || {
              currentlyDetected: false,
              presentMinutes: 0,
              awayMinutes: 0,
              totalTrainingMinutes: 0,
            },
            note: attendance?.note || "No attendance data yet.",
          };
        })
      : adminRows.map((row) => ({
          ...row,
          completed: completionByEmail.get(String(row?.email || "").toLowerCase()) === true,
        }));
  const filteredDashboardRows =
    dashboardListFilter === "completed"
      ? dashboardBaseRows.filter((row) => row.completed === true)
      : dashboardListFilter === "pending"
        ? dashboardBaseRows.filter((row) => row.completed === false)
        : dashboardListFilter === "started"
          ? dashboardBaseRows.filter((row) => Number(row?.insights?.totalTrainingMinutes || 0) > 0)
        : dashboardListFilter === "invited"
          ? dashboardBaseRows.filter((row) =>
              completionByEmail.has(String(row?.email || "").toLowerCase()),
            )
          : dashboardBaseRows;
  const dashboardMetrics = (() => {
    const invited = dashboardBaseRows.length;
    const startedRows = dashboardBaseRows.filter(
      (row) => Number(row?.insights?.totalTrainingMinutes || 0) > 0,
    );
    const started = startedRows.length;
    const completed = dashboardBaseRows.filter((row) => row.completed === true).length;
    const pending = Math.max(0, invited - completed);
    const avgPresencePct = startedRows.length
      ? startedRows.reduce((sum, row) => {
          const present = Number(row?.insights?.presentMinutes || 0);
          const away = Number(row?.insights?.awayMinutes || 0);
          const total = present + away;
          return sum + (total > 0 ? (present / total) * 100 : 0);
        }, 0) / startedRows.length
      : 0;
    const avgTrainingMinutes = startedRows.length
      ? startedRows.reduce((sum, row) => sum + Number(row?.insights?.totalTrainingMinutes || 0), 0) /
        startedRows.length
      : 0;
    const liveNow = dashboardBaseRows.filter((row) => Boolean(row?.insights?.currentlyDetected)).length;
    const stalePending = dashboardBaseRows.filter((row) => {
      if (row.completed) return false;
      const updatedAt = new Date(row?.updatedAt || 0).getTime();
      if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;
      return Date.now() - updatedAt > 48 * 60 * 60 * 1000;
    }).length;
    return {
      invited,
      started,
      completed,
      pending,
      avgPresencePct: Number(avgPresencePct.toFixed(1)),
      avgTrainingMinutes: Number(avgTrainingMinutes.toFixed(1)),
      liveNow,
      stalePending,
    };
  })();
  const completionTrend = (() => {
    const now = new Date();
    const points = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (29 - i));
      d.setHours(0, 0, 0, 0);
      return {
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: 0,
      };
    });
    const byKey = new Map(points.map((p) => [p.key, p]));
    for (const row of candidateRows) {
      if (!row?.attended || !row?.completedAt) continue;
      const dt = new Date(row.completedAt);
      if (Number.isNaN(dt.getTime())) continue;
      dt.setHours(0, 0, 0, 0);
      const key = dt.toISOString().slice(0, 10);
      const point = byKey.get(key);
      if (point) point.value += 1;
    }
    return points;
  })();
  const funnelData = [
    { label: "Invited", value: dashboardMetrics.invited },
    { label: "Started", value: dashboardMetrics.started },
    {
      label: "In Progress",
      value: Math.max(0, dashboardMetrics.started - dashboardMetrics.completed),
    },
    { label: "Completed", value: dashboardMetrics.completed },
  ];
  const pendingAging = (() => {
    const buckets = [
      { label: "0-1d", minH: 0, maxH: 24, count: 0 },
      { label: "2-3d", minH: 24, maxH: 72, count: 0 },
      { label: "4-7d", minH: 72, maxH: 168, count: 0 },
      { label: ">7d", minH: 168, maxH: Infinity, count: 0 },
    ];
    for (const row of dashboardBaseRows) {
      if (row?.completed) continue;
      const invitedMs = new Date(row?.updatedAt || 0).getTime();
      const ageH = Number.isFinite(invitedMs) && invitedMs > 0 ? (Date.now() - invitedMs) / 3600000 : 0;
      const bucket = buckets.find((b) => ageH >= b.minH && ageH < b.maxH);
      if (bucket) bucket.count += 1;
    }
    return buckets;
  })();
  const completionTrendMax = Math.max(1, ...completionTrend.map((p) => p.value));
  const funnelMax = Math.max(1, ...funnelData.map((f) => f.value));
  const pendingAgingMax = Math.max(1, ...pendingAging.map((b) => b.count));
  const trainingOverviewBars = [
    { label: "Invited", value: dashboardMetrics.invited, tone: "" },
    { label: "Started", value: dashboardMetrics.started, tone: "" },
    { label: "Completed", value: dashboardMetrics.completed, tone: "" },
    { label: "Pending", value: dashboardMetrics.pending, tone: "warn" },
  ];

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
            <button className="adm-btn-primary" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        {activeTab === "invitations" ? (
          <>
            <div className="adm-stats-grid adm-invite-stats adm-invite-stats-4">
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${inviteListFilter === "all" ? "active" : ""}`}
                onClick={() => onInviteFilterChange("all")}
              >
                <div className="adm-stat-label">Total invited</div>
                <div className="adm-stat-val">{invitationStats.total}</div>
                <div className="adm-stat-sub">All invitations</div>
              </button>
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${inviteListFilter === "completed" ? "active" : ""}`}
                onClick={() => onInviteFilterChange("completed")}
              >
                <div className="adm-stat-label">Completed</div>
                <div className="adm-stat-val">{invitationStats.completed}</div>
                <div className="adm-stat-sub">Fully completed</div>
              </button>
              <button
                type="button"
                className="adm-stat-card adm-stat-click"
                onClick={() => onInviteFilterChange("all")}
              >
                <div className="adm-stat-label">In progress</div>
                <div className="adm-stat-val">{invitationStats.inprogress}</div>
                <div className="adm-stat-sub">Started but not done</div>
              </button>
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${inviteListFilter === "pending" ? "active" : ""}`}
                onClick={() => onInviteFilterChange("pending")}
              >
                <div className="adm-stat-label">Pending</div>
                <div className="adm-stat-val">{invitationStats.pending}</div>
                <div className="adm-stat-sub">Yet to start</div>
              </button>
            </div>
            <div className="adm-content-row adm-invitations-layout">
              <div className="adm-invite-left">
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>Send training invitation</p>
                    <span>Email candidate access link</span>
                  </div>
                  <div className="adm-invite-body">
                    <div className="adm-invite-banner">
                      <div className="adm-invite-icon">✉</div>
                      <div>
                        <p>Invite a candidate to start POSH training</p>
                        <span>The candidate receives a secure mail and appears in the tracker.</span>
                      </div>
                    </div>
                    <form className="adm-invite-form" onSubmit={onSendInvite}>
                      <div className="adm-invite-grid">
                        <div>
                          <label htmlFor="invite-name" className="adm-invite-label">
                            Candidate name
                          </label>
                          <input
                            id="invite-name"
                            type="text"
                            value={inviteName}
                            onChange={onInviteNameChange}
                            placeholder="Enter candidate name"
                            required
                            className="adm-invite-input"
                          />
                        </div>
                        <div>
                          <label htmlFor="invite-email" className="adm-invite-label">
                            Candidate email
                          </label>
                          <input
                            id="invite-email"
                            type="email"
                            value={inviteEmail}
                            onChange={onInviteEmailChange}
                            placeholder="candidate@company.com"
                            required
                            className="adm-invite-input"
                          />
                        </div>
                      </div>
                      <div className="adm-invite-input-row">
                        <button className="adm-btn-primary adm-invite-btn" type="submit" disabled={inviteSending}>
                          {inviteSending ? "Sending..." : "Send invite"}
                        </button>
                        <button type="button" className="adm-btn-outline">
                          Bulk invite
                        </button>
                      </div>
                      {inviteMessage ? <p className="adm-invite-msg success">{inviteMessage}</p> : null}
                      {inviteError ? <p className="adm-invite-msg error">{inviteError}</p> : null}
                    </form>
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>All candidates</p>
                    <span>{filteredInvitationRows.length} records</span>
                  </div>
                  {selectedInvitationRows.length > 0 ? (
                    <div className="adm-bulk-row">
                      <span>{selectedInvitationRows.length} selected</span>
                      <button className="adm-btn-outline" onClick={runBulkReminder} disabled={bulkActionBusy}>
                        {bulkActionBusy ? "Sending..." : "Send reminder"}
                      </button>
                      {bulkActionMsg ? <em>{bulkActionMsg}</em> : null}
                    </div>
                  ) : null}
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>
                          <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} />
                        </th>
                        <th>Candidate</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Invited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvitationRows.map((row) => {
                        const st = invitationStatus(row);
                        const cfg = statusConfig[st];
                        const total = Number(row?.insights?.totalTrainingMinutes || 0);
                        const progress = row.attended ? 100 : total > 0 ? 60 : 0;
                        return (
                          <tr key={`tbl-${row.email}`}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isRowSelected(row.email)}
                                onChange={() => toggleInvitationRow(row.email)}
                              />
                            </td>
                            <td>
                              <div className="adm-candidate-cell">
                                <div className="adm-cand-avatar">{initialsFromEmail(row.email)}</div>
                                <div>
                                  <div className="adm-cand-name">{row.candidateName || row.email}</div>
                                  <div className="adm-cand-sub">{row.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`adm-status-pill ${cfg.className}`}>{cfg.label}</span>
                            </td>
                            <td>
                              <div className="adm-table-progress">
                                <div className="adm-table-progress-track">
                                  <div className="adm-table-progress-fill" style={{ width: `${progress}%` }} />
                                </div>
                                <span>{progress}%</span>
                              </div>
                            </td>
                            <td>{formatAgo(row.lastInvitedAt)}</td>
                          </tr>
                        );
                      })}
                      {filteredInvitationRows.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No candidates in this list.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="adm-side-col">
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>Activity feed</p>
                    <span>Live</span>
                  </div>
                  <div className="adm-activity-list">
                    {candidateRows.slice(0, 6).map((row) => {
                      const st = invitationStatus(row);
                      const cfg = statusConfig[st];
                      const title =
                        st === "completed"
                          ? `${row.candidateName || row.email} completed training`
                          : st === "inprogress"
                            ? `${row.candidateName || row.email} opened module`
                            : `${row.candidateName || row.email} invited`;
                      const meta =
                        st === "completed"
                          ? `${formatAgo(row.lastInvitedAt)} · Certificate issued`
                          : st === "inprogress"
                            ? `${formatAgo(row.lastInvitedAt)} · 60% complete`
                            : `${formatAgo(row.lastInvitedAt)} · POSH · Pending`;
                      return (
                        <div className="adm-activity-item" key={`act-${row.email}`}>
                          <div className={`adm-act-avatar ${statusConfig[st].className}`}>
                            {initialsFromEmail(row.email)}
                          </div>
                          <div className="adm-activity-content">
                            <p>{title}</p>
                            <span>{row.email}</span>
                            <span>{meta}</span>
                          </div>
                          <span className={`adm-status-pill ${cfg.className}`}>{cfg.label}</span>
                        </div>
                      );
                    })}
                    {candidateRows.length === 0 ? (
                      <div className="adm-activity-item">
                        <div className="adm-act-dot away" />
                        <div>
                          <p>No activity yet</p>
                          <span>Start by sending your first invite.</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>Needs attention</p>
                    <span>Follow-up queue</span>
                  </div>
                  <div className="adm-activity-list">
                    {needsAttentionRows.map((row) => (
                      <div className="adm-activity-item" key={`need-${row.email}`}>
                        <div className="adm-act-dot away" />
                        <div className="adm-activity-content">
                          <p>{row.candidateName || row.email}</p>
                          <span>{row.reason}</span>
                          <span>{row.email}</span>
                        </div>
                        <span className="adm-status-pill away">Pending</span>
                      </div>
                    ))}
                    {needsAttentionRows.length === 0 ? (
                      <div className="adm-activity-item">
                        <div className="adm-act-dot live" />
                        <div className="adm-activity-content">
                          <p>All clear</p>
                          <span>No pending candidates need immediate follow-up.</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>Invites this week</p>
                    <span>Daily activity</span>
                  </div>
                  <div className="adm-week-chart">
                    {weeklyInvites.map((item) => {
                      const h = Math.max(8, Math.round((item.val / weeklyMax) * 58));
                      return (
                        <div className="adm-week-col" key={item.day}>
                          <div className="adm-week-bar-wrap">
                            <div className="adm-week-bar-hit">
                              <div
                                className="adm-week-bar"
                                style={{ height: `${h}px`, opacity: item.val > 0 ? 1 : 0.35 }}
                              />
                              <div className="adm-week-tooltip">
                                {item.day}: {item.val} invite{item.val === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                          <span>{item.day}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="adm-week-meta">
                    <span>Invited (7d): {recentWeekInvited}</span>
                    <span>Completed (7d): {recentWeekCompleted}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : activeTab === "candidates" ? (
          <>
            <div className="adm-stats-grid">
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${candidateListFilter === "all" ? "active" : ""}`}
                onClick={() => onCandidateFilterChange("all")}
              >
                <div className="adm-stat-label">Invited candidates</div>
                <div className="adm-stat-val">{candidateTotals.invited}</div>
              </button>
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${candidateListFilter === "completed" ? "active" : ""}`}
                onClick={() => onCandidateFilterChange("completed")}
              >
                <div className="adm-stat-label">Attended</div>
                <div className="adm-stat-val">{candidateTotals.attended}</div>
              </button>
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${candidateListFilter === "pending" ? "active" : ""}`}
                onClick={() => onCandidateFilterChange("pending")}
              >
                <div className="adm-stat-label">Pending</div>
                <div className="adm-stat-val">{candidateTotals.pending}</div>
              </button>
            </div>
            <div className="adm-stats-grid">
              <div className="adm-stat-card">
                <div className="adm-stat-label">Average presence</div>
                <div className="adm-stat-val">{dashboardMetrics.avgPresencePct}%</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Avg training time</div>
                <div className="adm-stat-val">{formatMinutes(dashboardMetrics.avgTrainingMinutes)} min</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Live now</div>
                <div className="adm-stat-val">{dashboardMetrics.liveNow}</div>
              </div>
              <div className="adm-stat-card">
                <div className="adm-stat-label">Needs follow-up</div>
                <div className="adm-stat-val">{dashboardMetrics.stalePending}</div>
              </div>
            </div>

            {candidateError ? <p className="error-note">{candidateError}</p> : null}
            <div className="adm-content-row adm-candidates-layout">
              <div className="adm-card">
                <div className="adm-card-header">
                  <p>Invited candidates</p>
                  <span>{candidateLoading ? "Refreshing..." : `Showing ${filteredCandidateRows.length} candidates`}</span>
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
                    {filteredCandidateRows.map((row) => (
                      <tr
                        key={row.email}
                        onClick={() => onSelectCandidate(row.email)}
                        className={`adm-click-row ${selectedCandidate?.email === row.email ? "is-selected" : ""}`}
                      >
                        <td>
                          <div className="adm-candidate-cell">
                            <div className="adm-cand-avatar">{initialsFromEmail(row.email)}</div>
                            <div>
                              <div className="adm-cand-name">{row.candidateName || row.email}</div>
                              <div className="adm-cand-sub">
                                {row.email} · Invited by {row.invitedBy || "admin"}
                              </div>
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
                    {!candidateLoading && filteredCandidateRows.length === 0 ? (
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
                    <span>
                      {selectedCandidate
                        ? `${selectedCandidate.candidateName || selectedCandidate.email} · ${selectedCandidate.email}`
                        : "Select a candidate row"}
                    </span>
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
                        <span>Total Training (min)</span>
                        <b>{formatMinutes(selectedCandidate?.insights?.totalTrainingMinutes || 0)}</b>
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
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${dashboardListFilter === "all" ? "active" : ""}`}
                onClick={() => onDashboardFilterChange("all")}
              >
                <div className="adm-stat-label">Invited candidates</div>
                <div className="adm-stat-val">{dashboardMetrics.invited}</div>
              </button>
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${dashboardListFilter === "started" ? "active" : ""}`}
                onClick={() => onDashboardFilterChange("started")}
              >
                <div className="adm-stat-label">Started training</div>
                <div className="adm-stat-val">{dashboardMetrics.started}</div>
              </button>
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${dashboardListFilter === "completed" ? "active" : ""}`}
                onClick={() => onDashboardFilterChange("completed")}
              >
                <div className="adm-stat-label">Completed training</div>
                <div className="adm-stat-val">{dashboardMetrics.completed}</div>
              </button>
              <button
                type="button"
                className={`adm-stat-card adm-stat-click ${dashboardListFilter === "pending" ? "active" : ""}`}
                onClick={() => onDashboardFilterChange("pending")}
              >
                <div className="adm-stat-label">Candidates pending</div>
                <div className="adm-stat-val">{dashboardMetrics.pending}</div>
              </button>
            </div>
            <div className="adm-charts-top-row">
              <div className="adm-card adm-card-compact">
                <div className="adm-card-header">
                  <p>Completion Trend (30d)</p>
                  <span>Daily completions</span>
                </div>
                <div className="adm-chart-wrap">
                  <svg viewBox="0 0 320 130" className="adm-line-chart">
                    <polyline
                      fill="none"
                      stroke="#534ab7"
                      strokeWidth="2"
                      points={completionTrend
                        .map((p, idx) => {
                          const x = (idx / Math.max(1, completionTrend.length - 1)) * 300 + 10;
                          const y = 110 - (p.value / completionTrendMax) * 90;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  </svg>
                  <div className="adm-chart-meta">
                    <span>Last 30 days</span>
                    <span>Total: {completionTrend.reduce((sum, p) => sum + p.value, 0)}</span>
                  </div>
                </div>
              </div>
              <div className="adm-card adm-card-compact">
                <div className="adm-card-header">
                  <p>Pipeline Funnel</p>
                  <span>Candidate flow</span>
                </div>
                <div className="adm-mini-bars">
                  {funnelData.map((item) => (
                    <div className="adm-mini-bar-row" key={item.label}>
                      <span>{item.label}</span>
                      <div className="adm-mini-bar-track">
                        <div
                          className="adm-mini-bar-fill"
                          style={{ width: `${Math.round((item.value / funnelMax) * 100)}%` }}
                        />
                      </div>
                      <b>{item.value}</b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="adm-card adm-card-compact">
                <div className="adm-card-header">
                  <p>Pending Aging</p>
                  <span>Line trend by age bucket</span>
                </div>
                <div className="adm-chart-wrap">
                  <svg
                    viewBox="0 0 320 130"
                    className="adm-line-chart"
                    onMouseLeave={() => setAgingTooltip(null)}
                  >
                    <polyline
                      fill="none"
                      stroke="#ef9f27"
                      strokeWidth="2"
                      points={pendingAging
                        .map((bucket, idx) => {
                          const x = (idx / Math.max(1, pendingAging.length - 1)) * 300 + 10;
                          const y = 110 - (bucket.count / pendingAgingMax) * 90;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                    {pendingAging.map((bucket, idx) => {
                      const x = (idx / Math.max(1, pendingAging.length - 1)) * 300 + 10;
                      const y = 110 - (bucket.count / pendingAgingMax) * 90;
                      return (
                        <circle
                          key={`aging-point-${bucket.label}`}
                          cx={x}
                          cy={y}
                          r="5"
                          fill="#ef9f27"
                          onMouseEnter={() =>
                            setAgingTooltip({
                              left: `${clamp((x / 320) * 100, 12, 88)}%`,
                              top: `${clamp((y / 130) * 100, 14, 92)}%`,
                              place: y < 30 ? "below" : "above",
                              text: `${bucket.label}: ${bucket.count}`,
                            })
                          }
                        />
                      );
                    })}
                  </svg>
                  {agingTooltip ? (
                    <div
                      className={`adm-inline-tooltip ${agingTooltip.place === "below" ? "below" : ""}`}
                      style={{ left: agingTooltip.left, top: agingTooltip.top }}
                    >
                      {agingTooltip.text}
                    </div>
                  ) : null}
                  <div className="adm-chart-axis">
                    {pendingAging.map((bucket) => (
                      <span key={`aging-label-${bucket.label}`}>{bucket.label}</span>
                    ))}
                  </div>
                  <div className="adm-chart-meta">
                    <span>Pending buckets</span>
                    <span>Total: {pendingAging.reduce((sum, b) => sum + b.count, 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {adminError ? <p className="error-note">{adminError}</p> : null}
            <div className="adm-content-row">
              <div className="adm-card">
                <div className="adm-card-header">
                  <p>Candidate attendance</p>
                  <span>
                    {adminLoading
                      ? "Refreshing..."
                      : `${filteredDashboardRows.length} candidates · ${
                          dashboardListFilter === "completed"
                            ? "Attended"
                            : dashboardListFilter === "pending"
                              ? "Pending"
                              : dashboardListFilter === "invited"
                                ? "Invited"
                                : "All"
                        }`}
                  </span>
                </div>
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Status</th>
                      <th>Live Time (min)</th>
                      <th>Offline Time (min)</th>
                      <th>Total Training (min)</th>
                      <th>Presence %</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDashboardRows.map((row) => (
                      <tr key={row.userId || row._id}>
                        {(() => {
                          const liveMinutes = Number(row?.insights?.presentMinutes || 0);
                          const awayMinutes = Number(row?.insights?.awayMinutes || 0);
                          const totalMinutes = Number(row?.insights?.totalTrainingMinutes || 0);
                          const presencePct =
                            totalMinutes > 0 ? Number(((liveMinutes / totalMinutes) * 100).toFixed(1)) : 0;
                          const isLiveNow = Boolean(row?.insights?.currentlyDetected);
                          const hadLiveTime = liveMinutes > 0;
                          const statusClass = row.completed
                            ? "live"
                            : isLiveNow || hadLiveTime
                              ? "live"
                              : "away";
                          const statusLabel = isLiveNow
                            ? "Live now"
                            : row.completed
                              ? "Completed"
                              : hadLiveTime
                                ? "In progress"
                                : "No data";
                          return (
                            <>
                        <td>
                          <div className="adm-candidate-cell">
                            <div className="adm-cand-avatar">{initialsFromEmail(row.email || row.userId)}</div>
                            <div>
                              <div className="adm-cand-name">
                                {row.candidateName || row.email || row.userId || "unknown"}
                              </div>
                              <div className="adm-cand-sub">{row.note || "No note"}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`adm-status-pill ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>{formatMinutes(row?.insights?.presentMinutes)}</td>
                        <td>{formatMinutes(awayMinutes)}</td>
                        <td>{formatMinutes(row?.insights?.totalTrainingMinutes)}</td>
                        <td>{totalMinutes > 0 ? `${presencePct}%` : "-"}</td>
                        <td>{formatAgo(row.updatedAt)}</td>
                            </>
                          );
                        })()}
                      </tr>
                    ))}
                    {!adminLoading && filteredDashboardRows.length === 0 ? (
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
                    <p>Training overview</p>
                    <span>Bar chart</span>
                  </div>
                  <div className="adm-chart-wrap">
                    <svg
                      viewBox="0 0 320 150"
                      className="adm-bar-chart"
                      onMouseLeave={() => setOverviewTooltip(null)}
                    >
                      {trainingOverviewBars.map((item, idx) => {
                        const x = 28 + idx * 72;
                        const h = (item.value / Math.max(1, dashboardMetrics.invited)) * 92;
                        const y = 112 - h;
                        const barClass = item.tone === "warn" ? "adm-bar warn" : "adm-bar";
                        return (
                          <g key={`overview-bar-${item.label}`}>
                            <rect
                              x={x}
                              y={y}
                              width="40"
                              height={h}
                              rx="6"
                              className={barClass}
                              onMouseEnter={() =>
                                setOverviewTooltip({
                                  left: `${clamp(((x + 20) / 320) * 100, 12, 88)}%`,
                                  top: `${clamp((y / 150) * 100, 14, 92)}%`,
                                  place: y < 32 ? "below" : "above",
                                  text: `${item.label}: ${item.value}`,
                                })
                              }
                            />
                            <text x={x + 20} y="126" textAnchor="middle" className="adm-bar-label">
                              {item.label}
                            </text>
                            <text x={x + 20} y={y - 4} textAnchor="middle" className="adm-bar-value">
                              {item.value}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    {overviewTooltip ? (
                      <div
                        className={`adm-inline-tooltip ${overviewTooltip.place === "below" ? "below" : ""}`}
                        style={{ left: overviewTooltip.left, top: overviewTooltip.top }}
                      >
                        {overviewTooltip.text}
                      </div>
                    ) : null}
                  </div>
                  <div className="adm-chart-meta">
                    <span>Completion rate</span>
                    <span>
                      {dashboardMetrics.invited
                        ? `${Math.round((dashboardMetrics.completed / dashboardMetrics.invited) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>Action center</p>
                    <span>Priority follow-ups</span>
                  </div>
                  <div className="adm-activity-list">
                    {filteredDashboardRows
                      .filter((row) => !row.completed)
                      .slice(0, 4)
                      .map((row) => (
                        <div className="adm-activity-item" key={`todo-${row.email || row.userId}`}>
                          <div className={`adm-act-dot ${row?.insights?.currentlyDetected ? "live" : "away"}`} />
                          <div className="adm-activity-content">
                            <p>{row.candidateName || row.email || row.userId || "Candidate"}</p>
                            <span>{row.completed ? "Completed" : "Pending completion"}</span>
                            <span>{formatAgo(row.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    {filteredDashboardRows.filter((row) => !row.completed).length === 0 ? (
                      <div className="adm-activity-item">
                        <div className="adm-act-dot live" />
                        <div className="adm-activity-content">
                          <p>All candidates completed</p>
                          <span>No immediate follow-up needed.</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-header">
                    <p>Live activity</p>
                    <span>Latest updates</span>
                  </div>
                  <div className="adm-activity-list">
                    {filteredDashboardRows.slice(0, 5).map((row) => (
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
                    {!adminLoading && filteredDashboardRows.length === 0 ? (
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
