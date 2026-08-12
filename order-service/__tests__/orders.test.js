// Route-level tests, focused on the authorization rules: who can see which orders,
// and who can move an order to which status. Real in-memory MongoDB, no mocks.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { connect, disconnect, clearCollections } = require('./mongoSetup');
const { app, Order } = require('../index');

const JWT_SECRET = 'super_secret_key_for_my_project'; // matches middleware/auth.js's fallback default
const adminToken = jwt.sign({ id: 1, email: 'admin1@eshop.com', role: 'admin' }, JWT_SECRET);
const aliceToken = jwt.sign({ id: 2, email: 'alice@test.com', role: 'customer' }, JWT_SECRET);
const bobToken = jwt.sign({ id: 3, email: 'bob@test.com', role: 'customer' }, JWT_SECRET);

beforeAll(async () => { await connect(); });
afterAll(async () => { await disconnect(); });
afterEach(async () => { await clearCollections(); });

describe('POST /', () => {
    it('rejects an unauthenticated request', async () => {
        const res = await request(app).post('/').send({ items: [], totalPrice: 0, address: 'x', phone: 'x' });
        expect(res.status).toBe(401);
    });

    it('uses the email from the token, ignoring whatever the client sends in the body', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', `Bearer ${aliceToken}`)
            .send({
                userEmail: 'someone-else@test.com', // should be ignored
                items: [{ productId: 'p1', quantity: 1, price: 10, name: 'Thing' }],
                totalPrice: 10,
                address: 'Somewhere 1',
                phone: '6900000000'
            });

        expect(res.status).toBe(201);
        const saved = await Order.findById(res.body.orderId);
        expect(saved.userEmail).toBe('alice@test.com');
    });
});

describe('GET /', () => {
    it('is admin-only', async () => {
        await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x' });

        const asCustomer = await request(app).get('/').set('Authorization', `Bearer ${aliceToken}`);
        expect(asCustomer.status).toBe(403);

        const asAdmin = await request(app).get('/').set('Authorization', `Bearer ${adminToken}`);
        expect(asAdmin.status).toBe(200);
        expect(asAdmin.body).toHaveLength(1);
    });
});

describe('GET /user/:email', () => {
    it('lets a customer see their own orders but not someone else\'s', async () => {
        await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x' });

        const ownOrders = await request(app).get('/user/alice@test.com').set('Authorization', `Bearer ${aliceToken}`);
        expect(ownOrders.status).toBe(200);
        expect(ownOrders.body).toHaveLength(1);

        const someoneElses = await request(app).get('/user/alice@test.com').set('Authorization', `Bearer ${bobToken}`);
        expect(someoneElses.status).toBe(403);
    });

    it('lets an admin look up any customer\'s orders', async () => {
        await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x' });

        const res = await request(app).get('/user/alice@test.com').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });
});

describe('PUT /:id/status', () => {
    it('lets a customer cancel their own PENDING order', async () => {
        const order = await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x', status: 'PENDING' });

        const res = await request(app)
            .put(`/${order._id}/status`)
            .set('Authorization', `Bearer ${aliceToken}`)
            .send({ status: 'CANCELLED' });

        expect(res.status).toBe(200);
        expect((await Order.findById(order._id)).status).toBe('CANCELLED');
    });

    it('blocks a customer from cancelling someone else\'s order', async () => {
        const order = await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x', status: 'PENDING' });

        const res = await request(app)
            .put(`/${order._id}/status`)
            .set('Authorization', `Bearer ${bobToken}`)
            .send({ status: 'CANCELLED' });

        expect(res.status).toBe(403);
        expect((await Order.findById(order._id)).status).toBe('PENDING');
    });

    it('blocks a customer from setting any status other than CANCELLED', async () => {
        const order = await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x', status: 'PENDING' });

        const res = await request(app)
            .put(`/${order._id}/status`)
            .set('Authorization', `Bearer ${aliceToken}`)
            .send({ status: 'COMPLETED' });

        expect(res.status).toBe(403);
    });

    it('blocks a customer from cancelling an order that is no longer PENDING', async () => {
        const order = await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x', status: 'SHIPPED' });

        const res = await request(app)
            .put(`/${order._id}/status`)
            .set('Authorization', `Bearer ${aliceToken}`)
            .send({ status: 'CANCELLED' });

        expect(res.status).toBe(403);
    });

    it('lets an admin set any status on any order', async () => {
        const order = await Order.create({ userEmail: 'alice@test.com', items: [], totalPrice: 10, address: 'x', phone: 'x', status: 'PENDING' });

        const res = await request(app)
            .put(`/${order._id}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'SHIPPED' });

        expect(res.status).toBe(200);
        expect((await Order.findById(order._id)).status).toBe('SHIPPED');
    });

    it('returns 404 for an order that does not exist', async () => {
        const fakeId = new (require('mongoose').Types.ObjectId)();
        const res = await request(app)
            .put(`/${fakeId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'SHIPPED' });

        expect(res.status).toBe(404);
    });
});
