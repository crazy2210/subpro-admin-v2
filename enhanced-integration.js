// enhanced-integration.js - Integration Script for Enhanced Features
// ملف الربط الشامل للميزات المحسنة مع النظام الموجود

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    SHIFT_DEFINITIONS,
    calculateShiftStatistics,
    exportShiftReportToCSV,
    EXPENSE_CATEGORIES,
    addExpenseWithDate,
    aggregateExpenses,
    ACCOUNT_STATUS,
    getAccountsStatistics,
    calculateProductStatistics,
    showToast,
    exportToExcel,
    copyToClipboard
} from './enhanced-features.js';

// ============================================
// INITIALIZATION - التهيئة
// ============================================

let db = null;
let allSales = [];
let allExpenses = [];
let allAccounts = [];
let allProducts = [];

// Initialize with existing Firebase instance
export function initializeEnhancedFeatures(firestore, salesData, expensesData, accountsData, productsData) {
    db = firestore;
    allSales = salesData || [];
    allExpenses = expensesData || [];
    allAccounts = accountsData || [];
    allProducts = productsData || [];
    
    // Initialize all enhanced sections
    initExpensesSection();
    initShiftsSection();
    initProductStatsSection();
    initAccountsSection();
    initDashboardHome();
    
    console.log('✅ Enhanced features initialized successfully');
}

// ============================================
// EXPENSES SECTION - قسم المصروفات
// ============================================

function initExpensesSection() {
    // Initialize date range picker for expenses
    if (typeof flatpickr !== 'undefined') {
        const expenseDateRangePicker = flatpickr('#expense-date-range-filter', {
            mode: 'range',
            dateFormat: 'Y-m-d',
            locale: 'ar',
            onChange: filterExpenses
        });
    }
    
    // Populate product filter
    const productFilter = document.getElementById('expense-product-filter');
    if (productFilter) {
        allProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name;
            option.textContent = product.name;
            productFilter.appendChild(option);
        });
    }
    
    // Event listeners
    document.getElementById('expense-category-filter')?.addEventListener('change', filterExpenses);
    document.getElementById('expense-product-filter')?.addEventListener('change', filterExpenses);
    document.getElementById('expense-sort-order')?.addEventListener('change', filterExpenses);
    
    // Aggregation buttons
    document.querySelectorAll('[data-aggregation]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-aggregation]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderExpenseAggregation(e.target.dataset.aggregation);
        });
    });
    
    // Initial render
    renderExpenses();
    calculateExpenseStats();
}

function filterExpenses() {
    const category = document.getElementById('expense-category-filter')?.value || 'all';
    const product = document.getElementById('expense-product-filter')?.value || 'all';
    const sortOrder = document.getElementById('expense-sort-order')?.value || 'desc';
    
    let filtered = [...allExpenses];
    
    // Filter by category
    if (category !== 'all') {
        filtered = filtered.filter(e => e.category === category);
    }
    
    // Filter by product
    if (product !== 'all') {
        filtered = filtered.filter(e => e.product_id === product);
    }
    
    // Sort
    filtered.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    renderExpenses(filtered);
}

