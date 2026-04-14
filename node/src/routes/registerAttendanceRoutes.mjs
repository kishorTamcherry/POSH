import { buildAttendanceInsights } from "../services/attendanceInsights.mjs";

export function registerAttendanceRoutes(app, deps) {
  const { CameraAttendance, verifyHttpAuth, verifyAdminAuth } = deps;

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
}
