const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

// Service URLs
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';
const SALES_SERVICE_URL = process.env.SALES_SERVICE_URL || 'http://localhost:3002';
const STATISTICS_SERVICE_URL = process.env.STATISTICS_SERVICE_URL || 'http://localhost:3003';

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Logging
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        services: {
            product: PRODUCT_SERVICE_URL,
            sales: SALES_SERVICE_URL,
            statistics: STATISTICS_SERVICE_URL
        }
    });
});

// API Routes with Proxy to respective services

// Product Service Routes
app.use('/api/products', createProxyMiddleware({
    target: PRODUCT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/products': '/api/products'
    },
    onError: (err, req, res) => {
        console.error('Product Service Error:', err);
        res.status(503).json({ error: 'Product service unavailable' });
    }
}));

// Sales Service Routes
app.use('/api/sales', createProxyMiddleware({
    target: SALES_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/sales': '/api/sales'
    },
    onError: (err, req, res) => {
        console.error('Sales Service Error:', err);
        res.status(503).json({ error: 'Sales service unavailable' });
    }
}));

// Statistics Service Routes
app.use('/api/statistics', createProxyMiddleware({
    target: STATISTICS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/statistics': '/api/statistics'
    },
    onError: (err, req, res) => {
        console.error('Statistics Service Error:', err);
        res.status(503).json({ error: 'Statistics service unavailable' });
    }
}));

// Serve static frontend files
app.use(express.static('../frontend'));

// Catch-all route to serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: '../frontend' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Gateway Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`API Gateway running on http://localhost:${PORT}`);
    console.log(`Product Service proxy: ${PRODUCT_SERVICE_URL}`);
    console.log(`Sales Service proxy: ${SALES_SERVICE_URL}`);
    console.log(`Statistics Service proxy: ${STATISTICS_SERVICE_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});