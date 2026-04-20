import express from "express";
import { registerAdmin, loginAdmin, getAllUsers, updateUser, deleteUser, getAdminProfile, createBanner, getAllBanners, deleteBanner, updateBanner, createCategory, getAllCategories, updateCategory, deleteCategory, setPriceConfig, getPriceConfig, updatePriceConfig, deletePriceConfig, assignStylist } from "../Controller/adminController.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

router.get("/allusers", getAllUsers);
router.put("/updateusers/:id", updateUser);
router.delete("/deleteusers/:id", deleteUser);


router.get("/getprofile/:adminId", getAdminProfile);

router.post("/createbanner", createBanner);
router.get("/getallbanner", getAllBanners);
router.delete("/deletebanner/:bannerId", deleteBanner);
router.put("/updatebanner/:bannerId", updateBanner);

router.post("/createcategory", createCategory);
router.get("/allcategories", getAllCategories);
router.put("/updatecategory/:categoryId", updateCategory);
router.delete("/deletecategory/:categoryId", deleteCategory);


router.post("/setprice-config", setPriceConfig);
router.get("/allprice-config", getPriceConfig);
router.put("/updateprice-config", updatePriceConfig);
router.delete("/deleteprice-config", deletePriceConfig);
router.put("/assign-stylist/:bookingId", assignStylist);


export default router;
