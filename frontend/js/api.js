// API Configuration
const API_BASE_URL = 'http://localhost:3000'; // API Gateway URL

// API Service
const API = {
    // Products
    async getProducts() {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        return response.json();
    },

    async getProduct(id) {
        const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
        if (!response.ok) throw new Error('Failed to fetch product');
        return response.json();
    },

    async createProduct(product) {
        const response = await fetch(`${API_BASE_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if (!response.ok) throw new Error('Failed to create product');
        return response.json();
    },

    async updateProduct(id, product) {
        const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        if (!response.ok) throw new Error('Failed to update product');
        return response.json();
    },

    async deleteProduct(id) {
        const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete product');
        return response.json();
    },

    // Sales
    async getSales(filters = {}) {
        let url = `${API_BASE_URL}/api/sales`;
        const params = new URLSearchParams(filters);
        if (params.toString()) url += `?${params.toString()}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch sales');
        return response.json();
    },

    async createSale(sale) {
        const response = await fetch(`${API_BASE_URL}/api/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sale)
        });
        if (!response.ok) throw new Error('Failed to create sale');
        return response.json();
    },

    async deleteSale(id) {
        const response = await fetch(`${API_BASE_URL}/api/sales/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete sale');
        return response.json();
    },

    // Statistics
    async getStatistics() {
        const response = await fetch(`${API_BASE_URL}/api/statistics`);
        if (!response.ok) throw new Error('Failed to fetch statistics');
        return response.json();
    }
};