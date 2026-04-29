const express = require('express');
const router  = express.Router();

const AuthController  = require('../controllers/AuthController');
const { jwtMiddleware } = require('../middlewares/jwtMiddleware');

// Public routes
router.post('/register', AuthController.register);
router.post('/login',    AuthController.login);
router.post('/refresh',  AuthController.refreshToken);

// Protected routes — wajib JWT
router.post('/logout', jwtMiddleware, AuthController.logout);
router.get('/me',      jwtMiddleware, AuthController.me);

module.exports = router;