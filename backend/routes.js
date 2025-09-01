const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    generateBudgetPlan,
    getBudgetHistory,
    authenticateToken
} = require('./controllers');

// Authentication routes
router.post('/auth/register', registerUser);
router.post('/auth/login', loginUser);

// Budget routes (protected)
router.post('/budget/save', authenticateToken, generateBudgetPlan);
router.get('/budget/history', authenticateToken, getBudgetHistory);

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Budget Advisor API is running' });
});

module.exports = router;
