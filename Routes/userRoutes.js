import express from 'express';
import { 
    registerUser,
     createProfile, 
     editProfileImage, 
     getProfile,
     verifyMobile,
     resetPassword,
     deleteAccount,
     deleteUserAccount,
     confirmDeleteAccount,
     updateUser,
     sendOtp,
     verifyOtp,
     getUserById,
     resendOtp,
     loginUser,
     createDesignerProfile,
     getAllDesigners,
     getWishlist,
     toggleWishlist,
     getAllNotifications,
     deleteNotifications,
     bookStylist,
     getMyStylistBookings,
    } from '../Controller/UserController.js'; // Import UserController
const router = express.Router();

// Registration Route
router.post('/register', registerUser);

router.post('/login', loginUser);

// 📲 Step 1: Send OTP
router.post("/send-otp", sendOtp);


router.post("/resend-otp", resendOtp);

// 🔐 Step 2: Verify OTP
router.post("/verify-otp", verifyOtp);

// Login Route
// Get user details (GET)
router.put('/update-user/:userId', updateUser); 

// Update user details (PUT)
// Create a new profile with Form Data (including profile image)
router.post('/create-profile/:userId', createProfile);  // Profile creation with userId in params

// Edit the user profile by userId
router.put('/edit-profile/:id', editProfileImage);  // Profile editing by userId

// Get the user profile by userId
router.get('/get-profile/:id', getProfile);  // Get profile by userId
router.post('/verify', verifyMobile);  // Get profile by userId
router.post('/reset-password', resetPassword);  // Get profile by userId
router.delete('/deleteuser/:userId', deleteUserAccount);  
router.post('/deleteaccount', deleteAccount)
router.get('/confirm-delete-account/:token', confirmDeleteAccount);

router.get('/myprofile/:userId', getUserById); 
router.post("/createdesigner-profile/:userId", createDesignerProfile);

router.get("/alllatestdesigners", getAllDesigners);

router.post("/addwishlist/:userId/:designerId", toggleWishlist);
router.get("/mywishlist/:userId", getWishlist);

router.get("/allnotifications/:userId", getAllNotifications);
router.delete("/deletenotifications/:userId", deleteNotifications);
router.post("/book-stylist", bookStylist);

router.get("/my-stylistbookings/:userId", getMyStylistBookings);













export default router;
