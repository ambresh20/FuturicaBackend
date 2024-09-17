const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const authController = require('../controllers/auth.controller');

// @route   POST api/users/register
// @desc    Register a user
// @access  Public

router.post("/register", authController.register);

// @route   POST api/users/login
// @desc    Login a user
// @access  Public

router.post("/login", authController.login);

router.post("/verify-otp", authController.verificationOtp);

// @route   GET api/users
// @desc    Get all users
// @access  Private

router.get("/users", authController.getUsers);

// @route   POST api/users/searchUser
// @desc    Search for a user by userId or email
// @access  Private

router.post("/searchUser", authController.searchUser);

// @route   PUT api/users/updatePassword
// @desc    Update a user's password
// @access  Private

router.put("/updatePassword", authController.updatePassword);

router.post("/forgetPassword", authController.forgetPassword);

router.post("/resetPassword", authController.resetPassword);

// @route   DELETE api/users/deleteUser
// @desc    Delete a user by userId
// @access  Private

router.delete("/deleteUser", authController.deleteUser); // Add delete user route

// @route   POST api/users/logout
// @desc    Logout a user
// @access  Private

router.post("/logout", authController.logout);

module.exports = router;
