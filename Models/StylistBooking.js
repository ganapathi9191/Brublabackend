// Models/StylistBooking.js - UPDATED
import mongoose from "mongoose";

const stylistBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    stylistId: {  
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    mobile: {
      type: String,
      required: true
    },
    location: {
      type: String,
      required: true
    },
    reasonForBooking: {
      type: String,
      required: true
    },
    date: {
      type: String,
      required: true
    },
    fromTime: {
      type: String,
      required: true
    },
    toTime: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    },
    bookedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const StylistBooking = mongoose.model("StylistBooking", stylistBookingSchema);
export default StylistBooking;