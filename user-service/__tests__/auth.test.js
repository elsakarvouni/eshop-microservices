// Route-level tests for register/login. Postgres is mocked out entirely - these
// check the request/response contract and the auth logic (hashing, JWT, role
// assignment), not the SQL itself.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const mockQuery = jest.fn();
jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({ query: mockQuery }))
}));

const request = require('supertest');
const app = require('../index');

const JWT_SECRET = 'super_secret_key_for_my_project'; // matches index.js's fallback default

beforeEach(() => {
    mockQuery.mockReset();
});

describe('POST /register', () => {
    it('creates a new user when the email is not already taken', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // SELECT ... WHERE email = $1 -> no existing user
            .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Alice', email: 'alice@test.com' }] }); // INSERT ... RETURNING

        const res = await request(app)
            .post('/register')
            .send({ name: 'Alice', email: 'alice@test.com', password: 'hunter2' });

        expect(res.status).toBe(201);
        expect(res.body.user).toEqual({ id: 1, name: 'Alice', email: 'alice@test.com' });

        // the password handed to the INSERT should be a bcrypt hash, never the plaintext
        const insertedPassword = mockQuery.mock.calls[1][1][2];
        expect(insertedPassword).not.toBe('hunter2');
        expect(await bcrypt.compare('hunter2', insertedPassword)).toBe(true);
    });

    it('rejects registration when the email is already in use', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'alice@test.com' }] });

        const res = await request(app)
            .post('/register')
            .send({ name: 'Alice', email: 'alice@test.com', password: 'hunter2' });

        expect(res.status).toBe(400);
        expect(mockQuery).toHaveBeenCalledTimes(1); // never reached the INSERT
    });
});

describe('POST /login', () => {
    it('rejects a login for an email that does not exist', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/login')
            .send({ email: 'nobody@test.com', password: 'whatever' });

        expect(res.status).toBe(400);
    });

    it('rejects a login with the wrong password', async () => {
        const storedHash = await bcrypt.hash('correct-password', 10);
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'alice@test.com', password: storedHash }] });

        const res = await request(app)
            .post('/login')
            .send({ email: 'alice@test.com', password: 'wrong-password' });

        expect(res.status).toBe(400);
    });

    it('returns a valid JWT with a customer role for a regular account', async () => {
        const storedHash = await bcrypt.hash('correct-password', 10);
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, email: 'alice@test.com', password: storedHash }] });

        const res = await request(app)
            .post('/login')
            .send({ email: 'alice@test.com', password: 'correct-password' });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe('customer');

        const decoded = jwt.verify(res.body.token, JWT_SECRET);
        expect(decoded).toMatchObject({ id: 1, email: 'alice@test.com', role: 'customer' });
    });

    it('assigns the admin role only to the configured admin email', async () => {
        const storedHash = await bcrypt.hash('admin-password', 10);
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 99, email: 'admin1@eshop.com', password: storedHash }]
        });

        const res = await request(app)
            .post('/login')
            .send({ email: 'admin1@eshop.com', password: 'admin-password' });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe('admin');

        const decoded = jwt.verify(res.body.token, JWT_SECRET);
        expect(decoded.role).toBe('admin');
    });
});
