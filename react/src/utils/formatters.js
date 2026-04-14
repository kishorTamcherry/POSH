export function formatAgo(input) {
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

export function formatMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(1);
}

export function initialsFromEmail(email) {
  const base = String(email || "").split("@")[0] || "NA";
  const parts = base.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}
