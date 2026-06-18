import express from 'express';
import jwt from 'jsonwebtoken'; 
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDatabase from './db/connectDatabase.js';
import path from 'path';
import UserRoutes from './Routes/userRoutes.js';
import stylistRoutes from './Routes/stylistRoutes.js';
import { fileURLToPath } from 'url';
import adminRoutes from './Routes/adminRoutes.js';
import designerRoutes from './Routes/designerRoutes.js';
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
  origin: ['http://localhost:3000', 'http://31.97.206.144:7686',
     'https://vidya-enrolldeleteurl.vercel.app' ,
      '**',"*","http://192.168.1.13:3000","http://localhost:3001", 
      "https://brubla-web.onrender.com",
      "https://brubla.onrender.com",
      "https://brubla-admin.onrender.com",
      "http://31.97.228.17:4074",
      "http://31.97.228.17:4076"
    ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
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
app.use('/api/designer', designerRoutes);
app.use('/api/stylist', stylistRoutes)

app.get('/api/debug/token', (req, res) => {
  const authHeader = req.headers.authorization;
  
  console.log('Debug - Auth Header:', authHeader);
  
  if (!authHeader) {
    return res.json({
      valid: false,
      message: 'No Authorization header'
    });
  }
  
  const token = authHeader.substring(7);
  console.log('Debug - Token length:', token.length);
  console.log('Debug - Token preview:', token.substring(0, 50) + '...');
  
  try {
    const secret = process.env.JWT_SECRET_KEY;
    console.log('Debug - Using secret:', secret ? secret.substring(0, 10) + '...' : 'NOT FOUND');
    
    const decoded = jwt.verify(token, secret);
    res.json({
      valid: true,
      tokenLength: token.length,
      decoded: decoded
    });
  } catch (error) {
    console.error('Debug - Error:', error.message);
    res.json({
      valid: false,
      tokenLength: token.length,
      error: error.message,
      errorName: error.name
    });
  }
});

// ✅ Server
const port = process.env.PORT || 4077;
const server = http.createServer(app);

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});