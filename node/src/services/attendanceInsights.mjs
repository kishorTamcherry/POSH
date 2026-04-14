export function buildAttendanceInsights(record) {
  const samples = Array.isArray(record?.samples) ? [...record.samples] : [];
  samples.sort((a, b) => new Date(a?.at || 0).getTime() - new Date(b?.at || 0).getTime());
  const nowMs = Date.now();
  const maxTailMs = 10_000;

  let totalPresentMs = 0;
  let totalAwayMs = 0;
  let firstSampleAt = null;
  let lastSeenAt = null;
  let lastOutAt = null;
  let outSince = null;

  const isPresentSample = (sample) => Boolean(sample?.personDetected) || sample?.status === "present";

  for (let i = 0; i < samples.length; i += 1) {
    const current = samples[i];
    const currentMs = new Date(current?.at || 0).getTime();
    if (!Number.isFinite(currentMs)) continue;
    if (firstSampleAt === null) firstSampleAt = new Date(currentMs).toISOString();

    const next = samples[i + 1];
    const nextMsRaw = next ? new Date(next?.at || 0).getTime() : nowMs;
    const nextMs = Number.isFinite(nextMsRaw) ? nextMsRaw : currentMs;
    const rawDelta = Math.max(0, nextMs - currentMs);
    const deltaMs = next ? rawDelta : Math.min(rawDelta, maxTailMs);

    if (isPresentSample(current)) {
      totalPresentMs += deltaMs;
      lastSeenAt = new Date(currentMs).toISOString();
    } else {
      totalAwayMs += deltaMs;
      lastOutAt = new Date(currentMs).toISOString();
    }
  }

  const currentlyDetected = Boolean(record?.personDetected) || record?.status === "present";
  if (!currentlyDetected && samples.length > 0) {
    for (let i = samples.length - 1; i >= 0; i -= 1) {
      if (!isPresentSample(samples[i])) {
        const ts = new Date(samples[i]?.at || 0).getTime();
        if (Number.isFinite(ts)) {
          outSince = new Date(ts).toISOString();
        }
        break;
      }
    }
  }

  return {
    sampleCount: samples.length,
    firstSampleAt,
    currentlyDetected,
    lastSeenAt,
    lastOutAt,
    outSince,
    totalPresentMs,
    totalAwayMs,
    presentMinutes: Number((totalPresentMs / 60000).toFixed(1)),
    awayMinutes: Number((totalAwayMs / 60000).toFixed(1)),
  };
}
