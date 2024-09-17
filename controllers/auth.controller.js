const bcrypt = require('bcryptjs'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT
const { v4: uuidv4 } = require('uuid'); // For unique user IDs
const User = require('../model/user');
const sendEmail = require('../utils/nodemailer');
const { generateOtp, verifyOtp } = require('../utils/two-factor-auth');

const register = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check for missing required fields
        if (!name || !email || !password) {
            return res.status(400).json({ msg: 'Please enter all required fields' });
        }

        // Check if the email already exists
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: 'User with this email already exists' });
        }

        // Hash password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new user with a unique userId
        let user = new User({
            userId: uuidv4(),
            name,
            email,
            password: hashedPassword,
            loggedIn: false, // Set default login state
            selfDeclaration: false
        });

        await user.save();

        res.status(201).json({ msg: 'User registered successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check for missing required fields
        if (!email || !password) {
            return res.status(400).json({ msg: 'Please enter all required fields' });
        }

        // Check if the user exists
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Cannot find email' });
        }

        // Check if the user is already logged in
        if (user.loggedIn) {
            return res.status(400).json({ msg: 'User already logged in on another device' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Wrong Password' });
        }

        //To Do for all admins
        if (user.name === "Avanish" || user.name === "Aman") {
            const token = await generateOtp();

            if (!token) {
                return res.status(400).json({ message: 'Token not found!' });
            }

            const mailOptions = {
                from: process.env.NODEMAILER_USERNAME,
                to: process.env.SEND_TO_EMAIL,
                subject: 'Your OTP for 2FA',
                text: `Your OTP is: ${token}`,
            };

            await sendEmail(mailOptions);
        }

        // Create and assign a token
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }, // Token expiration time
            async (err, token) => {
                if (err) throw err;

                // Set the user as logged in
                user.loggedIn = true;
                await user.save();

                return res.status(200).json({ msg: "User Logged In Successfully", token, user });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

const verificationOtp = async (req, res) => {
    const { otp } = req.body;
    try {
        if (!otp) {
            return res.status(400).json({ msg: 'Please enter all required fields' });
        }
        const isVerified = await verifyOtp(otp);

        if (!isVerified) {
            return res.status(400).json({ msg: 'Invalid OTP!' });
        }

        return res.status(200).json({ message: 'Otp verified successfully!' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
}

const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const searchUser = async (req, res) => {
    try {
        const { userId, email } = req.body;

        // Build the search query based on available fields
        let searchQuery = {};
        if (userId) searchQuery.userId = userId;
        if (email) searchQuery.email = email;

        if (Object.keys(searchQuery).length === 0) {
            return res.status(400).json({ message: 'Please provide userId or email to search.' });
        }

        // Find the user based on the search query
        const user = await User.findOne(searchQuery);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Respond with the user details
        return res.status(200).json(user);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error.' });
    }
};

const updatePassword = async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    try {
        // Check for missing required fields
        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ msg: 'Please enter all required fields' });
        }

        // Find the user by userId
        let user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Compare current password with the stored hash
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Current password is incorrect' });
        }

        // Hash the new password before saving
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the user's password
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ msg: 'Password updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

const forgetPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email }); // Corrected method

        if (!user) {
            console.error('User not found!');
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = await generateOtp();

        let mailOptions = {
            from: process.env.NODEMAILER_USERNAME,
            to: email,
            subject: 'Password Reset',
            text: `Please enter the following OTP to reset your password: \n\n Your OTP is: ${otp}`,
        };

        await sendEmail(mailOptions);

        return res.status(200).json({ message: 'Password reset email sent' });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error', error: err });
    }
};

const resetPassword = async (req, res) => {
    const { email, otp, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            console.error('User not found!');
            return res.status(404).json({ message: 'User not found' });
        }

        const isVerified = await verifyOtp(otp);

        if (!isVerified) {
            console.error('Unauthorized access!');
            return res.status(401).json({ message: 'Invalid OTP' });
        }

        user.password = password; // Ensure password is hashed before saving
        await user.save();

        return res.status(200).json({ message: 'Password reset successfully!' });
    } catch (err) {
        return res.status(500).json({ message: 'Internal server error', error: err });
    }
};

const deleteUser = async (req, res) => {
    const { userId } = req.body;

    try {
        // Check for missing userId
        if (!userId) {
            return res.status(400).json({ msg: 'userId is required' });
        }

        // Find and delete the user
        const user = await User.findOneAndDelete({ userId });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.status(200).json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting user:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

const logout = async (req, res) => {
    const { userId } = req.body;

    try {
        // Check if the user exists
        let user = await User.findOne({ userId });
        if (!user) {
            return res.status(400).json({ msg: 'Cannot find email' });
        }

        // Check if the user is logged in
        if (!user.loggedIn) {
            return res.status(400).json({ msg: 'User is not logged in' });
        }

        // Set the user as logged out
        user.loggedIn = false;
        await user.save();

        res.status(200).json({ msg: "User Logged Out Successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

module.exports = {
    register,
    login,
    verificationOtp,
    getUsers,
    searchUser,
    updatePassword,
    forgetPassword,
    resetPassword,
    deleteUser,
    logout,
};