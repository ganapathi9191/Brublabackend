import mongoose from "mongoose";

const priceConfigSchema = new mongoose.Schema(
  {
    tailorBookingPrice: {
      type: Number,
      default: 0,
    },
    stylistBookingPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const PriceConfig = mongoose.model("PriceConfig", priceConfigSchema);

export default PriceConfig;