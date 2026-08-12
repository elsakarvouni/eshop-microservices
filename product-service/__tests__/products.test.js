// Route-level tests: request/response contract and the admin-only guard on the
// write endpoints. Uses a real in-memory MongoDB, not mocks.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { connect, disconnect, clearCollections } = require('./mongoSetup');
const { app, Product } = require('../index');

const JWT_SECRET = 'super_secret_key_for_my_project'; // matches middleware/auth.js's fallback default
const adminToken = jwt.sign({ id: 1, email: 'admin1@eshop.com', role: 'admin' }, JWT_SECRET);
const customerToken = jwt.sign({ id: 2, email: 'customer@test.com', role: 'customer' }, JWT_SECRET);

beforeAll(async () => { await connect(); });
afterAll(async () => { await disconnect(); });
afterEach(async () => { await clearCollections(); });

describe('GET /', () => {
    it('lists products without requiring auth', async () => {
        await Product.create({ name: 'Keyboard', price: 40, stock: 10, category: 'Gaming' });

        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('Keyboard');
    });
});

describe('POST /', () => {
    const newProduct = { name: 'Webcam', description: 'HD', price: 30, stock: 5, category: 'Accessories' };

    it('rejects the request when there is no token', async () => {
        const res = await request(app).post('/').send(newProduct);
        expect(res.status).toBe(401);
    });

    it('rejects a logged-in customer who is not an admin', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(newProduct);

        expect(res.status).toBe(403);
    });

    it('lets an admin create a product, variants included', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Phone',
                price: 500,
                stock: 0,
                category: 'Smartphones',
                variants: [{ label: '128GB', price: 500, stock: 3 }]
            });

        expect(res.status).toBe(201);
        expect(res.body.product.variants).toHaveLength(1);
        expect(res.body.product.variants[0].label).toBe('128GB');
    });
});

describe('PUT /:id and DELETE /:id', () => {
    it('requires admin for both update and delete', async () => {
        const product = await Product.create({ name: 'Mouse', price: 20, stock: 10, category: 'Gaming' });

        const putRes = await request(app)
            .put(`/${product._id}`)
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ name: 'Mouse', price: 25, stock: 10, category: 'Gaming' });
        expect(putRes.status).toBe(403);

        const deleteRes = await request(app)
            .delete(`/${product._id}`)
            .set('Authorization', `Bearer ${customerToken}`);
        expect(deleteRes.status).toBe(403);
    });

    it('lets an admin update and then delete a product', async () => {
        const product = await Product.create({ name: 'Mouse', price: 20, stock: 10, category: 'Gaming' });

        const putRes = await request(app)
            .put(`/${product._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Mouse', price: 25, stock: 10, category: 'Gaming' });
        expect(putRes.status).toBe(200);
        expect(putRes.body.product.price).toBe(25);

        const deleteRes = await request(app)
            .delete(`/${product._id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(deleteRes.status).toBe(200);

        expect(await Product.findById(product._id)).toBeNull();
    });
});
