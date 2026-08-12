const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 8080;

// Overridable so tests can point these at local fake servers instead of the
// real containers, which only exist inside the docker-compose network.
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user_service_container:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product_service_container:3002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order_service_container:3003';

// Frontend runs on a different origin, so it needs CORS to be allowed to call this API
app.use(cors());

// Forward each /api/<service> prefix to the matching microservice container.
// pathRewrite strips the prefix since the services themselves don't expect it
// (e.g. user-service just has a "/login" route, not "/api/users/login").
app.use('/api/users', createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '' }
}));

app.use('/api/products', createProxyMiddleware({
    target: PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/products': '' }
}));

app.use('/api/orders', createProxyMiddleware({
    target: ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '' }
}));

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`API Gateway listening on http://localhost:${PORT}`);
    });
}

module.exports = app;