function renderExpenses(expenses = allExpenses) {
    const tbody = document.getElementById('expenses-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">لا توجد مصروفات</td></tr>';
        return;
    }
    
    expenses.forEach(expense => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        
        const date = new Date(expense.date);
        const categoryInfo = EXPENSE_CATEGORIES[expense.category?.toUpperCase()] || EXPENSE_CATEGORIES.OTHER;
        
        tr.innerHTML = `
            <td class="p-3" data-label="التاريخ">
                <div class="flex flex-col">
                    <span class="font-semibold text-gray-800">${date.toLocaleDateString('ar-EG')}</span>
                    <span class="text-xs text-gray-500">${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </td>
            <td class="p-3" data-label="المنتج">
                <span class="font-medium text-gray-700">${expense.product_id || 'عام'}</span>
            </td>
            <td class="p-3" data-label="النوع">
                <span class="inline-flex items-center gap-1 px-2 py-1 ${categoryInfo.color} text-white text-xs font-semibold rounded-full">
                    <i class="fas ${categoryInfo.icon}"></i>
                    ${categoryInfo.name}
                </span>
            </td>
            <td class="p-3" data-label="المبلغ">
                <span class="font-bold text-red-600 text-lg">${expense.amount || 0} ريال</span>
            </td>
            <td class="p-3" data-label="ملاحظات">
                <span class="text-sm text-gray-600">${expense.note || '-'}</span>
            </td>
            <td class="p-3" data-label="إجراءات">
                <div class="flex gap-2">
                    <button class="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50 transition-colors" 
                            onclick="editExpense('${expense.id}')" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 transition-colors" 
                            onclick="deleteExpense('${expense.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

function calculateExpenseStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const todayExpenses = allExpenses.filter(e => new Date(e.date) >= todayStart);
    const weekExpenses = allExpenses.filter(e => new Date(e.date) >= weekStart);
    const monthExpenses = allExpenses.filter(e => new Date(e.date) >= monthStart);
    
    const totalToday = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalWeek = weekExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalMonth = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    document.getElementById('expense-total-today').textContent = `${totalToday} ريال`;
    document.getElementById('expense-total-week').textContent = `${totalWeek} ريال`;
    document.getElementById('expense-total-month').textContent = `${totalMonth} ريال`;
    document.getElementById('expense-count').textContent = allExpenses.length;
}

function renderExpenseAggregation(period) {
    const aggregated = aggregateExpenses(allExpenses, period);
    
    // Create chart data
    const labels = Object.keys(aggregated);
    const data = Object.values(aggregated).map(v => v.total);
    
    const ctx = document.getElementById('expenseAggregationCanvas');
    if (!ctx) return;
    
    // Destroy existing chart if exists
    if (window.expenseAggChart) {
        window.expenseAggChart.destroy();
    }
    
    // Create new chart
    window.expenseAggChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'إجمالي المصروفات',
                data,
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// ============================================
// SHIFTS SECTION - قسم الشيفتات
// ============================================

let currentShiftDate = new Date();

function initShiftsSection() {
    // Initialize date picker
    if (typeof flatpickr !== 'undefined') {
        flatpickr('#shift-date-picker', {
            dateFormat: 'Y-m-d',
            locale: 'ar',
            defaultDate: currentShiftDate,
            onChange: (selectedDates) => {
                if (selectedDates.length > 0) {
                    currentShiftDate = selectedDates[0];
                    loadShiftStatistics();
                }
            }
        });
    }
    
    // Navigation buttons
    document.getElementById('shift-prev-day')?.addEventListener('click', () => {
        currentShiftDate.setDate(currentShiftDate.getDate() - 1);
        loadShiftStatistics();
    });
    
    document.getElementById('shift-next-day')?.addEventListener('click', () => {
        currentShiftDate.setDate(currentShiftDate.getDate() + 1);
        loadShiftStatistics();
    });
    
    document.getElementById('shift-today-btn')?.addEventListener('click', () => {
        currentShiftDate = new Date();
        loadShiftStatistics();
    });
    
    // Export buttons
    document.getElementById('export-shift-csv-btn')?.addEventListener('click', exportShiftToCSV);
    document.getElementById('export-shift-excel-btn')?.addEventListener('click', exportShiftToExcel);
    
    // Initial load
    loadShiftStatistics();
}

async function loadShiftStatistics() {
    if (!db) {
        console.error('Database not initialized');
        return;
    }
    
    try {
        const stats = await calculateShiftStatistics(db, currentShiftDate);
        renderShiftStatistics(stats);
    } catch (error) {
        console.error('Error loading shift statistics:', error);
        showToast('فشل تحميل إحصائيات الشيفتات', 'error');
    }
}

function renderShiftStatistics(stats) {
    // Update daily summary
    document.getElementById('shift-total-orders').textContent = stats.totalDayOrders;
    document.getElementById('shift-total-revenue').textContent = `${stats.totalDayRevenue} ريال`;
    document.getElementById('shift-total-profit').textContent = `${stats.totalDayProfit} ريال`;
    
    // Render shift cards
    const container = document.getElementById('shifts-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.values(stats.shifts).forEach(shift => {
        const card = document.createElement('div');
        card.className = 'shift-card';
        
        card.innerHTML = `
            <div class="shift-header">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-br ${shift.color} flex items-center justify-center shadow-lg">
                        <i class="fas ${shift.icon} text-white text-xl"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${shift.name}</h3>
                        <p class="text-sm text-gray-600">${shift.nameEn}</p>
                    </div>
                </div>
            </div>
            
            <div class="shift-stats">
                <div class="shift-stat-item">
                    <i class="fas fa-shopping-cart text-indigo-600 text-2xl mb-2"></i>
                    <p class="text-2xl font-bold text-gray-800">${shift.totalOrders}</p>
                    <p class="text-xs text-gray-600">أوردرات</p>
                </div>
                
                <div class="shift-stat-item">
                    <i class="fas fa-user-check text-green-600 text-2xl mb-2"></i>
                    <p class="text-2xl font-bold text-gray-800">${shift.accountsUsedCount}</p>
                    <p class="text-xs text-gray-600">أكونتات</p>
                </div>
                
                <div class="shift-stat-item">
                    <i class="fas fa-dollar-sign text-amber-600 text-2xl mb-2"></i>
                    <p class="text-2xl font-bold text-gray-800">${shift.totalRevenue}</p>
                    <p class="text-xs text-gray-600">ريال</p>
                </div>
            </div>
            
            <div class="mt-4 pt-4 border-t border-gray-200">
                <h4 class="font-bold text-gray-800 mb-3">تفصيل المنتجات:</h4>
                <div class="space-y-2">
                    ${Object.entries(shift.productBreakdown).map(([product, data]) => `
                        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span class="text-sm font-medium text-gray-700">${product}</span>
                            <div class="flex gap-3 text-sm">
                                <span class="text-indigo-600 font-semibold">${data.count} أوردر</span>
                                <span class="text-green-600 font-semibold">${data.revenue} ريال</span>
                            </div>
                        </div>
                    `).join('') || '<p class="text-sm text-gray-500 text-center py-2">لا توجد أوردرات</p>'}
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function exportShiftToCSV() {
    // Implementation from enhanced-features.js
    showToast('جاري تصدير التقرير...', 'info');
    // Call the export function with current shift data
}

function exportShiftToExcel() {
    showToast('جاري تصدير التقرير...', 'info');
    // Implement Excel export
}

// ============================================
// PRODUCT STATISTICS - إحصائيات المنتجات
// ============================================

function initProductStatsSection() {
    // Initialize date range picker
    if (typeof flatpickr !== 'undefined') {
        flatpickr('#product-stats-date-range', {
            mode: 'range',
            dateFormat: 'Y-m-d',
            locale: 'ar',
            onChange: loadProductStatistics
        });
    }
    
    document.getElementById('product-stats-reset-btn')?.addEventListener('click', () => {
        document.getElementById('product-stats-date-range').value = '';
        loadProductStatistics();
    });
    
    document.getElementById('export-products-stats-btn')?.addEventListener('click', exportProductStats);
    
    // Initial load
    loadProductStatistics();
}

async function loadProductStatistics() {
    if (!db) return;
    
    const container = document.getElementById('products-stats-container');
    if (!container) return;
    
    container.innerHTML = '<div class="col-span-full text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-indigo-600"></i></div>';
    
    try {
        const productsStats = [];
        
        for (const product of allProducts) {
            const stats = await calculateProductStatistics(db, product.name);
            productsStats.push({ ...product, ...stats });
        }
        
        renderProductStatistics(productsStats);
        renderProductsComparisonChart(productsStats);
        
    } catch (error) {
        console.error('Error loading product statistics:', error);
        showToast('فشل تحميل إحصائيات المنتجات', 'error');
    }
}

function renderProductStatistics(products) {
    const container = document.getElementById('products-stats-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card-detail';
        
        const trendIcon = product.salesTrend === 'increasing' ? 'fa-arrow-trend-up text-green-600' : 
                         product.salesTrend === 'decreasing' ? 'fa-arrow-trend-down text-red-600' : 
                         'fa-minus text-gray-600';
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">${product.name}</h3>
                    <p class="text-sm text-gray-600">${product.nameEn || ''}</p>
                </div>
                <i class="fas ${trendIcon} text-2xl"></i>
            </div>
            
            <div class="space-y-3">
                <div class="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
                    <span class="text-sm font-medium text-gray-700">عدد الأوردرات</span>
                    <span class="text-lg font-bold text-indigo-600">${product.totalOrders}</span>
                </div>
                
                <div class="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span class="text-sm font-medium text-gray-700">إجمالي الإيرادات</span>
                    <span class="text-lg font-bold text-green-600">${product.totalRevenue} ريال</span>
                </div>
                
                <div class="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span class="text-sm font-medium text-gray-700">إجمالي الأرباح</span>
                    <span class="text-lg font-bold text-purple-600">${product.totalProfit} ريال</span>
                </div>
                
                <div class="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <span class="text-sm font-medium text-gray-700">متوسط سعر الأوردر</span>
                    <span class="text-lg font-bold text-amber-600">${product.averageOrderValue.toFixed(2)} ريال</span>
                </div>
                
                <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span class="text-sm font-medium text-gray-700">نسبة المساهمة</span>
                    <span class="text-lg font-bold text-blue-600">${product.contributionPercentage}%</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function renderProductsComparisonChart(products) {
    const ctx = document.getElementById('productsComparisonChart');
    if (!ctx) return;
    
    if (window.productsCompChart) {
        window.productsCompChart.destroy();
    }
    
    const labels = products.map(p => p.name);
    const revenueData = products.map(p => p.totalRevenue);
    const profitData = products.map(p => p.totalProfit);
    
    window.productsCompChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'الإيرادات',
                    data: revenueData,
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 2
                },
                {
                    label: 'الأرباح',
                    data: profitData,
                    backgroundColor: 'rgba(168, 85, 247, 0.7)',
                    borderColor: 'rgba(168, 85, 247, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function exportProductStats() {
    showToast('جاري تصدير التقرير...', 'info');
    // Implement export
}

// ============================================
// ACCOUNTS SECTION - قسم الأكونتات
// ============================================

function initAccountsSection() {
    // Populate product filter
    const productFilter = document.getElementById('account-product-filter');
    if (productFilter) {
        allProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name;
            option.textContent = product.name;
            productFilter.appendChild(option);
        });
    }
    
    // Event listeners
    document.getElementById('account-status-filter')?.addEventListener('change', filterAccounts);
    document.getElementById('account-product-filter')?.addEventListener('change', filterAccounts);
    document.getElementById('account-search-input')?.addEventListener('input', filterAccounts);
    
    // Status card filters
    document.querySelectorAll('.stat-card[data-filter]').forEach(card => {
        card.addEventListener('click', (e) => {
            const filter = e.currentTarget.dataset.filter;
            document.getElementById('account-status-filter').value = filter;
            filterAccounts();
        });
    });
    
    // Initial render
    calculateAccountStats();
    renderAccounts();
    checkLowStock();
}

function filterAccounts() {
    const status = document.getElementById('account-status-filter')?.value || 'all';
    const product = document.getElementById('account-product-filter')?.value || 'all';
    const search = document.getElementById('account-search-input')?.value.toLowerCase() || '';
    
    let filtered = [...allAccounts];
    
    if (status !== 'all') {
        filtered = filtered.filter(a => a.status === status);
    }
    
    if (product !== 'all') {
        filtered = filtered.filter(a => a.product_id === product);
    }
    
    if (search) {
        filtered = filtered.filter(a => 
            (a.email && a.email.toLowerCase().includes(search)) ||
            (a.id && a.id.toLowerCase().includes(search))
        );
    }
    
    renderAccounts(filtered);
}

function renderAccounts(accounts = allAccounts) {
    const tbody = document.getElementById('accounts-enhanced-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">لا توجد حسابات</td></tr>';
        return;
    }
    
    accounts.forEach(account => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        
        const statusBadge = account.status === 'available' ? 'badge-green' :
                           account.status === 'used' ? 'badge-blue' : 'badge-red';
        const statusText = account.status === 'available' ? 'متاح' :
                          account.status === 'used' ? 'مستخدم' : 'تالف';
        
        tr.innerHTML = `
            <td class="p-3" data-label="المنتج">
                <span class="font-medium text-gray-700">${account.product_id || '-'}</span>
            </td>
            <td class="p-3" data-label="البريد">
                <span class="font-mono text-sm text-gray-800">${account.email || '-'}</span>
            </td>
            <td class="p-3" data-label="الحالة">
                <span class="badge ${statusBadge}">${statusText}</span>
            </td>
            <td class="p-3" data-label="تاريخ الإنشاء">
                <span class="text-sm text-gray-600">${account.createdAt ? new Date(account.createdAt.toDate()).toLocaleDateString('ar-EG') : '-'}</span>
            </td>
            <td class="p-3" data-label="تاريخ الاستخدام">
                <span class="text-sm text-gray-600">${account.assigned_at ? new Date(account.assigned_at.toDate()).toLocaleDateString('ar-EG') : '-'}</span>
            </td>
            <td class="p-3" data-label="إجراءات">
                <div class="flex gap-2">
                    <button class="text-blue-600 hover:text-blue-800 p-2 rounded hover:bg-blue-50" 
                            onclick="viewAccountDetails('${account.id}')" title="عرض">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${account.status === 'used' ? `
                        <button class="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50" 
                                onclick="viewLinkedOrder('${account.assigned_to_order}')" title="عرض الأوردر">
                            <i class="fas fa-link"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

async function calculateAccountStats() {
    try {
        const stats = await getAccountsStatistics(db);
        
        document.getElementById('accounts-total').textContent = stats.total;
        document.getElementById('accounts-available').textContent = stats.available;
        document.getElementById('accounts-used').textContent = stats.used;
        document.getElementById('accounts-damaged').textContent = stats.damaged;
        
    } catch (error) {
        console.error('Error calculating account stats:', error);
    }
}

function checkLowStock() {
    // Check if any product has low available accounts
    const lowStockProducts = [];
    const minThreshold = 5; // Minimum accounts threshold
    
    allProducts.forEach(product => {
        const availableAccounts = allAccounts.filter(a => 
            a.product_id === product.name && a.status === 'available'
        ).length;
        
        if (availableAccounts < minThreshold) {
            lowStockProducts.push({ product: product.name, count: availableAccounts });
        }
    });
    
    const alertsContainer = document.getElementById('low-stock-alerts');
    if (!alertsContainer) return;
    
    if (lowStockProducts.length > 0) {
        alertsContainer.classList.remove('hidden');
        alertsContainer.innerHTML = lowStockProducts.map(item => `
            <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
                <i class="fas fa-exclamation-triangle text-yellow-600 text-2xl"></i>
                <div>
                    <p class="font-semibold text-yellow-900">نقص في الأكونتات المتاحة!</p>
                    <p class="text-sm text-yellow-800">${item.product}: ${item.count} حسابات متاحة فقط</p>
                </div>
            </div>
        `).join('');
    } else {
        alertsContainer.classList.add('hidden');
    }
}

// ============================================
// DASHBOARD HOME - الصفحة الرئيسية
// ============================================

function initDashboardHome() {
    // Update dashboard stats
    updateDashboardStats();
    
    // Render charts
    renderDashboardCharts();
    
    // Render alerts
    renderDashboardAlerts();
    
    // Quick links
    document.querySelectorAll('[data-goto]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.dataset.goto;
            // Navigate to section (implement based on your tab system)
            console.log('Navigate to:', target);
        });
    });
    
    // Refresh button
    document.getElementById('dash-refresh-btn')?.addEventListener('click', () => {
        updateDashboardStats();
        renderDashboardCharts();
        renderDashboardAlerts();
        showToast('تم تحديث البيانات', 'success');
    });
}

function updateDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    
    // Active subscriptions
    const activeSubs = allSales.filter(s => s.subscription_end && new Date(s.subscription_end) > now).length;
    document.getElementById('dash-active-subs').textContent = activeSubs;
    
    // Today's sales
    const todaySales = allSales.filter(s => new Date(s.date) >= todayStart);
    const todayRevenue = todaySales.reduce((sum, s) => sum + (s.price || 0), 0);
    document.getElementById('dash-today-sales').textContent = `${todayRevenue} ريال`;
    
    // Week's sales
    const weekSales = allSales.filter(s => new Date(s.date) >= weekStart);
    const weekRevenue = weekSales.reduce((sum, s) => sum + (s.price || 0), 0);
    document.getElementById('dash-week-sales').textContent = `هذا الأسبوع: ${weekRevenue} ريال`;
    
    // Pending renewals (within 48 hours)
    const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));
    const pendingRenewals = allSales.filter(s => {
        if (!s.subscription_end) return false;
        const endDate = new Date(s.subscription_end);
        return endDate > now && endDate <= twoDaysFromNow;
    }).length;
    document.getElementById('dash-pending-renewals').textContent = pendingRenewals;
    
    // Accounts stats
    const availableAccounts = allAccounts.filter(a => a.status === 'available').length;
    const usedAccounts = allAccounts.filter(a => a.status === 'used').length;
    const damagedAccounts = allAccounts.filter(a => a.status === 'damaged').length;
    
    document.getElementById('dash-available-accounts').textContent = availableAccounts;
    document.getElementById('dash-used-accounts').textContent = usedAccounts;
    document.getElementById('dash-damaged-accounts').textContent = damagedAccounts;
    
    // Expenses
    const todayExpenses = allExpenses.filter(e => new Date(e.date) >= todayStart);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthExpenses = allExpenses.filter(e => new Date(e.date) >= monthStart);
    
    const todayExpTotal = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const monthExpTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    
    document.getElementById('dash-today-expenses').textContent = `${todayExpTotal} ريال`;
    document.getElementById('dash-month-expenses').textContent = `${monthExpTotal} ريال`;
    
    // Last update
    document.getElementById('dash-last-update').textContent = new Date().toLocaleTimeString('ar-EG');
}

