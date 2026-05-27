// Global variables
let salesChart = null;
let topProductsChart = null;
let currentDeleteType = null;
let currentDeleteId = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    loadProducts();
    loadSales();
    loadRecentSales();
    loadProductFilter();
    
    setupEventListeners();
    setupTabNavigation();
});

// Setup event listeners
function setupEventListeners() {
    // Add product button
    document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
    
    // Add sale button
    document.getElementById('addSaleBtn')?.addEventListener('click', openSaleModal);
    
    // Product form submit
    document.getElementById('productForm')?.addEventListener('submit', saveProduct);
    
    // Sale form submit
    document.getElementById('saleForm')?.addEventListener('submit', processSale);
    
    // Search product
    document.getElementById('searchProduct')?.addEventListener('input', searchProducts);
    
    // Filter buttons
    document.getElementById('applyFilterBtn')?.addEventListener('click', applyFilters);
    document.getElementById('resetFilterBtn')?.addEventListener('click', resetFilters);
    
    // Sale quantity change to calculate total
    document.getElementById('saleQuantity')?.addEventListener('input', calculateSaleTotal);
    document.getElementById('saleProductId')?.addEventListener('change', calculateSaleTotal);
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            document.getElementById('productModal').style.display = 'none';
            document.getElementById('saleModal').style.display = 'none';
            document.getElementById('deleteModal').style.display = 'none';
        });
    });
    
    // Delete confirmation
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
        document.getElementById('deleteModal').style.display = 'none';
    });
    
    // Click outside modal to close
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// Setup tab navigation
function setupTabNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabs = ['dashboardTab', 'productsTab', 'salesTab'];
    
    navBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            // Update active button
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show selected tab
            tabs.forEach((tab, i) => {
                const tabElement = document.getElementById(tab);
                if (i === index) {
                    tabElement.classList.add('active');
                    if (tab === 'dashboardTab') {
                        loadStatistics();
                        loadRecentSales();
                    } else if (tab === 'productsTab') {
                        loadProducts();
                    } else if (tab === 'salesTab') {
                        loadSales();
                    }
                } else {
                    tabElement.classList.remove('active');
                }
            });
        });
    });
}

// Load statistics and charts
async function loadStatistics() {
    try {
        const stats = await API.getStatistics();
        
        document.getElementById('totalProducts').textContent = stats.totalProducts || 0;
        document.getElementById('totalSales').textContent = stats.totalSales || 0;
        document.getElementById('totalRevenue').textContent = `$${stats.totalRevenue || 0}`;
        
        updateCharts(stats);
    } catch (error) {
        console.error('Error loading statistics:', error);
        showError('Failed to load statistics');
    }
}

