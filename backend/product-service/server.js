const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PRODUCT_SERVICE_PORT || 3001;

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
        console.error('Product Service - Database connection failed:', err);
        process.exit(1);
    }
    console.log('Product Service - Connected to MySQL database');
});

// ============= PRODUCT ROUTES =============

// GET all products
app.get('/api/products', (req, res) => {
    const query = 'SELECT * FROM products ORDER BY id DESC';
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// GET single product by ID
app.get('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM products WHERE id = ?';
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching product:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(results[0]);
    });
});

// POST create new product
app.post('/api/products', (req, res) => {
    const { name, price, stock } = req.body;
    
    // Validation
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ error: 'Name, price, and stock are required' });
    }
    
    if (price < 0) {
        return res.status(400).json({ error: 'Price cannot be negative' });
    }
    
    if (stock < 0) {
        return res.status(400).json({ error: 'Stock cannot be negative' });
    }
    
    const query = 'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)';
    
    db.query(query, [name, price, stock], (err, result) => {
        if (err) {
            console.error('Error creating product:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.status(201).json({
            id: result.insertId,
            name,
            price,
            stock,
            message: 'Product created successfully'
        });
    });
});

// PUT update product
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, price, stock } = req.body;
    
    // Check if product exists
    const checkQuery = 'SELECT * FROM products WHERE id = ?';
    
    db.query(checkQuery, [id], (err, results) => {
        if (err) {
            console.error('Error checking product:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Update product
        const updateQuery = 'UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?';
        
        db.query(updateQuery, [name || results[0].name, price || results[0].price, stock || results[0].stock, id], (err) => {
            if (err) {
                console.error('Error updating product:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({
                id: parseInt(id),
                name: name || results[0].name,
                price: price || results[0].price,
                stock: stock || results[0].stock,
                message: 'Product updated successfully'
            });
        });
    });
});

// DELETE product
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    
    // Check if product exists
    const checkQuery = 'SELECT * FROM products WHERE id = ?';
    
    db.query(checkQuery, [id], (err, results) => {
        if (err) {
            console.error('Error checking product:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Delete product
        const deleteQuery = 'DELETE FROM products WHERE id = ?';
        
        db.query(deleteQuery, [id], (err) => {
            if (err) {
                console.error('Error deleting product:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ message: 'Product deleted successfully' });
        });
    });
});

// GET check product stock (for sales service)
app.get('/api/products/:id/stock', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT id, name, price, stock FROM products WHERE id = ?';
    
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error checking stock:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(results[0]);
    });
});

// PUT update product stock (for sales service)
app.put('/api/products/:id/stock', (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Valid quantity is required' });
    }
    
    const query = 'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?';
    
    db.query(query, [quantity, id, quantity], (err, result) => {
        if (err) {
            console.error('Error updating stock:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: 'Insufficient stock or product not found' });
        }
        
        res.json({ message: 'Stock updated successfully' });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Product Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.end((err) => {
        if (err) console.error('Error closing database connection:', err);
        console.log('Product Service - Database connection closed');
        process.exit(0);
    });
});