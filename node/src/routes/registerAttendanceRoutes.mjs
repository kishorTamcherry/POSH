import { buildAttendanceInsights } from "../services/attendanceInsights.mjs";

export function registerAttendanceRoutes(app, deps) {
  const { CameraAttendance, CandidateInvitation, verifyHttpAuth, verifyAdminAuth } = deps;

  app.post("/attendance/camera", verifyHttpAuth, async (req, res) => {
    try {
      const {
        status = "checking",
        note = "",
        cameraOn = false,
        avatarReady = false,
        personDetected = false,
        roomName = null,
        clientTs = null,
      } = req.body || {};

      const allowedStatuses = new Set(["present", "away", "checking", "error"]);
      const safeStatus = allowedStatuses.has(status) ? status : "checking";
      const safeNote = typeof note === "string" ? note.slice(0, 240) : "";
      const safeRoomName = typeof roomName === "string" ? roomName : null;
      const safeClientTs = clientTs ? new Date(clientTs) : null;

      await CameraAttendance.updateOne(
        { userId: req.user.sub },
        {
          $set: {
            email: req.user.email,
            roomName: safeRoomName,
            status: safeStatus,
            note: safeNote,
            cameraOn: Boolean(cameraOn),
            avatarReady: Boolean(avatarReady),
            personDetected: Boolean(personDetected),
            clientTs: safeClientTs,
          },
          $push: {
            samples: {
              $each: [
                {
                  at: safeClientTs || new Date(),
                  status: safeStatus,
                  note: safeNote,
                  cameraOn: Boolean(cameraOn),
                  avatarReady: Boolean(avatarReady),
                  personDetected: Boolean(personDetected),
                },
              ],
              $slice: -500,
            },
          },
        },
        { upsert: true },
      );

      return res.json({ ok: true });
    } catch (error) {
      return res
        .status(500)
        .json({ message: error.message || "Failed to persist camera attendance." });
    }
  });

  app.get("/attendance/camera/latest", verifyAdminAuth, async (req, res) => {
    try {
      const parsedLimit = Number(req.query.limit || 50);
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 200)
        : 50;

      const records = await CameraAttendance.find({}).sort({ updatedAt: -1 }).limit(limit).lean();
      const enrichedRecords = records.map((record) => ({
        ...record,
        insights: buildAttendanceInsights(record),
      }));

      return res.json({
        count: enrichedRecords.length,
        records: enrichedRecords,
      });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to load camera attendance." });
    }
  });

  app.post("/attendance/completion", verifyHttpAuth, async (req, res) => {
    try {
      const email = String(req.user?.email || "")
        .trim()
        .toLowerCase();
      if (!email) {
        return res.status(400).json({ message: "User email missing in token." });
      }

      await CandidateInvitation.updateOne(
        { email },
        {
          $set: {
            email,
            trainingCompleted: true,
            completedAt: new Date(),
            lastInvitedAt: new Date(),
          },
          $setOnInsert: {
            invitedBy: "system:auto",
            firstInvitedAt: new Date(),
            inviteCount: 1,
          },
        },
        { upsert: true },
      );

      return res.json({ ok: true, message: "Training marked as completed." });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to mark completion." });
    }
  });
}
