import jwt from "jsonwebtoken";
import { buildAttendanceInsights } from "../services/attendanceInsights.mjs";

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpTemplate(otp, otpExpiryMinutes) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">Posh AI Login OTP</h2>
      <p style="margin-top: 0;">Use this one-time code to log in. It is valid for ${otpExpiryMinutes} minute(s).</p>
      <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; background: #f3f4f6; padding: 12px 16px; border-radius: 8px; display: inline-block;">
        ${otp}
      </div>
      <p style="margin-top: 18px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  `;
}

function invitationTemplate(candidateName, candidateEmail, inviteUrl) {
  const safeName = String(candidateName || "").trim();
  const greeting = safeName ? `Dear ${safeName},` : "Hello,";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">POSH Training Invitation</h2>
      <p style="margin-top: 0;">${greeting}</p>
      <p style="margin-top: 0;">You have been invited to attend the POSH awareness training session.</p>
      <p>Please use the link below to access your training portal:</p>
      <p style="margin: 18px 0;">
        <a href="${inviteUrl}" style="display: inline-block; background: #1a1a2e; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">
          Open POSH Training
        </a>
      </p>
      <p style="font-size: 14px; color: #4b5563;">Candidate email: <strong>${candidateEmail}</strong></p>
      <p style="font-size: 13px; color: #6b7280;">If you were not expecting this invite, please ignore this email.</p>
    </div>
  `;
}

async function sendOtpMail(transporter, emailUser, email, otp, otpExpiryMinutes) {
  await transporter.sendMail({
    from: `"Posh AI" <${emailUser}>`,
    to: email,
    subject: "Your Posh AI OTP code",
    text: `Your OTP for login is: ${otp}`,
    html: otpTemplate(otp, otpExpiryMinutes),
  });
}

async function sendInvitationMail(transporter, emailUser, candidateName, candidateEmail, inviteUrl) {
  await transporter.sendMail({
    from: `"POSH Trainer" <${emailUser}>`,
    to: candidateEmail,
    subject: "Invitation to POSH training session",
    text: `You are invited to join POSH training. Open this link: ${inviteUrl}`,
    html: invitationTemplate(candidateName, candidateEmail, inviteUrl),
  });
}

function buildDemoAiReply(userText) {
  const cleaned = userText.trim();
  return `Welcome to Posh assistant. I heard: "${cleaned}". In the next step we can wire GPT-4o mini streaming plus Deepgram STT/TTS and Beyond Presence avatar playback.`;
}

export function registerAuthRoutes(app, deps) {
  const {
    User,
    CameraAttendance,
    CandidateInvitation,
    jwtSecret,
    otpExpiryMinutes,
    adminEmail,
    adminPassword,
    verifyAdminAuth,
    transporter,
    emailUser,
    candidateAppUrl,
  } = deps;

  app.post("/auth/login", async (req, res) => {
    const { email, otp } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let userRecord = await User.findOne({ email: normalizedEmail });

    if (!otp) {
      const generatedOtp = generateOtp();
      const otpExpires = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

      if (!userRecord) {
        const inferredName = normalizedEmail.split("@")[0] || "Posh User";
        userRecord = await User.create({
          name: inferredName,
          email: normalizedEmail,
          otp: generatedOtp,
          otpExpires,
          isVerified: false,
        });
      } else {
        userRecord.otp = generatedOtp;
        userRecord.otpExpires = otpExpires;
        await userRecord.save();
      }

      try {
        await sendOtpMail(transporter, emailUser, normalizedEmail, generatedOtp, otpExpiryMinutes);
      } catch (error) {
        return res.status(500).json({ message: "Failed to send OTP email.", error: error.message });
      }

      return res.json({
        message: "OTP sent successfully to your email",
        requiresOtp: true,
      });
    }

    if (!userRecord) {
      return res.status(400).json({ message: "Email not registered with us" });
    }
    if (!userRecord.otp || userRecord.otp !== otp) {
      return res.status(400).json({ message: "Incorrect OTP. Try again" });
    }
    if (!userRecord.otpExpires || new Date() > userRecord.otpExpires) {
      return res.status(409).json({ message: "Code timed out. Resend OTP" });
    }

    const user = { id: userRecord.id, name: userRecord.name, email: userRecord.email };
    const token = jwt.sign({ sub: user.id, email: user.email, name: user.name, role: "candidate" }, jwtSecret, {
      expiresIn: "8h",
    });

    userRecord.isVerified = true;
    userRecord.otp = null;
    userRecord.otpExpires = null;
    await userRecord.save();

    return res.json({ token, user });
  });

  app.post("/admin/login", async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const token = jwt.sign(
      { sub: `admin:${email}`, email, name: "Admin", role: "admin" },
      jwtSecret,
      { expiresIn: "8h" },
    );
    return res.json({
      token,
      admin: { email, role: "admin" },
    });
  });

  app.post("/admin/invitations", verifyAdminAuth, async (req, res) => {
    const candidateName = String(req.body?.name || "").trim();
    const candidateEmail = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!candidateName) {
      return res.status(400).json({ message: "Candidate name is required." });
    }
    if (!candidateEmail) {
      return res.status(400).json({ message: "Candidate email is required." });
    }
    if (!candidateEmail.includes("@")) {
      return res.status(400).json({ message: "Candidate email is invalid." });
    }

    const inviteUrl = String(candidateAppUrl || "").trim() || "http://localhost:5173";
    try {
      await CandidateInvitation.updateOne(
        { email: candidateEmail },
        {
          $set: {
            candidateName,
            email: candidateEmail,
            invitedBy: req.user?.email || "admin",
            lastInvitedAt: new Date(),
          },
          $setOnInsert: {
            firstInvitedAt: new Date(),
          },
          $inc: {
            inviteCount: 1,
          },
        },
        { upsert: true },
      );
      await sendInvitationMail(transporter, emailUser, candidateName, candidateEmail, inviteUrl);
      return res.json({ message: `Invitation sent to ${candidateEmail}.` });
    } catch (error) {
      return res.status(500).json({ message: "Failed to send invitation email.", error: error.message });
    }
  });

  app.get("/admin/candidates/invited", verifyAdminAuth, async (req, res) => {
    try {
      const inviteRecords = await CandidateInvitation.find({}).sort({ lastInvitedAt: -1 }).lean();
      const attendanceRecords = await CameraAttendance.find({}).lean();
      const userRecords = await User.find({}, { email: 1, name: 1 }).lean();

      const attendanceByEmail = new Map(
        attendanceRecords
          .filter((row) => row?.email)
          .map((row) => [String(row.email).toLowerCase(), row]),
      );
      const inviteByEmail = new Map(
        inviteRecords
          .filter((row) => row?.email)
          .map((row) => [String(row.email).toLowerCase(), row]),
      );
      const userByEmail = new Map(
        userRecords
          .filter((row) => row?.email)
          .map((row) => [String(row.email).toLowerCase(), String(row.name || "").trim()]),
      );

      const allEmails = new Set([
        ...inviteByEmail.keys(),
        ...attendanceByEmail.keys(),
      ]);

      const records = Array.from(allEmails).map((email) => {
        const row = inviteByEmail.get(email) || null;
        const attendance = attendanceByEmail.get(email) || null;
        const insights = attendance ? buildAttendanceInsights(attendance) : null;
        const candidateName =
          String(row?.candidateName || "").trim() ||
          String(userByEmail.get(email) || "").trim();
        return {
          candidateName,
          email,
          invitedBy: row?.invitedBy || "system:auto",
          inviteCount: Number(row?.inviteCount || 0),
          firstInvitedAt: row?.firstInvitedAt || row?.createdAt || attendance?.createdAt || null,
          lastInvitedAt: row?.lastInvitedAt || row?.updatedAt || attendance?.updatedAt || null,
          attended: Boolean(row?.trainingCompleted),
          trainingCompleted: Boolean(row?.trainingCompleted),
          completedAt: row?.completedAt || null,
          attendanceStatus: attendance?.status || "not-started",
          lastAttendedAt: attendance?.updatedAt || null,
          attendanceNote: attendance?.note || "",
          attendanceUpdatedAt: attendance?.updatedAt || null,
          insights: insights
            ? {
                currentlyDetected: Boolean(insights.currentlyDetected),
                outSince: insights.outSince || null,
                lastSeenAt: insights.lastSeenAt || null,
                presentMinutes: Number(insights.presentMinutes || 0),
                awayMinutes: Number(insights.awayMinutes || 0),
                totalTrainingMinutes: Number(insights.totalTrainingMinutes || 0),
              }
            : null,
        };
      });
      records.sort((a, b) => new Date(b.lastInvitedAt || 0).getTime() - new Date(a.lastInvitedAt || 0).getTime());

      const totals = {
        invited: records.length,
        attended: records.filter((row) => row.trainingCompleted).length,
      };
      totals.pending = Math.max(0, totals.invited - totals.attended);

      return res.json({ totals, records });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to load invited candidates." });
    }
  });

  app.post("/ai/respond", (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: "message is required." });
    }
    return res.json({ reply: buildDemoAiReply(message) });
  });
}
