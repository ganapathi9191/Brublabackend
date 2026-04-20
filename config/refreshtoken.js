import jwt from 'jsonwebtoken';

const generateRefreshToken = (id, additionalClaims = {}) => {
  // Merge any additional claims with the id claim
  const payload = { id, ...additionalClaims };

  // Generate the refresh token with a 3-day expiration time
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: "3d" });
};

export default generateRefreshToken;


// Function to generate an activation token for a seller
/*const generateActivationToken = (sellerId, additionalClaims = {}) => {
  // Merge seller ID and additional claims into the token payload
  const payload = { sellerId, ...additionalClaims };

  // Generate the activation token with a short expiration time (e.g., 1 hour)
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
};

// Function to send activation email to a seller
const sendActivationEmail = async (seller) => {
  // Generate activation token for the seller
  const token = generateActivationToken(seller._id);

  // Create the activation link with the seller ID and token
  const activationLink = `http://yourdomain.com/activate/${seller._id}?token=${token}`;

  // Set up nodemailer transporter using your email provider's configuration
  const transporter = nodemailer.createTransport({
      service: 'Gmail', // Change this to your email provider if not using Gmail
      auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
      },
  });

  // Define the email options
  const mailOptions = {
      from: process.env.EMAIL_USER,
      to: seller.email,
      subject: 'Activate Your Account',
      text: `Please click the following link to activate your account: ${activationLink}`,
  };

  try {
      // Send the activation email
      await transporter.sendMail(mailOptions);
      console.log(`Activation email sent to: ${seller.email}`);
  } catch (error) {
      console.error('Error sending activation email:', error);
  }
};*/