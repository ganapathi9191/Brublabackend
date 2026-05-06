import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDatabase from './db/connectDatabase.js';
import path from 'path'; // Import path to work with file and directory paths
import UserRoutes from './Routes/userRoutes.js'
import { fileURLToPath } from 'url';  // Import the fileURLToPath method
import cloudinary from './config/cloudinary.js';
import fileUpload from 'express-fileupload';
import adminRoutes from "./Routes/adminRoutes.js"
import dns from "dns";   // 👈 ADD THIS
import fs from "fs";


// 👇 ADD THIS RIGHT HERE
dns.setServers([
  "8.8.8.8",
  "8.8.4.4"
]);
dotenv.config();

const app = express();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ✅ Serve static files from /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync("uploads/banners")) {
  fs.mkdirSync("uploads/banners", { recursive: true });
}


if (!fs.existsSync("uploads/colleges")) {
  fs.mkdirSync("uploads/colleges", { recursive: true });
}


if (!fs.existsSync("uploads/profile")) {
  fs.mkdirSync("uploads/profile", { recursive: true });
}

app.use(cors({
  origin: ['http://localhost:3000', 'http://31.97.206.144:7686', 'https://vidya-enrolldeleteurl.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.options('*', cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Database connection
connectDatabase();


// Middleware to handle file uploads
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/', // Temporary directory to store files before upload
}));

// Default route
app.get("/", (req, res) => {
    res.json({
        status: "success",    // A key to indicate the response status
        message: "Welcome to our service!", // Static message
    });
});



// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Serve frontend static files (HTML, JS, CSS)


// Create HTTP server with Express app
const server = http.createServer(app);

app.use('/api/users', UserRoutes);
app.use('/api/admin', adminRoutes);



const port = process.env.PORT || 6063;

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

