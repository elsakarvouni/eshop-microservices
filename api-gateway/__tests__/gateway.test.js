// Points the gateway's proxy targets at local fake servers (instead of the real
// containers, which only exist inside the docker-compose network) so the actual
// forwarding and path-rewriting can be verified end-to-end.

const http = require('http');

function startFakeService(name) {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ service: name, path: req.url }));
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

let userServer, productServer, orderServer;
let app;

beforeAll(async () => {
    userServer = await startFakeService('user');
    productServer = await startFakeService('product');
    orderServer = await startFakeService('order');

    process.env.USER_SERVICE_URL = `http://127.0.0.1:${userServer.address().port}`;
    process.env.PRODUCT_SERVICE_URL = `http://127.0.0.1:${productServer.address().port}`;
    process.env.ORDER_SERVICE_URL = `http://127.0.0.1:${orderServer.address().port}`;

    // index.js reads the env vars above at require-time, so it has to load after they're set
    app = require('../index');
});

afterAll(async () => {
    await Promise.all([userServer, productServer, orderServer].map(
        (s) => new Promise((resolve) => s.close(resolve))
    ));
});

const request = () => require('supertest')(app);

describe('proxy routing', () => {
    it('forwards /api/users/* to the user service with the prefix stripped', async () => {
        const res = await request().get('/api/users/login');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ service: 'user', path: '/login' });
    });

    it('forwards /api/products/* to the product service with the prefix stripped', async () => {
        const res = await request().get('/api/products/123');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ service: 'product', path: '/123' });
    });

    it('forwards /api/orders/* to the order service with the prefix stripped', async () => {
        const res = await request().get('/api/orders/user/alice@test.com');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ service: 'order', path: '/user/alice@test.com' });
    });

    it('does not proxy unrelated paths', async () => {
        const res = await request().get('/not-an-api-route');
        expect(res.status).toBe(404);
    });
});

describe('CORS', () => {
    it('allows cross-origin requests, since the frontend runs on a different origin', async () => {
        const res = await request().get('/api/users/login').set('Origin', 'http://localhost:5500');
        expect(res.headers['access-control-allow-origin']).toBe('*');
    });
});
