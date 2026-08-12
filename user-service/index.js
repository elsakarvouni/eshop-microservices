require('dotenv').config({ quiet: true });
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;

// Fallbacks let this run locally without a .env file; docker-compose always
// supplies its own values instead.
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_for_my_project';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin1@eshop.com';

app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER || 'myuser',
    host: process.env.DB_HOST || 'postgres-user-db',
    database: process.env.DB_NAME || 'users_db',
    password: process.env.DB_PASSWORD || 'mypassword',
    port: process.env.DB_PORT || 5432,
});

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
        `);
        // Added after the table already existed in some environments, so this
        // has to be a separate statement instead of just going in CREATE TABLE.
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
    } catch (err) {
        console.error('Failed to set up the users table:', err);
    }
};
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'Αυτό το email χρησιμοποιείται ήδη!' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );
        res.status(201).json({ message: 'Ο χρήστης δημιουργήθηκε!', user: newUser.rows[0] });
    } catch (err) {
        res.status(500).json({ message: 'Σφάλμα διακομιστή' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Λάθος email ή κωδικός' });
        }
        const user = userResult.rows[0];

        // bcrypt.compare re-hashes the given password with the stored salt and
        // checks it against the stored hash - the hashes can't be compared directly.
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Λάθος email ή κωδικός' });
        }

        // The role is decided here from the DB, not from anything the client sends -
        // otherwise anyone could just claim to be admin in their request body.
        const role = user.email === ADMIN_EMAIL ? 'admin' : 'customer';
        const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Επιτυχής σύνδεση!', token, role });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Σφάλμα διακομιστή κατά το login' });
    }
});

// initDB()/app.listen() only run when this file is executed directly (node index.js
// or the Docker container) - not when a test file requires `app` via module.exports.
if (require.main === module) {
    initDB();
    app.listen(PORT, () => {
        console.log(`User Service is listening on http://localhost:${PORT}`);
    });
}

module.exports = app;
