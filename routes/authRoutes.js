const express = require('express');
const router = express.Router();
const { signup, verifySignupOtp, signin, verifySigninOtp, addNote, deleteNote } = require('../controllers/authController');
const { getUser } = require('../controllers/authController');

// Signup Route - Generate OTP for Signup
router.post('/signup', signup);

// Verify OTP for Signup
router.post('/verify-signup-otp', verifySignupOtp);

// Signin Route - Generate OTP for Signin
router.post('/signin', signin);

// Verify OTP for Signin
router.post('/verify-signin-otp', verifySigninOtp);

router.get('/get-user-data', getUser);
router.delete(`/delete-note/:noteId`, deleteNote);
router.post('/add-note', addNote);
module.exports = router;