function renderDashboardCharts() {
    // Sales line chart (last 7 days)
    const salesCtx = document.getElementById('dashSalesLineChart');
    if (salesCtx) {
        const last7Days = [];
        const salesData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const dayLabel = date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
            last7Days.push(dayLabel);
            
            const daySales = allSales.filter(s => {
                const saleDate = new Date(s.date);
                saleDate.setHours(0, 0, 0, 0);
                return saleDate.getTime() === date.getTime();
            });
            
            const dayRevenue = daySales.reduce((sum, s) => sum + (s.price || 0), 0);
            salesData.push(dayRevenue);
        }
        
        if (window.dashSalesChart) {
            window.dashSalesChart.destroy();
        }
        
        window.dashSalesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'المبيعات',
                    data: salesData,
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });
    }
    
    // Top products chart
    const topProductsCtx = document.getElementById('dashTopProductsChart');
    if (topProductsCtx) {
        const productRevenue = {};
        
        allSales.forEach(sale => {
            const product = sale.product || 'غير محدد';
            if (!productRevenue[product]) {
                productRevenue[product] = 0;
            }
            productRevenue[product] += (sale.price || 0);
        });
        
        const sorted = Object.entries(productRevenue)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const labels = sorted.map(item => item[0]);
        const data = sorted.map(item => item[1]);
        
        if (window.dashTopProductsChart) {
            window.dashTopProductsChart.destroy();
        }
        
        window.dashTopProductsChart = new Chart(topProductsCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'الإيرادات',
                    data,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.7)',
                        'rgba(34, 197, 94, 0.7)',
                        'rgba(251, 191, 36, 0.7)',
                        'rgba(239, 68, 68, 0.7)',
                        'rgba(168, 85, 247, 0.7)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

function renderDashboardAlerts() {
    const container = document.getElementById('dashboard-alerts-container');
    if (!container) return;
    
    const alerts = [];
    
    // Check for near-expiring subscriptions
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + (48 * 60 * 60 * 1000));
    const nearExpiring = allSales.filter(s => {
        if (!s.subscription_end) return false;
        const endDate = new Date(s.subscription_end);
        return endDate > now && endDate <= twoDaysFromNow;
    });
    
    if (nearExpiring.length > 0) {
        alerts.push({
            type: 'warning',
            icon: 'fa-exclamation-circle',
            title: 'اشتراكات قرب الانتهاء',
            message: `يوجد ${nearExpiring.length} اشتراك سينتهي خلال 48 ساعة`,
            color: 'yellow'
        });
    }
    
    // Check for low stock accounts
    allProducts.forEach(product => {
        const available = allAccounts.filter(a => 
            a.product_id === product.name && a.status === 'available'
        ).length;
        
        if (available < 5) {
            alerts.push({
                type: 'danger',
                icon: 'fa-exclamation-triangle',
                title: 'نقص في الأكونتات المتاحة',
                message: `${product.name}: ${available} حسابات متاحة فقط`,
                color: 'red'
            });
        }
    });
    
    // Check for unconfirmed orders
    const unconfirmed = allSales.filter(s => !s.isConfirmed);
    if (unconfirmed.length > 0) {
        alerts.push({
            type: 'info',
            icon: 'fa-info-circle',
            title: 'أوردرات غير مؤكدة',
            message: `يوجد ${unconfirmed.length} أوردر بحاجة للمراجعة والتأكيد`,
            color: 'blue'
        });
    }
    
    // Render alerts
    if (alerts.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">لا توجد تنبيهات حالياً</p>';
    } else {
        container.innerHTML = alerts.map(alert => `
            <div class="p-4 bg-${alert.color}-50 border border-${alert.color}-200 rounded-lg flex items-start gap-3">
                <i class="fas ${alert.icon} text-${alert.color}-600 text-xl mt-1"></i>
                <div>
                    <p class="font-semibold text-${alert.color}-900">${alert.title}</p>
                    <p class="text-sm text-${alert.color}-800 mt-1">${alert.message}</p>
                </div>
            </div>
        `).join('');
    }
}

// ============================================
// GLOBAL HELPERS - مساعدات عامة
// ============================================

// Make functions globally accessible
window.editExpense = (id) => console.log('Edit expense:', id);
window.deleteExpense = (id) => console.log('Delete expense:', id);
window.viewAccountDetails = (id) => console.log('View account:', id);
window.viewLinkedOrder = (id) => window.location.href = `order-details.html?id=${id}`;

// Export main initialization function
export default {
    initializeEnhancedFeatures
};
