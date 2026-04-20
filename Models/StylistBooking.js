import mongoose from "mongoose";

const stylistBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    assignedStylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // ✅ admin will assign later
    },

    name: String,
    mobile: String,
    location: String,
    reasonForBooking: String,
    date: String,
    fromTime: String,
    toTime: String,

    amount: {
      type: Number,
    },

    status: {
      type: String,
      default: "pending",
    },

    paymentStatus: {
      type: String,
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

const StylistBooking = mongoose.model("StylistBooking", stylistBookingSchema);

export default StylistBooking;