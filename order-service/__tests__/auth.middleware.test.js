// Direct unit tests for the auth middleware - no HTTP, no DB, just req/res/next.

const jwt = require('jsonwebtoken');
const { authenticate, requireAdmin } = require('../middleware/auth');

const JWT_SECRET = 'super_secret_key_for_my_project';

function mockRes() {
    return {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
}

describe('authenticate', () => {
    it('rejects a request with no Authorization header', () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();

        authenticate(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects a malformed/expired token', () => {
        const req = { headers: { authorization: 'Bearer not-a-real-token' } };
        const res = mockRes();
        const next = jest.fn();

        authenticate(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('attaches the decoded payload to req.user and calls next() for a valid token', () => {
        const token = jwt.sign({ id: 1, email: 'a@test.com', role: 'customer' }, JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        authenticate(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user).toMatchObject({ id: 1, email: 'a@test.com', role: 'customer' });
    });
});

describe('requireAdmin', () => {
    it('rejects a valid token that is not an admin', () => {
        const token = jwt.sign({ id: 1, email: 'a@test.com', role: 'customer' }, JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('calls next() for a valid admin token', () => {
        const token = jwt.sign({ id: 1, email: 'admin1@eshop.com', role: 'admin' }, JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        requireAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });
});
