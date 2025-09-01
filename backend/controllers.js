const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// User Registration
exports.registerUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user exists
        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert user
        const [result] = await db.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );

        res.status(201).json({ 
            message: 'User registered successfully',
            userId: result.insertId 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// User Login
exports.loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const [users] = await db.execute(
            'SELECT id, username, password_hash FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Generate Budget Plan with Gemini API
exports.generateBudgetPlan = async (req, res) => {
    try {
        const { salary, spendingCategories, savingOptions, notes } = req.body;
        const userId = req.user.userId;

        if (!salary) {
            return res.status(400).json({ error: 'Salary is required' });
        }

        // Prepare prompt for Gemini API
        const prompt = `Create a detailed budget plan for someone with:
        - Monthly Salary: $${salary}
        - Spending Categories: ${JSON.stringify(spendingCategories)}
        - Saving Options: ${JSON.stringify(savingOptions)}
        - Additional Notes: ${notes || 'None'}

        Please provide:
        1. Recommended budget allocation percentages
        2. Specific dollar amounts for each category
        3. Savings recommendations
        4. Tips for better financial management

        Keep the response practical and actionable.`;

        // Call Gemini API
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract AI response from Gemini API response
        const aiResponse = geminiResponse.data.candidates[0].content.parts[0].text;

        // Save to database
        await db.execute(`
            INSERT INTO budget_history (user_id, salary, spending_categories, saving_options, notes, ai_response)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            userId,
            salary,
            JSON.stringify(spendingCategories),
            JSON.stringify(savingOptions),
            notes,
            aiResponse
        ]);

        res.json({
            message: 'Budget plan generated successfully',
            budgetPlan: aiResponse
        });

    } catch (error) {
        console.error('Budget generation error:', error);

        // Fallback response if API fails
        const fallbackResponse = `Based on your monthly salary of $${req.body.salary}, here's a basic budget recommendation:

**50/30/20 Rule:**
- 50% for Needs (Housing, utilities, groceries): $${(req.body.salary * 0.5).toFixed(2)}
- 30% for Wants (Entertainment, dining out): $${(req.body.salary * 0.3).toFixed(2)}
- 20% for Savings and Debt: $${(req.body.salary * 0.2).toFixed(2)}

**Emergency Fund:** Try to save 3-6 months of expenses.
**Investment:** Consider diversifying with the options you selected.

*Note: This is a basic plan. For personalized advice, please ensure your Gemini API key is configured correctly.*`;

        // Save fallback response to database
        try {
            await db.execute(`
                INSERT INTO budget_history (user_id, salary, spending_categories, saving_options, notes, ai_response)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                req.user.userId,
                req.body.salary,
                JSON.stringify(req.body.spendingCategories || []),
                JSON.stringify(req.body.savingOptions || []),
                req.body.notes,
                fallbackResponse
            ]);
        } catch (dbError) {
            console.error('Database save error:', dbError);
        }

        res.json({
            message: 'Budget plan generated successfully (fallback)',
            budgetPlan: fallbackResponse
        });
    }
};

// Get User Budget History
exports.getBudgetHistory = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [history] = await db.execute(`
            SELECT id, salary, spending_categories, saving_options, notes, ai_response, created_at
            FROM budget_history 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [userId]);

        res.json({
            message: 'Budget history retrieved successfully',
            history
        });

    } catch (error) {
        console.error('History retrieval error:', error);
        res.status(500).json({ error: 'Failed to retrieve history' });
    }
};

// JWT Authentication Middleware
exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};
