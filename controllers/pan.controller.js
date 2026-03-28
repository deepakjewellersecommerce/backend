const mongoose = require("mongoose");
const User = mongoose.model("User");
const catchAsync = require("../utility/catch-async");
const { errorRes, successRes } = require("../utility");
const PanService = require("../services/pan.service");

const HIGH_VALUE_THRESHOLD = 200000; // ₹2,00,000

// ── POST /user/pan/verify ─────────────────────────────────────────────────────
// Customer-facing. Verifies PAN and saves result to user record.
// Once verified, subsequent calls return the cached result immediately.
module.exports.verifyPan = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { panNumber, nameAsOnPan } = req.body;

  if (!panNumber || !nameAsOnPan) {
    return errorRes(res, 400, "panNumber and nameAsOnPan are required.");
  }

  const pan = panNumber.trim().toUpperCase();

  // ── Already verified — return cached result ──
  const user = await User.findById(userId).select("pan name");
  if (!user) return errorRes(res, 404, "User not found.");

  if (user.pan?.verified) {
    return successRes(res, {
      alreadyVerified: true,
      pan: {
        number: maskPan(user.pan.number),
        nameAsOnPan: user.pan.nameAsOnPan,
        verifiedAt: user.pan.verifiedAt,
      },
      message: "PAN is already verified.",
    });
  }

  // ── Check this PAN isn't registered to another user ──
  const existing = await User.findOne({
    "pan.number": pan,
    "pan.verified": true,
    _id: { $ne: userId },
  }).select("_id");

  if (existing) {
    return errorRes(res, 409, "This PAN is already linked to another account.");
  }

  // ── Call verification service ──
  const result = await PanService.verify(pan, nameAsOnPan);

  if (!result.verified) {
    // Save the attempt (unverified) so admin can see it; don't mark verified
    await User.findByIdAndUpdate(userId, {
      "pan.number": pan,
      "pan.nameAsOnPan": nameAsOnPan,
      "pan.verified": false,
      "pan.verificationResponse": result.raw,
    });

    return errorRes(res, 422, result.message);
  }

  // ── Save verified PAN ──
  await User.findByIdAndUpdate(userId, {
    "pan.number": pan,
    "pan.nameAsOnPan": result.name || nameAsOnPan,
    "pan.verified": true,
    "pan.verifiedAt": new Date(),
    "pan.verificationResponse": result.raw,
  });

  return successRes(res, {
    verified: true,
    pan: {
      number: maskPan(pan),
      nameAsOnPan: result.name || nameAsOnPan,
      verifiedAt: new Date(),
    },
    message: "PAN verified successfully.",
  });
});

// ── GET /user/pan/status ──────────────────────────────────────────────────────
// Customer-facing. Lets the frontend check PAN status before showing checkout.
module.exports.getPanStatus = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select("pan");
  if (!user) return errorRes(res, 404, "User not found.");

  const pan = user.pan ?? {};

  return successRes(res, {
    verified: pan.verified ?? false,
    required: true,               // frontend uses this to know the feature is active
    threshold: HIGH_VALUE_THRESHOLD,
    ...(pan.verified
      ? {
          pan: {
            number: maskPan(pan.number),
            nameAsOnPan: pan.nameAsOnPan,
            verifiedAt: pan.verifiedAt,
          },
        }
      : {}),
  });
});

// ── GET /admin/user/:userId/pan ───────────────────────────────────────────────
// Admin-facing. Shows full (masked) PAN status for a user.
module.exports.adminGetPanStatus = catchAsync(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return errorRes(res, 400, "Invalid user ID.");
  }

  const user = await User.findById(userId).select("pan name email");
  if (!user) return errorRes(res, 404, "User not found.");

  const pan = user.pan ?? {};

  return successRes(res, {
    userId,
    name: user.name,
    email: user.email,
    pan: {
      verified: pan.verified ?? false,
      number: pan.number ? maskPan(pan.number) : null,
      nameAsOnPan: pan.nameAsOnPan ?? null,
      verifiedAt: pan.verifiedAt ?? null,
    },
    threshold: HIGH_VALUE_THRESHOLD,
  });
});

// ── POST /admin/user/:userId/pan/reset ────────────────────────────────────────
// Admin-facing. Clears PAN so user can re-submit (e.g. if wrong PAN was saved).
module.exports.adminResetPan = catchAsync(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return errorRes(res, 400, "Invalid user ID.");
  }

  await User.findByIdAndUpdate(userId, {
    $unset: { pan: "" },
  });

  return successRes(res, { message: "PAN data cleared. User must re-verify." });
});

// ── Helper ────────────────────────────────────────────────────────────────────
// Shows ABCXX1234X — hides middle 2 letters + first 2 digits
function maskPan(pan = "") {
  if (pan.length !== 10) return pan;
  return `${pan.slice(0, 3)}XX${pan.slice(5, 8)}X`;
}

module.exports.HIGH_VALUE_THRESHOLD = HIGH_VALUE_THRESHOLD;
