// routes/stylist/stylistBookingRoutes.js
import express from 'express';
import {
  getStylistBookings,
  acceptStylistBooking,
  rejectStylistBooking,
  completeStylistBooking
} from '../Controller/stylistController.js';

const router = express.Router();


// Get stylist's bookings
router.get('/:stylistId/stylist-bookings', getStylistBookings);

// Accept stylist booking
router.patch('/stylist-booking/:bookingId/accept', acceptStylistBooking);

// Reject stylist booking
router.patch('/stylist-booking/:bookingId/reject', rejectStylistBooking);

// Complete stylist booking
router.patch('/stylist-booking/:bookingId/complete', completeStylistBooking);

export default router;