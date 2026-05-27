const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.STATISTICS_SERVICE_PORT || 3003;

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
        console.error('Statistics Service - Database connection failed:', err);
        process.exit(1);
    }
    console.log('Statistics Service - Connected to MySQL database');
});

// Service URLs
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001';
const SALES_SERVICE_URL = process.env.SALES_SERVICE_URL || 'http://localhost:3002';

// ============= STATISTICS ROUTES =============

// GET comprehensive dashboard statistics
app.get('/api/statistics', async (req, res) => {
    try {
        // Fetch data from both services
        const [productsRes, salesRes, salesSummaryRes] = await Promise.all([
            axios.get(`${PRODUCT_SERVICE_URL}/api/products`),
            axios.get(`${SALES_SERVICE_URL}/api/sales`),
            axios.get(`${SALES_SERVICE_URL}/api/sales/summary/by-product`)
        ]);
        
        const products = productsRes.data;
        const sales = salesRes.data;
        const salesSummary = salesSummaryRes.data;
        
        // Calculate basic stats
        const totalProducts = products.length;
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
        
        // Calculate low stock products (stock < 10)
        const lowStockProducts = products.filter(p => p.stock < 10);
        
        // Get top 5 selling products
        const topProducts = salesSummary.slice(0, 5).map(item => item.product_name);
        const topProductsSales = salesSummary.slice(0, 5).map(item => item.total_quantity);
        
        // Get sales data for chart (last 6 months)
        const salesLabels = [];
        const salesData = [];
        const currentDate = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthName = date.toLocaleString('default', { month: 'short' });
            salesLabels.push(monthName);
            
            const monthSales = sales.filter(sale => {
                const saleDate = new Date(sale.sale_date);
                return saleDate.getMonth() === date.getMonth() && 
                       saleDate.getFullYear() === date.getFullYear();
            });
            
            const monthRevenue = monthSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
            salesData.push(monthRevenue);
        }
        
        res.json({
            totalProducts,
            totalSales,
            totalRevenue: totalRevenue.toFixed(2),
            lowStockProducts: lowStockProducts.length,
            topProducts,
            topProductsSales,
            salesLabels,
            salesData,
            lowStockProductsList: lowStockProducts
        });
        
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// GET product performance metrics
app.get('/api/statistics/products/performance', (req, res) => {
    const query = `
        SELECT 
            p.id,
            p.name,
            p.price,
            p.stock,
            COALESCE(COUNT(s.id), 0) as times_sold,
            COALESCE(SUM(s.quantity), 0) as total_quantity_sold,
            COALESCE(SUM(s.total_amount), 0) as total_revenue,
            CASE 
                WHEN p.stock < 10 THEN 'Low Stock'
                WHEN p.stock < 30 THEN 'Medium Stock'
                ELSE 'High Stock'
            END as stock_status
        FROM products p
        LEFT JOIN sales s ON p.id = s.product_id
        GROUP BY p.id, p.name, p.price, p.stock
        ORDER BY total_revenue DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching product performance:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// GET sales trends (daily, weekly, monthly)
app.get('/api/statistics/sales/trends', (req, res) => {
    const { period = 'monthly' } = req.query;
    
    let dateFormat;
    let groupBy;
    
    switch(period) {
        case 'daily':
            dateFormat = '%Y-%m-%d';
            groupBy = 'DATE(sale_date)';
            break;
        case 'weekly':
            dateFormat = '%Y-%u';
            groupBy = 'YEARWEEK(sale_date)';
            break;
        case 'monthly':
        default:
            dateFormat = '%Y-%m';
            groupBy = 'DATE_FORMAT(sale_date, "%Y-%m")';
            break;
    }
    
    const query = `
        SELECT 
            DATE_FORMAT(sale_date, ?) as period,
            COUNT(*) as total_transactions,
            SUM(quantity) as total_quantity,
            SUM(total_amount) as total_revenue
        FROM sales
        GROUP BY ${groupBy}
        ORDER BY MIN(sale_date) DESC
        LIMIT 12
    `;
    
    db.query(query, [dateFormat], (err, results) => {
        if (err) {
            console.error('Error fetching sales trends:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// GET inventory value report
app.get('/api/statistics/inventory/value', (req, res) => {
    const query = `
        SELECT 
            SUM(price * stock) as total_inventory_value,
            AVG(price) as average_product_price,
            SUM(stock) as total_stock_units,
            COUNT(*) as total_products
        FROM products
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching inventory value:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results[0]);
    });
});

// GET revenue by product category (simulated categories based on price)
app.get('/api/statistics/revenue/by-category', (req, res) => {
    const query = `
        SELECT 
            CASE 
                WHEN price < 50 THEN 'Budget (< $50)'
                WHEN price < 200 THEN 'Standard ($50 - $200)'
                ELSE 'Premium (> $200)'
            END as category,
            COUNT(DISTINCT p.id) as product_count,
            COALESCE(SUM(s.quantity), 0) as units_sold,
            COALESCE(SUM(s.total_amount), 0) as revenue
        FROM products p
        LEFT JOIN sales s ON p.id = s.product_id
        GROUP BY category
        ORDER BY revenue DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching revenue by category:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// GET real-time dashboard metrics
app.get('/api/statistics/realtime', async (req, res) => {
    try {
        const [todaySales, topProduct, recentActivity] = await Promise.all([
            // Today's sales
            new Promise((resolve, reject) => {
                db.query(
                    "SELECT COALESCE(SUM(total_amount), 0) as today_revenue, COUNT(*) as today_sales FROM sales WHERE DATE(sale_date) = CURDATE()",
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results[0]);
                    }
                );
            }),
            // Top selling product today
            new Promise((resolve, reject) => {
                db.query(
                    `SELECT p.name, SUM(s.quantity) as total_sold 
                     FROM sales s 
                     JOIN products p ON s.product_id = p.id 
                     WHERE DATE(s.sale_date) = CURDATE() 
                     GROUP BY s.product_id, p.name 
                     ORDER BY total_sold DESC 
                     LIMIT 1`,
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results[0] || null);
                    }
                );
            }),
            // Recent sales (last 5)
            new Promise((resolve, reject) => {
                db.query(
                    `SELECT s.*, p.name as product_name 
                     FROM sales s 
                     JOIN products p ON s.product_id = p.id 
                     ORDER BY s.sale_date DESC 
                     LIMIT 5`,
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results);
                    }
                );
            })
        ]);
        
        res.json({
            today_revenue: todaySales.today_revenue || 0,
            today_sales_count: todaySales.today_sales || 0,
            top_product_today: topProduct,
            recent_activities: recentActivity
        });
        
    } catch (error) {
        console.error('Error fetching real-time stats:', error);
        res.status(500).json({ error: 'Failed to fetch real-time statistics' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Statistics Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.end((err) => {
        if (err) console.error('Error closing database connection:', err);
        console.log('Statistics Service - Database connection closed');
        process.exit(0);
    });
});