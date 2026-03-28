const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const addressSchema = new mongoose.Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  country: { type: String, default: "" },
  email: { type: String, default: "" },
  street: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  suite: { type: String, default: "" },
  zip: { type: String, default: "" },
  phoneNumber: { type: String, required: true }, // Making phone number required
});
const UserSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phoneNumber: {
      type: Number,
      required: true,
    },
    // For Firebase-authenticated users, we won't store a password.
    password: {
      type: String,
      required: function requiredPassword() {
        // If firebaseUid is present, password is optional.
        return !this.firebaseUid;
      },
    },
    // Firebase UID for users authenticated via Firebase (e.g., phone OTP)
    firebaseUid: {
      type: String,
      index: true,
      sparse: true,
    },
    profileImageUrl: {
      type: String,
      default:
        "https://res.cloudinary.com/piyush27/image/upload/v1632215188/story/Group_113_rufkkn.png",
    },
    shippingAddress: addressSchema,
    isBlocked: {
      type: Boolean,
      required: true,
      default: false,
    },
      accountType: {
      type: String,
      default: "user",
    },
      cart: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User_Cart",
        default: null
      },
    coupon_applied: [],

    // ── PAN Verification (required for orders above ₹2,00,000) ──
    pan: {
      number: {
        type: String,
        uppercase: true,
        sparse: true,
        index: true,
      },
      nameAsOnPan: { type: String },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      // Response snapshot from verification provider for audit
      verificationResponse: { type: mongoose.Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);
mongoose.model("User", UserSchema);
module.exports = {User:mongoose.model("User")};