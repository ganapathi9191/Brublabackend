import Admin from '../Models/Admin.js';
import bcrypt from 'bcrypt';

export const createDefaultAdmin = async () => {
  try {
    const defaultAdmin = {
      email: 'admin@example.com',
      password: 'admin123'
    };

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: defaultAdmin.email });
    
    if (!existingAdmin) {
      // Hash the password
      const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
      
      // Create new admin
      const admin = new Admin({
        email: defaultAdmin.email,
        password: hashedPassword,
        role: 'super_admin',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await admin.save();
      console.log('✅ Default admin created successfully');
      console.log(`📧 Email: ${defaultAdmin.email}`);
      console.log(`🔑 Password: ${defaultAdmin.password}`);
    } else {
      console.log('✅ Admin already exists');
    }
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
  }
};
