import jwt from "jsonwebtoken";

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

async function sendOtpMail(transporter, emailUser, email, otp, otpExpiryMinutes) {
  await transporter.sendMail({
    from: `"Posh AI" <${emailUser}>`,
    to: email,
    subject: "Your Posh AI OTP code",
    text: `Your OTP for login is: ${otp}`,
    html: otpTemplate(otp, otpExpiryMinutes),
  });
}

function buildDemoAiReply(userText) {
  const cleaned = userText.trim();
  return `Welcome to Posh assistant. I heard: "${cleaned}". In the next step we can wire GPT-4o mini streaming plus Deepgram STT/TTS and Beyond Presence avatar playback.`;
}

export function registerAuthRoutes(app, deps) {
  const {
    User,
    jwtSecret,
    otpExpiryMinutes,
    adminEmail,
    adminPassword,
    transporter,
    emailUser,
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

  app.post("/ai/respond", (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: "message is required." });
    }
    return res.json({ reply: buildDemoAiReply(message) });
  });
}
