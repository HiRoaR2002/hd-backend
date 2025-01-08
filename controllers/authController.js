const User = require('../models/User'); // Assuming you have a User model
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

require('dotenv').config();
// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Signup Controller
exports.signup = async (req, res) => {
  const { name, email } = req.body;

  try {
    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).send('User already exists');

    // Create new user (without OTP for now)
    const newUser = new User({ name, email });
    await newUser.save();

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    newUser.otp = otp;
    newUser.otpExpires = Date.now() + 5 * 60 * 1000; // OTP expires in 5 minutes
    await newUser.save();

    // Send OTP to email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Signup OTP',
      text: `Your OTP for signup is ${otp}`,
    });

    res.status(200).send('OTP sent to your email for verification');
  } catch (error) {
    res.status(500).send('Error during signup');
  }
};

// Verify Signup OTP
exports.verifySignupOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    // Verify OTP
    if (user.otp === otp && user.otpExpires > Date.now()) {
      user.otp = null; // Clear OTP after successful verification
      user.otpExpires = null;
      user.isVerified = true; // Mark user as verified
      await user.save();

      res.status(200).send('Signup verified successfully');
    } else {
      res.status(400).send('Invalid or expired OTP');
    }
  } catch (error) {
    res.status(500).send('Error during OTP verification');
  }
};

// Signin Controller (Generate OTP for Signin)
exports.signin = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the email exists in the database
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 15 * 60 * 1000; // OTP expires in 5 minutes
    await user.save();

    // Send OTP to email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Signin OTP',
      text: `Your OTP for signin is ${otp}`,
    });

    res.status(200).send('OTP sent to your email for verification');
  } catch (error) {
    res.status(500).send('Error during signin');
  }
};

// Verify Signin OTP
exports.verifySigninOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    // Verify OTP
    if (user.otp === otp && user.otpExpires > Date.now()) {
      // Reset OTP after successful verification
      user.otp = null;
      user.otpExpires = null;
      await user.save();

      // Generate a JWT token for session
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.status(200).send({
        message: 'Signin successful',
        token: token, // Send token to frontend
        redirectTo: '/dashboard', // Indicate redirection to the dashboard
      });
    } else {
      res.status(400).send('Invalid or expired OTP');
    }
  } catch (error) {
    res.status(500).send('Error during OTP verification');
  }
};


exports.getUser = async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', ''); // Extract the token from the Authorization header

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get the user ID from decoded token
    const { id } = decoded;

    if (!id) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Find user by ID
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send user data (excluding password)
    return res.status(200).json({
      name: user.name,
      email: user.email,
      notes: user.notes,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.addNote = async (req, res) => {
  const { content } = req.body;
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(401).send('Access denied, no token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded.id);

    const user = await User.findById(decoded.id); // Ensure _id is used here from token payload
    if (!user) {
      return res.status(404).send('User not found');
    }

    if (!content.trim()) {
      return res.status(400).send('Note content cannot be empty');
    }

    user.notes.push({ content });
    await user.save();
    res.status(201).send('Note added successfully');
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).send('Error adding note');
  }
};

exports.deleteNote = async (req, res) => {
  const { noteId } = req.params;
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) {
    return res.status(401).send('Access denied, no token provided');
  }
  try {
    // Find the user by their ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded.id);

    const user = await User.findById(decoded.id);
    // Check if the user exists
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Filter the notes to exclude the note with the specified noteId
    user.notes = user.notes.filter(note => note._id.toString() !== noteId);

    // Save the updated user data
    await user.save();

    // Respond with success
    res.status(200).send('Note deleted successfully');
  } catch (error) {
    // Handle any errors that occur during the process
    console.error(error);
    res.status(500).send('Error deleting note');
  }

}

