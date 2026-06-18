import StylistBooking from '../Models/StylistBooking.js';

// ==================== GET STYLIST BOOKINGS ====================

export const getStylistBookings = async (req, res) => {
  try {
    const { stylistId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { stylistId };
    if (status && ['pending', 'accepted', 'rejected', 'cancelled', 'completed'].includes(status)) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await StylistBooking.find(query)
      .populate('userId', 'name email mobile profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StylistBooking.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      stylistBookings: bookings
    });

  } catch (error) {
    console.error('getStylistBookings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ACCEPT STYLIST BOOKING ====================

export const acceptStylistBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await StylistBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Stylist booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept booking with status: ${booking.status}`
      });
    }

    booking.status = 'accepted';
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Stylist booking accepted successfully. This booking is now locked.',
      data: booking
    });

  } catch (error) {
    console.error('acceptStylistBooking error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REJECT STYLIST BOOKING ====================

export const rejectStylistBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const booking = await StylistBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Stylist booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject booking with status: ${booking.status}`
      });
    }

    booking.status = 'rejected';
    booking.rejectionReason = rejectionReason;
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Stylist booking rejected successfully',
      data: booking
    });

  } catch (error) {
    console.error('rejectStylistBooking error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== COMPLETE STYLIST BOOKING ====================

export const completeStylistBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await StylistBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Stylist booking not found' });
    }

    if (booking.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: `Only accepted bookings can be completed. Current status: ${booking.status}`
      });
    }

    booking.status = 'completed';
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Stylist booking completed successfully',
      data: booking
    });

  } catch (error) {
    console.error('completeStylistBooking error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};