// Update charts
function updateCharts(stats) {
    // Sales chart
    const salesCtx = document.getElementById('salesChart')?.getContext('2d');
    if (salesCtx) {
        if (salesChart) salesChart.destroy();
        
        salesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: stats.salesLabels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Sales Revenue',
                    data: stats.salesData || [0, 0, 0, 0, 0, 0],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }
    
    // Top products chart
    const topCtx = document.getElementById('topProductsChart')?.getContext('2d');
    if (topCtx) {
        if (topProductsChart) topProductsChart.destroy();
        
        topProductsChart = new Chart(topCtx, {
            type: 'bar',
            data: {
                labels: stats.topProducts || [],
                datasets: [{
                    label: 'Units Sold',
                    data: stats.topProductsSales || [],
                    backgroundColor: '#764ba2',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }
}

// Load products
async function loadProducts() {
    try {
        const products = await API.getProducts();
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products');
    }
}

// Display products
function displayProducts(products) {
    const tbody = document.getElementById('productsList');
    if (!tbody) return;
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>${product.id}</td>
            <td>${escapeHtml(product.name)}</td>
            <td>$${parseFloat(product.price).toFixed(2)}</td>
            <td>${product.stock}</td>
            <td class="action-buttons">
                <button class="btn-edit" onclick="editProduct(${product.id})">Edit</button>
                <button class="btn-delete" onclick="deleteProductItem(${product.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Search products
async function searchProducts() {
    const searchTerm = document.getElementById('searchProduct')?.value.toLowerCase();
    try {
        const products = await API.getProducts();
        const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm));
        displayProducts(filtered);
    } catch (error) {
        console.error('Error searching products:', error);
    }
}

// Open product modal
function openProductModal(product = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    
    if (product) {
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productStock').value = product.stock;
    } else {
        form.reset();
        document.getElementById('productId').value = '';
    }
    
    modal.style.display = 'block';
}

// Edit product
window.editProduct = async (id) => {
    try {
        const product = await API.getProduct(id);
        openProductModal(product);
    } catch (error) {
        console.error('Error loading product:', error);
        showError('Failed to load product details');
    }
};

// Save product
async function saveProduct(event) {
    event.preventDefault();
    
    const id = document.getElementById('productId').value;
    const product = {
        name: document.getElementById('productName').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value)
    };
    
    try {
        if (id) {
            await API.updateProduct(id, product);
            showSuccess('Product updated successfully');
        } else {
            await API.createProduct(product);
            showSuccess('Product created successfully');
        }
        
        document.getElementById('productModal').style.display = 'none';
        loadProducts();
        loadStatistics();
    } catch (error) {
        console.error('Error saving product:', error);
        showError('Failed to save product');
    }
}

// Delete product
window.deleteProductItem = (id) => {
    currentDeleteType = 'product';
    currentDeleteId = id;
    document.getElementById('deleteModal').style.display = 'block';
};

// Load sales
async function loadSales() {
    try {
        const sales = await API.getSales();
        displaySales(sales);
    } catch (error) {
        console.error('Error loading sales:', error);
        showError('Failed to load sales');
    }
}

// Load recent sales for dashboard
async function loadRecentSales() {
    try {
        const sales = await API.getSales({ limit: 5 });
        displayRecentSales(sales);
    } catch (error) {
        console.error('Error loading recent sales:', error);
    }
}

// Display sales
function displaySales(sales) {
    const tbody = document.getElementById('salesList');
    if (!tbody) return;
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No sales found</td></tr>';
        return;
    }
    
    tbody.innerHTML = sales.map(sale => `
        <tr>
            <td>${sale.id}</td>
            <td>${escapeHtml(sale.product_name)}</td>
            <td>${sale.quantity}</td>
            <td>$${parseFloat(sale.total_amount).toFixed(2)}</td>
            <td>${new Date(sale.sale_date).toLocaleString()}</td>
        </tr>
    `).join('');
}

// Display recent sales
function displayRecentSales(sales) {
    const tbody = document.getElementById('recentSalesList');
    if (!tbody) return;
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No recent sales</td></tr>';
        return;
    }
    
    tbody.innerHTML = sales.map(sale => `
        <tr>
            <td>${sale.id}</td>
            <td>${escapeHtml(sale.product_name)}</td>
            <td>${sale.quantity}</td>
            <td>$${parseFloat(sale.total_amount).toFixed(2)}</td>
            <td>${new Date(sale.sale_date).toLocaleString()}</td>
        </tr>
    `).join('');
}

// Open sale modal
async function openSaleModal() {
    try {
        const products = await API.getProducts();
        const select = document.getElementById('saleProductId');
        
        select.innerHTML = '<option value="">Choose a product...</option>' + 
            products.filter(p => p.stock > 0).map(p => 
                `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}">
                    ${escapeHtml(p.name)} - $${p.price} (Stock: ${p.stock})
                </option>`
            ).join('');
        
        document.getElementById('saleForm').reset();
        document.getElementById('saleTotal').textContent = 'Total: $0.00';
        document.getElementById('saleModal').style.display = 'block';
    } catch (error) {
        console.error('Error loading products for sale:', error);
        showError('Failed to load products');
    }
}

// Calculate sale total
async function calculateSaleTotal() {
    const productId = document.getElementById('saleProductId').value;
    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
    
    if (productId && quantity > 0) {
        try {
            const product = await API.getProduct(productId);
            const total = product.price * quantity;
            document.getElementById('saleTotal').textContent = `Total: $${total.toFixed(2)}`;
        } catch (error) {
            console.error('Error calculating total:', error);
        }
    } else {
        document.getElementById('saleTotal').textContent = 'Total: $0.00';
    }
}

// Process sale
async function processSale(event) {
    event.preventDefault();
    
    const sale = {
        product_id: parseInt(document.getElementById('saleProductId').value),
        quantity: parseInt(document.getElementById('saleQuantity').value)
    };
    
    try {
        await API.createSale(sale);
        showSuccess('Sale processed successfully');
        document.getElementById('saleModal').style.display = 'none';
        loadSales();
        loadStatistics();
        loadProducts();
        loadRecentSales();
    } catch (error) {
        console.error('Error processing sale:', error);
        showError(error.message || 'Failed to process sale');
    }
}

// Apply filters
async function applyFilters() {
    const filters = {
        product_id: document.getElementById('filterProduct')?.value,
        date: document.getElementById('filterDate')?.value
    };
    
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });
    
    try {
        const sales = await API.getSales(filters);
        displaySales(sales);
    } catch (error) {
        console.error('Error applying filters:', error);
        showError('Failed to apply filters');
    }
}

// Reset filters
function resetFilters() {
    if (document.getElementById('filterProduct')) document.getElementById('filterProduct').value = '';
    if (document.getElementById('filterDate')) document.getElementById('filterDate').value = '';
    loadSales();
}

// Load product filter dropdown
async function loadProductFilter() {
    try {
        const products = await API.getProducts();
        const select = document.getElementById('filterProduct');
        if (select) {
            select.innerHTML = '<option value="">All Products</option>' + 
                products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
        }
        
        // Also load for sale modal
        const saleSelect = document.getElementById('saleProductId');
        if (saleSelect && saleSelect.children.length <= 1) {
            saleSelect.innerHTML = '<option value="">Choose a product...</option>' + 
                products.filter(p => p.stock > 0).map(p => 
                    `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}">
                        ${escapeHtml(p.name)} - $${p.price} (Stock: ${p.stock})
                    </option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error loading product filter:', error);
    }
}

// Confirm delete
async function confirmDelete() {
    try {
        if (currentDeleteType === 'product') {
            await API.deleteProduct(currentDeleteId);
            showSuccess('Product deleted successfully');
            loadProducts();
            loadStatistics();
        }
        
        document.getElementById('deleteModal').style.display = 'none';
    } catch (error) {
        console.error('Error deleting:', error);
        showError('Failed to delete item');
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showSuccess(message) {
    alert(message); // You can replace this with a toast notification
}

function showError(message) {
    alert('Error: ' + message); // You can replace this with a toast notification
}

// Toast notification system
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Replace alert calls with toast
function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}