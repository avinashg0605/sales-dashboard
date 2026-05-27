const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.SALES_SERVICE_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ms_user',
    password: process.env.DB_PASSWORD || 'ms_password',
    database: process.env.DB_NAME || 'sales_products_db',
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error('Sales Service - Database connection failed:', err);
        process.exit(1);
    }
    console.log('Sales Service - Connected to MySQL database');
});

// Product Service URL
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';

// ============= SALES ROUTES =============

// GET all sales with product details
app.get('/api/sales', (req, res) => {
    let query = `
        SELECT s.*, p.name as product_name, p.price as product_price 
        FROM sales s
        JOIN products p ON s.product_id = p.id
    `;
    
    const queryParams = [];
    const conditions = [];
    
    // Apply filters
    if (req.query.product_id) {
        conditions.push('s.product_id = ?');
        queryParams.push(req.query.product_id);
    }
    
    if (req.query.date) {
        conditions.push('DATE(s.sale_date) = ?');
        queryParams.push(req.query.date);
    }
    
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY s.sale_date DESC';
    
    // Add limit if specified
    if (req.query.limit) {
        query += ' LIMIT ?';
        queryParams.push(parseInt(req.query.limit));
    }
    
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error fetching sales:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// GET single sale by ID
app.get('/api/sales/:id', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT s.*, p.name as product_name, p.price as product_price 
        FROM sales s
        JOIN products p ON s.product_id = p.id
        WHERE s.id = ?
    `;
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching sale:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        res.json(results[0]);
    });
});

// POST create new sale
app.post('/api/sales', async (req, res) => {
    const { product_id, quantity } = req.body;
    
    // Validation
    if (!product_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Product ID and valid quantity are required' });
    }
    
    try {
        // Get product details from product service
        const productResponse = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${product_id}/stock`);
        const product = productResponse.data;
        
        if (quantity > product.stock) {
            return res.status(400).json({ error: `Insufficient stock. Available: ${product.stock}` });
        }
        
        // Calculate total amount
        const total_amount = product.price * quantity;
        
        // Create sale record
        const insertSaleQuery = 'INSERT INTO sales (product_id, quantity, total_amount) VALUES (?, ?, ?)';
        
        db.query(insertSaleQuery, [product_id, quantity, total_amount], async (err, result) => {
            if (err) {
                console.error('Error creating sale:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Update product stock via product service
            try {
                await axios.put(`${PRODUCT_SERVICE_URL}/api/products/${product_id}/stock`, { quantity });
                
                res.status(201).json({
                    id: result.insertId,
                    product_id,
                    product_name: product.name,
                    quantity,
                    total_amount,
                    sale_date: new Date(),
                    message: 'Sale processed successfully'
                });
            } catch (stockError) {
                // Rollback: Delete the sale if stock update fails
                db.query('DELETE FROM sales WHERE id = ?', [result.insertId]);
                console.error('Error updating stock:', stockError.response?.data || stockError.message);
                return res.status(500).json({ error: 'Failed to update product stock' });
            }
        });
        
    } catch (error) {
        console.error('Error processing sale:', error);
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.status(500).json({ error: 'Failed to process sale' });
    }
});

// DELETE sale
app.delete('/api/sales/:id', (req, res) => {
    const { id } = req.params;
    
    // First get sale details to restore stock
    const getSaleQuery = 'SELECT product_id, quantity FROM sales WHERE id = ?';
    
    db.query(getSaleQuery, [id], async (err, results) => {
        if (err) {
            console.error('Error fetching sale:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        const sale = results[0];
        
        // Delete sale
        const deleteQuery = 'DELETE FROM sales WHERE id = ?';
        
        db.query(deleteQuery, [id], async (err) => {
            if (err) {
                console.error('Error deleting sale:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Restore product stock (add back the quantity)
            try {
                await axios.put(`${PRODUCT_SERVICE_URL}/api/products/${sale.product_id}/stock/restore`, { quantity: sale.quantity });
                res.json({ message: 'Sale deleted and stock restored successfully' });
            } catch (stockError) {
                console.error('Error restoring stock:', stockError.message);
                // Note: Stock restore failed but sale is deleted
                res.json({ message: 'Sale deleted but failed to restore stock', warning: true });
            }
        });
    });
});

// GET sales summary by product
app.get('/api/sales/summary/by-product', (req, res) => {
    const query = `
        SELECT 
            p.id as product_id,
            p.name as product_name,
            COUNT(s.id) as total_sales,
            COALESCE(SUM(s.quantity), 0) as total_quantity,
            COALESCE(SUM(s.total_amount), 0) as total_revenue
        FROM products p
        LEFT JOIN sales s ON p.id = s.product_id
        GROUP BY p.id, p.name
        ORDER BY total_revenue DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching sales summary:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Sales Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.end((err) => {
        if (err) console.error('Error closing database connection:', err);
        console.log('Sales Service - Database connection closed');
        process.exit(0);
    });
});