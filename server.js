import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDatabase from './db/connectDatabase.js';
import path from 'path';
import UserRoutes from './Routes/userRoutes.js';
import { fileURLToPath } from 'url';
import adminRoutes from './Routes/adminRoutes.js';
import dns from 'dns';
import fs from 'fs';
import { createDefaultAdmin } from './utils/createAdmin.js';


dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




// ✅ Create upload directories
const dirs = ['uploads/banners', 'uploads/categories', 'uploads/profiles', 'uploads/misc'];
dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// ✅ Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://31.97.206.144:7686', 'https://vidya-enrolldeleteurl.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.options('*', cors());

// ✅ Body parsers — NO fileUpload middleware (multer handles files)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ✅ Database
connectDatabase();

// ✅ Default route
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'Welcome to our service!' });
});

// ✅ Routes
app.use('/api/users', UserRoutes);
app.use('/api/admin', adminRoutes);

// ✅ Server
const port = process.env.PORT || 4077;
const server = http.createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});