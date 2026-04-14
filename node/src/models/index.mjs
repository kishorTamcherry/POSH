import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const cameraAttendanceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    roomName: { type: String, default: null },
    status: {
      type: String,
      enum: ["present", "away", "checking", "error"],
      required: true,
    },
    note: { type: String, default: "" },
    cameraOn: { type: Boolean, default: false },
    avatarReady: { type: Boolean, default: false },
    personDetected: { type: Boolean, default: false },
    clientTs: { type: Date, default: null },
    samples: [
      {
        at: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["present", "away", "checking", "error"],
          required: true,
        },
        note: { type: String, default: "" },
        cameraOn: { type: Boolean, default: false },
        avatarReady: { type: Boolean, default: false },
        personDetected: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
export const CameraAttendance = mongoose.model("CameraAttendance", cameraAttendanceSchema);
