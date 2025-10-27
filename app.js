import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, addDoc, deleteDoc, serverTimestamp, orderBy, updateDoc, runTransaction, writeBatch, getDocs, getDoc, enableIndexedDbPersistence, enableNetwork, disableNetwork } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initAuth, hasPermission, PERMISSIONS, logout, applyUIRestrictions, checkSectionAccess, showUnauthorizedAccessMessage } from './auth.js';
import { initUserManagement } from './users-management.js';

const firebaseConfig = {
    apiKey: "AIzaSyAmO9EZt_56rqEdBqxkyJW8ROZDWQ-LDAU",
    authDomain: "subpro-v2.firebaseapp.com",
    projectId: "subpro-v2",
    storageBucket: "subpro-v2.appspot.com",
    messagingSenderId: "314294327179",
    appId: "1:314294327179:web:96e01a22aab05e500bc18e"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Enable offline persistence for better reliability
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('تعذر تفعيل التخزين المؤقت: يوجد أكثر من تبويب مفتوح');
        } else if (err.code === 'unimplemented') {
            console.warn('المتصفح لا يدعم التخزين المؤقت');
        }
    });
} catch (err) {
    console.warn('خطأ في تفعيل التخزين المؤقت:', err);
}

// Connection state management
let isConnected = navigator.onLine;
let connectionRetryTimer = null;

// Monitor online/offline status
window.addEventListener('online', () => {
    console.log('اتصال الإنترنت متاح');
    isConnected = true;
    updateConnectionStatus(true);
    showNotification('تم استعادة الاتصال بالإنترنت', 'success');
    // Retry connection after coming back online
    if (connectionRetryTimer) clearTimeout(connectionRetryTimer);
    connectionRetryTimer = setTimeout(() => {
        location.reload();
    }, 1000);
});

window.addEventListener('offline', () => {
    console.log('فقد الاتصال بالإنترنت');
    isConnected = false;
    updateConnectionStatus(false);
    showNotification('تم فقد الاتصال بالإنترنت', 'danger');
});

// Global state variables
let allSales = [], allExpenses = [], allAccounts = [], allProducts = [], allProblems = [], allAdCampaigns = [];
let dateRangeStart = null, dateRangeEnd = null;
let expenseDateRangeStart = null, expenseDateRangeEnd = null;
let flatpickrInstance = null, expenseFlatpickrInstance = null, shiftDatePicker = null, adStartDatePicker = null, adEndDatePicker = null;
let currentSalesProductFilter = 'all';
let currentAccountsProductFilter = 'all';
let currentAccountsStatusFilter = 'all';
let currentStatusFilter = 'all';
let currentExpenseTypeFilter = 'all';
let currentRenewalFilter = 'all';
let currentAdProductFilter = 'all';
let monthlyChart, productProfitChart, expenseTypeChart, salesBySourceChart, traderAnalysisChart, adSpendChart, roasChart;
let isDarkMode = localStorage.getItem('darkMode') === 'true';
const PATH_SALES = 'sales', PATH_EXPENSES = 'expenses', PATH_ACCOUNTS = 'accounts', PATH_PRODUCTS = 'products', PATH_PROBLEMS = 'problems', PATH_AD_CAMPAIGNS = 'ad_campaigns';

// Shift definitions (24-hour format)
const SHIFTS = {
    NIGHT: { name: 'الشيفت الليلي', start: 0, end: 8, color: 'from-indigo-500 to-purple-600' },
    MORNING: { name: 'شيفت الصباح', start: 8, end: 16, color: 'from-yellow-500 to-orange-500' },
    EVENING: { name: 'الشيفت المسائي', start: 16, end: 24, color: 'from-blue-500 to-cyan-500' }
};

// --- UTILITY & SETUP FUNCTIONS ---
const setupChartDefaults = () => {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet');
        return;
    }
    Chart.defaults.font.family = "'Cairo', sans-serif";
    Chart.defaults.font.weight = '600';
    Chart.defaults.color = isDarkMode ? '#94a3b8' : '#64748b';
    Chart.defaults.plugins.tooltip.backgroundColor = isDarkMode ? '#334155' : '#1e293b';
    Chart.defaults.plugins.tooltip.titleFont = { size: 14, weight: 'bold' };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 4;
    Chart.defaults.plugins.legend.labels.color = isDarkMode ? '#f1f5f9' : '#1e293b';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
};

// Dark Mode Toggle
const toggleDarkMode = () => {
    isDarkMode = !isDarkMode;
    localStorage.setItem('darkMode', isDarkMode.toString());
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    const icon = document.querySelector('#dark-mode-toggle i');
    icon.className = isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    
    // Update chart colors
    setupChartDefaults();
    
    // Re-render charts if they exist
    if (monthlyChart) renderData();
};

// Initialize dark mode on load
const initDarkMode = () => {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        const icon = document.querySelector('#dark-mode-toggle i');
        if (icon) icon.className = 'fa-solid fa-sun';
    }
    
    const toggleBtn = document.getElementById('dark-mode-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleDarkMode);
    }
};

const showNotification = (message, type = 'success') => {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'show';
    notification.classList.remove('bg-success', 'bg-danger', 'bg-info');
    if (type === 'success') notification.classList.add('bg-success');
    else if (type === 'danger') notification.classList.add('bg-danger');
    else if (type === 'info') notification.classList.add('bg-info');
    setTimeout(() => { notification.classList.remove('show'); }, 3000);
};

// Update connection status indicator in UI
const updateConnectionStatus = (connected) => {
    // Create or update connection status indicator if it doesn't exist
    let statusIndicator = document.getElementById('connection-status');
    
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'connection-status';
        statusIndicator.style.cssText = `
            position: fixed;
            top: 80px;
            left: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(statusIndicator);
    }
    
    if (connected) {
        statusIndicator.style.backgroundColor = '#10b981';
        statusIndicator.style.color = 'white';
        statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i> متصل';
        // Auto-hide after 3 seconds when connected
        setTimeout(() => {
            statusIndicator.style.opacity = '0';
        }, 3000);
    } else {
        statusIndicator.style.backgroundColor = '#ef4444';
        statusIndicator.style.color = 'white';
        statusIndicator.style.opacity = '1';
        statusIndicator.innerHTML = '<i class="fas fa-exclamation-circle"></i> غير متصل';
    }
};

// Handle Firebase errors with user-friendly messages
const handleFirebaseError = (error, operation = 'العملية') => {
    console.error(`خطأ في ${operation}:`, error);
    
    let errorMessage = `حدث خطأ في ${operation}`;
    
    // Check for common Firebase error codes
    if (error.code === 'unavailable' || error.code === 'failed-precondition') {
        errorMessage = 'فقد الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
        updateConnectionStatus(false);
    } else if (error.code === 'permission-denied') {
        errorMessage = 'ليس لديك صلاحية لتنفيذ هذه العملية.';
    } else if (error.code === 'not-found') {
        errorMessage = 'البيانات المطلوبة غير موجودة.';
    } else if (error.code === 'already-exists') {
        errorMessage = 'البيانات موجودة بالفعل.';
    } else if (error.code === 'resource-exhausted') {
        errorMessage = 'تم تجاوز الحد المسموح. حاول مرة أخرى لاحقاً.';
    } else if (error.code === 'cancelled') {
        errorMessage = 'تم إلغاء العملية.';
    } else if (error.code === 'unauthenticated') {
        errorMessage = 'يرجى تسجيل الدخول مرة أخرى.';
    } else if (!navigator.onLine) {
        errorMessage = 'لا يوجد اتصال بالإنترنت.';
        updateConnectionStatus(false);
    } else if (error.message) {
        // Include the actual error message for debugging
        console.error('تفاصيل الخطأ:', error.message);
    }
    
    showNotification(errorMessage, 'danger');
    return errorMessage;
};

const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => showNotification('تم النسخ بنجاح!', 'info'))
            .catch(() => showNotification('فشل النسخ', 'danger'));
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('تم النسخ بنجاح!', 'info');
        } catch (err) {
            showNotification('فشل النسخ', 'danger');
        }
        document.body.removeChild(textArea);
    }
};

const calculateExpiryDate = (startDate, subscription) => {
    if (!startDate?.seconds || !subscription || subscription === 'Lifetime') return null;
    const start = new Date(startDate.seconds * 1000);
    const expiry = new Date(start);
    
    if (subscription.includes('Month')) {
        const months = parseInt(subscription.match(/\d+/)?.[0] || 1);
        // Add 30 days per month instead of calendar months
        expiry.setDate(start.getDate() + (months * 30));
    } else if (subscription.includes('Year')) {
        const years = parseInt(subscription.match(/\d+/)?.[0] || 1);
        expiry.setDate(start.getDate() + (years * 365));
    } else { return null; }
    return expiry;
};

const calculateDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

// --- DATA RENDERING LOGIC ---
const renderData = () => {
    let salesToDisplay = [...allSales];
    let expensesToDisplay = [...allExpenses];
    let accountsToDisplay = [...allAccounts];

    // Date filtering
    if (dateRangeStart && dateRangeEnd) {
        salesToDisplay = salesToDisplay.filter(s => {
            const saleDate = s.date?.seconds ? new Date(s.date.seconds * 1000) : null;
            return saleDate && saleDate >= dateRangeStart && saleDate <= dateRangeEnd;
        });
         expensesToDisplay = expensesToDisplay.filter(e => {
            const expenseDate = e.date?.seconds ? new Date(e.date.seconds * 1000) : null;
            return expenseDate && expenseDate >= dateRangeStart && expenseDate <= dateRangeEnd;
        });
    }
    
    // Sales specific filters
    if(currentSalesProductFilter !== 'all'){
        salesToDisplay = salesToDisplay.filter(s => s.productName === currentSalesProductFilter);
    }
    if (currentStatusFilter === 'unconfirmed') {
        salesToDisplay = salesToDisplay.filter(s => !s.isConfirmed);
    }

    // Accounts specific filters
    if(currentAccountsProductFilter !== 'all'){
        accountsToDisplay = accountsToDisplay.filter(a => a.productName === currentAccountsProductFilter);
    }
    if(currentAccountsStatusFilter !== 'all'){
        accountsToDisplay = accountsToDisplay.filter(a => {
            if (currentAccountsStatusFilter === 'available') {
                return a.is_active && a.current_uses < a.allowed_uses;
            } else if (currentAccountsStatusFilter === 'unavailable') {
                return !a.is_active || a.current_uses >= a.allowed_uses;
            } else if (currentAccountsStatusFilter === 'inactive') {
                return !a.is_active;
            } else if (currentAccountsStatusFilter === 'completed') {
                return a.current_uses >= a.allowed_uses && a.allowed_uses !== Infinity;
            }
            return true;
        });
    }
    
    // Expenses specific filters
    if(expenseDateRangeStart && expenseDateRangeEnd) {
        expensesToDisplay = expensesToDisplay.filter(e => {
            const expenseDate = e.date?.seconds ? new Date(e.date.seconds * 1000) : null;
            return expenseDate && expenseDate >= expenseDateRangeStart && expenseDate <= expenseDateRangeEnd;
        });
    }
    if(currentExpenseTypeFilter !== 'all'){
        expensesToDisplay = expensesToDisplay.filter(e => e.type === currentExpenseTypeFilter);
    }

    // Update all relevant UI components
    updateDashboard(salesToDisplay, expensesToDisplay, allSales, allProblems, allAccounts);
    updateReports(salesToDisplay, expensesToDisplay, allAccounts);
    updateSalesTable(salesToDisplay);
    renderRenewalsTab(); // New function for renewals
    updateProblemsTable(allProblems);
    updateAccountsTable(accountsToDisplay);
    updateExpensesTable(expensesToDisplay);
    populateProductFilterButtons();
    updateProductStatistics(); // New detailed statistics per product
};

// --- UI UPDATE FUNCTIONS ---
const updateDashboard = (salesData, expensesData, allSalesData, allProblemsData, allAccountsData) => {
    const confirmedSales = salesData.filter(sale => sale.isConfirmed);

    const totalRevenue = confirmedSales.reduce((sum, sale) => sum + (sale.sellingPrice || 0), 0);
    const totalProductCost = confirmedSales.reduce((sum, sale) => sum + (sale.costPrice || 0), 0);
    const totalAdSpend = expensesData.filter(exp => exp.type === 'إعلان').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalOtherExpenses = expensesData.filter(exp => exp.type !== 'إعلان').reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalExpenses = totalProductCost + totalAdSpend + totalOtherExpenses;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
    const roas = totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) : '0.00';
    
    const totalSalesCount = confirmedSales.length;
    const profitPerOrder = totalSalesCount > 0 ? (netProfit / totalSalesCount) : 0;
    const totalUnconfirmedOrders = allSalesData.filter(s => !s.isConfirmed).length;
    const totalAccountsCount = allAccountsData.length;
    const problemRate = allSalesData.length > 0 ? ((allProblemsData.length / allSalesData.length) * 100).toFixed(1) : 0;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0,0,0,0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailySalesCount = allSalesData.filter(s => (s.date?.seconds * 1000) >= startOfDay.getTime()).length;
    const weeklySalesCount = allSalesData.filter(s => (s.date?.seconds * 1000) >= startOfWeek.getTime()).length;
    const monthlySalesCount = allSalesData.filter(s => (s.date?.seconds * 1000) >= startOfMonth.getTime()).length;

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    endOfPrevMonth.setHours(23,59,59,999);
    
    const prevMonthSales = allSalesData.filter(s => s.isConfirmed && (s.date?.seconds * 1000) >= startOfPrevMonth.getTime() && (s.date?.seconds * 1000) <= endOfPrevMonth.getTime());
    const prevMonthExpenses = allExpenses.filter(e => (e.date?.seconds * 1000) >= startOfPrevMonth.getTime() && (e.date?.seconds * 1000) <= endOfPrevMonth.getTime());
    const prevMonthRevenue = prevMonthSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
    const prevMonthCost = prevMonthSales.reduce((sum, s) => sum + (s.costPrice || 0), 0) + prevMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const prevMonthNetProfit = prevMonthRevenue - prevMonthCost;
    
    let monthlyGrowth = 0;
    if (prevMonthNetProfit !== 0) {
         monthlyGrowth = ((netProfit - prevMonthNetProfit) / Math.abs(prevMonthNetProfit) * 100);
    } else if (netProfit > 0) {
        monthlyGrowth = 100;
    }
    const growthIcon = monthlyGrowth >= 0 ? 'fa-arrow-trend-up text-green-300' : 'fa-arrow-trend-down text-red-300';
    const profitGradient = netProfit >= 0 ? 'from-green-400 to-emerald-500' : 'from-red-400 to-rose-500';
    
    document.getElementById('dashboard-content').innerHTML = `
        <!-- Row 1: Main Stats -->
        <div class="col-span-12 lg:col-span-6 stat-card bg-gradient-to-br ${profitGradient}">
            <p class="font-bold text-lg text-white/90">الربح الصافي</p>
            <p class="text-xs text-white/70">Net Profit</p>
            <p class="text-5xl font-extrabold mt-2">EGP ${netProfit.toFixed(2)}</p>
        </div>
        <div class="col-span-12 lg:col-span-6 stat-card bg-gradient-to-br from-indigo-500 to-purple-500">
            <p class="font-bold text-lg text-white/90">إجمالي الدخل</p>
            <p class="text-xs text-white/70">Total Revenue</p>
            <p class="text-5xl font-extrabold mt-2">EGP ${totalRevenue.toFixed(2)}</p>
        </div>

        <!-- Row 2 -->
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-teal-500 to-cyan-500">
            <p class="font-semibold text-white/90">Profit per Order</p>
            <p class="text-xs text-white/70">متوسط الربح لكل أوردر</p>
            <p class="text-3xl font-bold mt-2">EGP ${profitPerOrder.toFixed(2)}</p>
        </div>
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-yellow-500 to-orange-500">
            <p class="font-semibold text-white/90">هامش الربح</p>
            <p class="text-xs text-white/70">Profit Margin</p>
            <p class="text-3xl font-bold mt-2">${profitMargin}%</p>
        </div>
         <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-purple-500 to-pink-500">
            <p class="font-semibold text-white/90">العائد على الإعلانات</p>
            <p class="text-xs text-white/70">ROAS</p>
            <p class="text-3xl font-bold mt-2">${roas}x</p>
        </div>

        <!-- Row 3 -->
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-green-500 to-lime-500">
            <p class="font-semibold text-white/90">الأوردرات المؤكدة</p>
            <p class="text-xs text-white/70">Confirmed Orders</p>
            <p class="text-3xl font-bold mt-2">${totalSalesCount}</p>
        </div>
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-amber-500 to-yellow-600">
            <p class="font-semibold text-white/90">الأوردرات غير المؤكدة</p>
            <p class="text-xs text-white/70">Unconfirmed Orders</p>
            <p class="text-3xl font-bold mt-2">${totalUnconfirmedOrders}</p>
        </div>
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-blue-500 to-teal-500">
            <p class="font-semibold text-white/90">إجمالي الأكونتات</p>
            <p class="text-xs text-white/70">Total Accounts</p>
            <p class="text-3xl font-bold mt-2">${totalAccountsCount}</p>
        </div>
        
        <!-- Row 4 -->
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-red-500 to-rose-500">
            <p class="font-semibold text-white/90">إجمالي المصروفات</p>
            <p class="text-xs text-white/70">Total Expenses</p>
            <p class="text-3xl font-bold mt-2">EGP ${totalExpenses.toFixed(2)}</p>
        </div>
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-sky-500 to-cyan-500">
            <p class="font-semibold text-white/90">مصاريف الإعلانات</p>
            <p class="text-xs text-white/70">Ad Spend</p>
            <p class="text-3xl font-bold mt-2">EGP ${totalAdSpend.toFixed(2)}</p>
        </div>
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-indigo-500 to-purple-600">
            <p class="font-semibold text-white/90">معدل المشاكل</p>
            <p class="text-xs text-white/70">Problem Rate</p>
            <p class="text-3xl font-bold mt-2">${problemRate}%</p>
        </div>
        
        <!-- Row 5 -->
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-orange-400 to-amber-500">
            <p class="font-semibold text-white/90">مبيعات اليوم</p>
            <p class="text-xs text-white/70">Daily Sales</p>
            <p class="text-3xl font-bold mt-2">${dailySalesCount}</p>
        </div>
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-orange-400 to-amber-500">
            <p class="font-semibold text-white/90">مبيعات الأسبوع</p>
            <p class="text-xs text-white/70">Weekly Sales</p>
            <p class="text-3xl font-bold mt-2">${weeklySalesCount}</p>
        </div>
        <div class="col-span-12 md:col-span-6 lg:col-span-4 stat-card bg-gradient-to-br from-orange-400 to-amber-500">
            <p class="font-semibold text-white/90">مبيعات الشهر</p>
            <p class="text-xs text-white/70">Monthly Sales</p>
            <p class="text-3xl font-bold mt-2">${monthlySalesCount}</p>
        </div>
    `;
};

const updateSalesTable = (salesData) => {
    const salesContainer = document.getElementById('sales-list-container');
    salesContainer.innerHTML = '';
    const bulkActionsContainer = document.getElementById('bulk-actions-container');
    
    const unconfirmedCount = allSales.filter(s => !s.isConfirmed).length;
    const unconfirmedBtn = document.querySelector('#sales-status-filter-container button[data-status="unconfirmed"]');
    if (unconfirmedBtn) {
        unconfirmedBtn.innerHTML = `<i class="fa-solid fa-hourglass-half mr-1"></i> غير مؤكد <span class="bg-yellow-200 text-yellow-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">${unconfirmedCount}</span>`;
    }

    if (salesData.length === 0) {
        salesContainer.innerHTML = `<p class="text-center py-10 text-gray-500">لا توجد مبيعات لعرضها.</p>`;
        bulkActionsContainer.classList.add('hidden');
        return;
    }

    const unconfirmedSalesExist = salesData.some(sale => !sale.isConfirmed);
    if (unconfirmedSalesExist) {
        bulkActionsContainer.classList.remove('hidden');
        document.getElementById('select-all-checkbox').checked = false;
        document.getElementById('bulk-confirm-count').textContent = '0';
        document.getElementById('bulk-confirm-btn').classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        bulkActionsContainer.classList.add('hidden');
    }
    
    const fullSalesList = [...allSales].sort((a,b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
    const groupedSales = salesData.sort((a,b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)).reduce((acc, sale) => {
        const dateString = new Date(sale.date?.seconds * 1000).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
        if (!acc[dateString]) acc[dateString] = [];
        acc[dateString].push(sale);
        return acc;
    }, {});

    const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
    for (const dateString in groupedSales) {
        let displayDate = dateString;
        if (dateString === today) displayDate = 'اليوم';
        else if (dateString === yesterday) displayDate = 'الأمس';
        const dateSeparator = document.createElement('div');
        dateSeparator.className = 'date-separator';
        dateSeparator.innerHTML = `<span>${displayDate}</span>`;
        salesContainer.appendChild(dateSeparator);
        groupedSales[dateString].forEach(sale => {
            const orderIndex = fullSalesList.findIndex(s => s.id === sale.id);
            const orderNumber = fullSalesList.length - orderIndex;
            const sellingPrice = sale.sellingPrice || 0;
            const costPrice = sale.costPrice || 0;
            const profit = sellingPrice - costPrice;
            const expiryDate = calculateExpiryDate(sale.date, sale.subscription);
            const daysRemaining = calculateDaysRemaining(expiryDate);
            const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-';

            let status = { text: '-', bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
            if (sale.subscription === 'Lifetime') { status = { text: 'مدى الحياة', bgColor: 'bg-sky-100', textColor: 'text-sky-800' }; }
            else if (expiryDate) {
                if (new Date() > expiryDate) { status = { text: 'منتهي', bgColor: 'bg-red-100', textColor: 'text-red-800' }; }
                else { status = { text: 'ساري', bgColor: 'bg-green-100', textColor: 'text-green-800' }; }
            }

            const confirmationStatus = sale.isConfirmed 
                ? { text: 'مؤكد', bgColor: 'bg-green-100', textColor: 'text-green-800' }
                : { text: 'غير مؤكد', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
            
            const actionButtonHTML = !sale.isConfirmed
                ? `<button data-id="${sale.id}" class="confirm-sale-btn confirm-btn text-sm">تأكيد <i class="fa-solid fa-check ml-1"></i></button>`
                : '';
            
            const checkboxHTML = !sale.isConfirmed
                ? `<input type="checkbox" data-id="${sale.id}" class="sale-checkbox h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer">`
                : `<div class="w-5 h-5"></div>`;
                
            let daysRemainingText = '-';
            let daysRemainingColor = 'text-gray-800';
            if (daysRemaining !== null && sale.subscription !== 'Lifetime') {
                if (daysRemaining < 0) {
                    daysRemainingText = 'منتهي';
                    daysRemainingColor = 'text-red-600 font-bold';
                } else if (daysRemaining <= 7) {
                    daysRemainingText = `${daysRemaining} يوم`;
                    daysRemainingColor = 'text-yellow-600 font-bold';
                } else {
                    daysRemainingText = `${daysRemaining} يوم`;
                    daysRemainingColor = 'text-green-600';
                }
            }

            const card = document.createElement('div');
            card.className = 'main-card mb-4 border border-gray-200';
            card.dataset.saleId = sale.id;
            card.innerHTML = `
                <div class="flex items-center justify-between gap-4 p-4 border-b border-gray-200">
                    <div class="flex items-center gap-3 flex-wrap">
                        <span class="text-sm font-bold text-gray-400">#${orderNumber}</span>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${confirmationStatus.bgColor} ${confirmationStatus.textColor}">${confirmationStatus.text}</span>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${status.bgColor} ${status.textColor}">${status.text}</span>
                        <span class="text-sm font-medium text-gray-500">${saleDate}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        ${checkboxHTML}
                        ${actionButtonHTML}
                    </div>
                </div>

                <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    <div class="profit-card-sale">
                        <i class="fa-regular fa-user text-xl text-gray-400 mb-2"></i>
                        <h4 class="font-semibold text-gray-500">العميل</h4>
                        <p class="text-lg font-bold text-gray-800 copyable cursor-pointer" data-copy-text="${sale.contactInfo || ''}">${sale.contactInfo || '-'}</p>
                    </div>
                    <div class="profit-card-sale">
                        <i class="fa-solid fa-at text-xl text-gray-400 mb-2"></i>
                        <h4 class="font-semibold text-gray-500">بيانات الحساب</h4>
                        <p class="text-lg font-bold text-gray-800 copyable cursor-pointer break-all" data-copy-text="${sale.customerEmail || ''}">${sale.customerEmail || '-'}</p>
                        <p class="text-sm font-semibold text-gray-600 copyable cursor-pointer mt-1" data-copy-text="${sale.password || ''}">Pass: ${sale.password || '(غير مسجل)'}</p>
                    </div>
                    <div class="profit-card-sale">
                        <i class="fa-solid fa-id-card-clip text-xl text-gray-400 mb-2"></i>
                        <h4 class="font-semibold text-gray-500">نوع الحساب</h4>
                        <p class="text-lg font-bold text-gray-800">${sale.accountType || '-'}</p>
                    </div>
                    <div class="profit-card-sale">
                        <i class="fa-solid fa-cubes text-xl text-gray-400 mb-2"></i>
                        <h4 class="font-semibold text-gray-500">المنتج</h4>
                        <p class="text-lg font-bold text-gray-800">${sale.productName || '-'}</p>
                    </div>
                    <div class="profit-card-sale">
                        <i class="fa-solid fa-calendar-alt text-xl text-gray-400 mb-2"></i>
                        <h4 class="font-semibold text-gray-500">الاشتراك</h4>
                         <p class="text-lg font-bold text-gray-800">${sale.subscription || '-'}</p>
                        <p class="text-sm text-gray-600 mt-1">
                            ${expiryDate ? expiryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'مدى الحياة'}
                        </p>
                    </div>
                     <div class="profit-card-sale">
                        <i class="fa-solid fa-hourglass-half text-xl text-gray-400 mb-2"></i>
                        <h4 class="font-semibold text-gray-500">الأيام المتبقية</h4>
                        <p class="text-lg ${daysRemainingColor}">
                            ${daysRemainingText}
                        </p>
                    </div>
                </div>

                <div class="p-4 flex flex-wrap justify-center items-center gap-6 border-t border-gray-200 mt-4">
                    <div class="text-center">
                        <span class="text-sm text-gray-500">سعر البيع</span>
                        <p class="text-2xl font-extrabold text-gray-800">${sellingPrice.toFixed(2)} EGP</p>
                    </div>
                    <div class="text-center">
                        <span class="text-sm text-gray-500">التكلفة</span>
                        <p class="text-2xl font-extrabold text-gray-800">${costPrice.toFixed(2)} EGP</p>
                    </div>
                    <div class="text-center">
                        <span class="text-sm text-gray-500">الربح الصافي</span>
                        <p class="text-2xl font-extrabold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}">${profit.toFixed(2)} EGP</p>
                    </div>
                    <div class="flex gap-4 items-center">
                        <button data-id="${sale.id}" class="edit-sale-btn text-blue-500 hover:text-blue-700 font-semibold text-sm">
                            <i class="fa-solid fa-edit ml-1"></i>تعديل
                        </button>
                        <button data-id="${sale.id}" class="delete-sale-btn text-red-500 hover:text-red-700 font-semibold text-sm">
                            <i class="fa-solid fa-trash ml-1"></i>حذف
                        </button>
                    </div>
                </div>
            `;
            salesContainer.appendChild(card);
        });
    }
};

const renderRenewalsTab = () => {
    const container = document.getElementById('renewals-list-container');
    const countBadge = document.getElementById('renewals-count');
    
    const renewalCandidates = allSales.filter(sale => {
        if (!sale.isConfirmed || sale.subscription === 'Lifetime' || sale.renewalStatus === 'renewed' || sale.renewalStatus === 'not-renewed') {
            return false;
        }
        const expiryDate = calculateExpiryDate(sale.date, sale.subscription);
        if (!expiryDate) return false;

        const daysRemaining = calculateDaysRemaining(expiryDate);
        return daysRemaining <= 7;
    }).sort((a, b) => {
        const expiryA = calculateExpiryDate(a.date, a.subscription);
        const expiryB = calculateExpiryDate(b.date, b.subscription);
        return expiryA - expiryB;
    });

    if (renewalCandidates.length > 0) {
        countBadge.textContent = renewalCandidates.length;
        countBadge.classList.remove('hidden');
    } else {
        countBadge.classList.add('hidden');
    }

    if (renewalCandidates.length === 0) {
        container.innerHTML = `<p class="text-center py-10 text-gray-500">لا توجد اشتراكات تحتاج إلى تنبيه بالتجديد حاليًا.</p>`;
        return;
    }

    container.innerHTML = renewalCandidates.map(sale => {
        const expiryDate = calculateExpiryDate(sale.date, sale.subscription);
        const daysRemaining = calculateDaysRemaining(expiryDate);
        const statusText = daysRemaining < 0 ? `منتهي منذ ${Math.abs(daysRemaining)} يوم` : `متبقي ${daysRemaining} يوم`;
        
        let statusColor = 'text-gray-800';
        if (daysRemaining <= 0) statusColor = 'text-red-600';
        else if (daysRemaining <= 7) statusColor = 'text-yellow-600';
        
        let renewalStatusHTML = '';
        if(sale.renewalStatus === 'alerted'){
            renewalStatusHTML = `<span class="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800"><i class="fa-solid fa-check-double ml-2"></i>تم التنبيه</span>`;
        }

        return `
            <div class="main-card mb-4">
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                     <div>
                        <h4 class="text-sm text-gray-500">العميل</h4>
                        <p class="font-bold text-lg copyable cursor-pointer" data-copy-text="${sale.contactInfo || ''}">${sale.contactInfo || '-'}</p>
                    </div>
                    <div>
                        <h4 class="text-sm text-gray-500">الإيميل</h4>
                        <p class="font-bold text-lg copyable cursor-pointer break-all" data-copy-text="${sale.customerEmail || ''}">${sale.customerEmail || '-'}</p>
                    </div>
                     <div>
                        <h4 class="text-sm text-gray-500">المنتج</h4>
                        <p class="font-semibold text-gray-700">${sale.productName}</p>
                    </div>
                    <div>
                        <h4 class="text-sm text-gray-500">حالة الاشتراك</h4>
                        <p class="font-bold ${statusColor}">${statusText}</p>
                    </div>
                </div>
                <div class="bg-gray-50 p-3 flex flex-wrap justify-end items-center gap-3">
                    ${renewalStatusHTML}
                    <button data-id="${sale.id}" data-action="alerted" class="renewal-action-btn text-sm font-semibold py-1 px-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                        <i class="fa-solid fa-bell ml-1"></i> تم التنبيه
                    </button>
                    <button data-id="${sale.id}" data-action="renewed" class="renewal-action-btn text-sm font-semibold py-1 px-3 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors">
                        <i class="fa-solid fa-arrows-rotate ml-1"></i> جدد
                    </button>
                    <button data-id="${sale.id}" data-action="not-renewed" class="renewal-action-btn text-sm font-semibold py-1 px-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors">
                        <i class="fa-solid fa-xmark ml-1"></i> لم يجدد
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

const updateProblemsTable = (problemsData) => {
    const problemsContainer = document.getElementById('problems-list-container');
    problemsContainer.innerHTML = '';
    if (problemsData.length === 0) {
        problemsContainer.innerHTML = `<p class="text-center py-10 text-gray-500">لا توجد مشاكل مُسجلة حاليًا.</p>`;
        return;
    }
    
    problemsData.forEach(problem => {
        const originalSale = allSales.find(sale => sale.id === problem.saleId) || {};
        const problemDate = problem.date?.seconds ? new Date(problem.date.seconds * 1000).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-';
        
        const originalAccount = allAccounts.find(acc => acc.id === problem.originalAccountId) || {};
        const replacementAccount = allAccounts.find(acc => acc.id === problem.replacementAccountId) || {};
        
        const card = document.createElement('div');
        card.className = 'main-card mb-4 p-4 border border-gray-200';
        card.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
                <div>
                    <p class="text-sm font-medium text-gray-500">مشكلة بتاريخ: ${problemDate}</p>
                    <p class="text-lg font-bold text-gray-800 mt-1">العميل: ${originalSale.contactInfo || '-'}</p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="profit-card-sale">
                    <i class="fa-solid fa-bug text-xl text-gray-400 mb-2"></i>
                    <h4 class="font-semibold text-gray-500">الأكونت الأصلي (المشكلة)</h4>
                    <p class="text-lg font-bold text-gray-800 copyable cursor-pointer" data-copy-text="${originalAccount.email || ''}">${originalAccount.email || '-'}</p>
                </div>
                <div class="profit-card-sale">
                    <i class="fa-solid fa-comment-dots text-xl text-gray-400 mb-2"></i>
                    <h4 class="font-semibold text-gray-500">التفاصيل</h4>
                    <p class="text-sm font-medium text-gray-800">${problem.description || '-'}</p>
                </div>
                <div class="profit-card-sale">
                    <i class="fa-solid fa-arrows-rotate text-xl text-gray-400 mb-2"></i>
                    <h4 class="font-semibold text-gray-500">الأكونت البديل</h4>
                    <p class="text-lg font-bold text-gray-800 copyable cursor-pointer" data-copy-text="${replacementAccount.email || ''}">${replacementAccount.email || '-'}</p>
                </div>
            </div>
        `;
        problemsContainer.appendChild(card);
    });
};

const updateAccountsTable = (accountsData) => {
     const table = document.getElementById('accounts-table');
     table.innerHTML = ''; 
     if (accountsData.length === 0) { table.innerHTML = `<tbody><tr><td colspan="8" class="text-center py-10 text-gray-500">لا توجد أكونتات لعرضها.</td></tr></tbody>`; return; }
     const thead = document.createElement('thead');
     thead.className = 'bg-gray-100';
     thead.innerHTML = `<tr><th class="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">تاريخ الشراء</th><th class="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">الإيميل</th><th class="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">المنتج</th><th class="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">التاجر</th><th class="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">التكلفة</th><th class="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">الاستخدام</th><th class="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase">الحالة</th><th class="px-3 py-3"></th></tr>`;
     table.appendChild(thead);
     const tbody = document.createElement('tbody');
     tbody.className = 'bg-white divide-y divide-gray-200';
     accountsData.forEach(acc => {
         const row = document.createElement('tr');
         let statusHTML, usageDisplayHTML;
         if (!acc.is_active) { statusHTML = `<div class="flex items-center"><span class="h-2 w-2 ml-2 rounded-full bg-red-500"></span><span>غير نشط</span></div>`; }
         else if (acc.current_uses >= acc.allowed_uses && acc.allowed_uses !== Infinity) { statusHTML = `<div class="flex items-center"><span class="h-2 w-2 ml-2 rounded-full bg-green-500"></span><span>مكتمل</span></div>`; }
         else if (acc.current_uses > 0) { statusHTML = `<div class="flex items-center"><span class="h-2 w-2 ml-2 rounded-full bg-yellow-500"></span><span>مستخدم</span></div>`; }
         else { statusHTML = `<div class="flex items-center"><span class="h-2 w-2 ml-2 rounded-full bg-sky-500"></span><span>جديد</span></div>`; }
         if (acc.allowed_uses === Infinity) { usageDisplayHTML = `<span class="font-semibold">${acc.current_uses} / ∞</span>`; }
         else if (acc.allowed_uses > 0) {
             const percentage = Math.min(100, Math.round((acc.current_uses / acc.allowed_uses) * 100));
             let barColor = percentage >= 100 ? 'bg-green-500' : (percentage === 0 ? 'bg-sky-500' : 'bg-yellow-500');
             usageDisplayHTML = `<div class="flex items-center w-full"><span class="text-sm font-medium text-gray-700 ml-3 w-16">${acc.current_uses} / ${acc.allowed_uses}</span><div class="w-full bg-gray-200 rounded-full h-2.5"><div class="${barColor} h-2.5 rounded-full" style="width: ${percentage}%"></div></div><span class="text-sm font-medium text-gray-700 mr-2 w-10 text-left">${percentage}%</span></div>`;
         } else { usageDisplayHTML = '<span>-</span>'; }
         const purchaseDate = acc.purchase_date?.seconds ? new Date(acc.purchase_date.seconds * 1000).toLocaleDateString('ar-EG') : 'غير محدد';
         row.innerHTML = `<td data-label="تاريخ الشراء" class="text-gray-600">${purchaseDate}</td><td data-label="الإيميل" class="font-bold text-gray-800">${acc.email}</td><td data-label="المنتج" class="text-gray-800">${acc.productName || '-'}</td><td data-label="التاجر" class="text-gray-600">${acc.trader_name}</td><td data-label="التكلفة" class="font-semibold text-gray-700">${(acc.purchase_price || 0).toFixed(2)}</td><td data-label="الاستخدام">${usageDisplayHTML}</td><td data-label="الحالة">${statusHTML}</td><td data-label="إجراءات"><div class="flex gap-4 justify-end"><button data-id="${acc.id}" class="edit-account-btn text-blue-500 hover:text-blue-700 font-semibold">تعديل</button><button data-id="${acc.id}" class="delete-account-btn text-red-500 hover:text-red-700 font-semibold">حذف</button></div></td>`;
         tbody.appendChild(row);
     });
     table.appendChild(tbody);
};

const updateExpensesTable = (expensesData) => {
     const table = document.getElementById('expenses-table');
     table.innerHTML = ''; 
     const thead = document.createElement('thead');
     thead.className = 'bg-gray-50';
     thead.innerHTML = `<tr><th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th><th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">النوع</th><th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">الفئة</th><th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">الوصف</th><th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th><th class="px-4 py-2"></th></tr>`;
     table.appendChild(thead);
     const tbody = document.createElement('tbody');
     tbody.className = 'bg-white';
     if (expensesData.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-500">لا توجد مصروفات لعرضها.</td></tr>`; }
     else {
         const typeStyles = { 'إعلان': { icon: 'fa-solid fa-bullhorn', color: 'bg-red-100 text-red-800' }, 'اشتراكات تطبيقات': { icon: 'fa-solid fa-credit-card', color: 'bg-blue-100 text-blue-800' }, 'مصاريف أخرى': { icon: 'fa-solid fa-receipt', color: 'bg-yellow-100 text-yellow-800' } };
          expensesData.forEach(expense => {
              const row = document.createElement('tr');
              const style = typeStyles[expense.type] || typeStyles['مصاريف أخرى'];
              const expenseDate = expense.customDate || expense.date;
              row.innerHTML = `<td data-label="التاريخ" class="px-4 py-3 text-gray-600">${new Date(expenseDate?.seconds * 1000).toLocaleDateString('ar-EG')}</td><td data-label="النوع" class="px-4 py-3"><span class="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${style.color}"><i class="${style.icon} ml-2"></i>${expense.type}</span></td><td data-label="الفئة" class="px-4 py-3 text-gray-600">${expense.category || '-'}</td><td data-label="الوصف" class="px-4 py-3 text-gray-600">${expense.description || '-'}</td><td data-label="المبلغ" class="px-4 py-3 font-semibold text-gray-900">${(expense.amount || 0).toFixed(2)}</td><td data-label="إجراءات" class="px-4 py-3 text-left"><div class="flex gap-2"><button data-id="${expense.id}" class="edit-expense-btn text-blue-500 hover:text-blue-700 font-semibold">تعديل</button><button data-id="${expense.id}" class="delete-expense-btn text-red-500 hover:text-red-700 font-semibold">حذف</button></div></td>`;
              tbody.appendChild(row);
          });
     }
     table.appendChild(tbody);
     const tfoot = document.createElement('tfoot');
     tfoot.className = 'bg-gray-50';
     const totalExpenses = expensesData.reduce((sum, exp) => sum + (exp.amount || 0), 0);
     tfoot.innerHTML = `<tr class="border-t-2 border-gray-200"><td colspan="4" class="px-4 py-2 text-right font-bold text-gray-800">الإجمالي</td><td id="expenses-total" class="px-4 py-2 font-bold text-gray-800">EGP ${totalExpenses.toFixed(2)}</td><td></td></tr>`;
     table.appendChild(tfoot);
};

const updateReports = (salesData, expensesData, accountsData) => {
    const confirmedSales = salesData.filter(s => s.isConfirmed);
    const monthlyData = {};
    const processEntry = (date, amount, type) => {
        if (!date || !date.seconds) return;
        const month = new Date(date.seconds * 1000).toISOString().slice(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0, profit: 0 };
        }
        if(type === 'revenue') monthlyData[month].revenue += amount;
        else if (type === 'expense') monthlyData[month].expenses += amount;
    };
    confirmedSales.forEach(s => processEntry(s.date, s.sellingPrice, 'revenue'));
    expensesData.forEach(e => processEntry(e.date, e.amount, 'expense'));
    confirmedSales.forEach(s => processEntry(s.date, s.costPrice, 'expense'));
    Object.keys(monthlyData).forEach(month => {
        monthlyData[month].profit = monthlyData[month].revenue - monthlyData[month].expenses;
    });
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthlyLabels = sortedMonths.map(m => new Date(m + '-02').toLocaleString('ar-EG', {month: 'long', year: 'numeric'}));
    const monthlyRevenue = sortedMonths.map(m => monthlyData[m].revenue);
    const monthlyExpenses = sortedMonths.map(m => monthlyData[m].expenses);
    const monthlyProfit = sortedMonths.map(m => monthlyData[m].profit);
    renderMonthlyChart(monthlyLabels, monthlyRevenue, monthlyExpenses, monthlyProfit);
    const productProfit = confirmedSales.reduce((acc, sale) => {
        const profit = sale.sellingPrice - sale.costPrice;
        const name = sale.productName || 'غير محدد';
        acc[name] = (acc[name] || 0) + profit;
        return acc;
    }, {});
    const sortedProducts = Object.entries(productProfit).sort((a,b) => b[1] - a[1]);
    const productLabels = sortedProducts.map(p => p[0]);
    const productProfits = sortedProducts.map(p => p[1]);
    document.getElementById('profit-by-product-title').textContent = `المنتجات الأكثر ربحية (الإجمالي: ${productProfits.reduce((a,b) => a+b, 0).toFixed(2)} EGP)`;
    renderProductProfitChart(productLabels, productProfits);
    const expenseByType = expensesData.reduce((acc, exp) => {
        acc[exp.type] = (acc[exp.type] || 0) + exp.amount;
        return acc;
    }, {});
    const expenseLabels = Object.keys(expenseByType);
    const expenseAmounts = Object.values(expenseByType);
    document.getElementById('expenses-by-type-title').textContent = `توزيع المصروفات (الإجمالي: ${expenseAmounts.reduce((a,b) => a+b, 0).toFixed(2)} EGP)`;
    renderExpenseTypeChart(expenseLabels, expenseAmounts);
    const salesBySource = confirmedSales.reduce((acc, sale) => {
        const source = sale.contactMethod || 'غير محدد';
        if (!acc[source]) acc[source] = 0;
        acc[source] += sale.sellingPrice;
        return acc;
    }, {});
    const sourceLabels = Object.keys(salesBySource);
    const sourceRevenues = Object.values(salesBySource);
    document.getElementById('sales-by-source-title').textContent = `تحليل المبيعات حسب المصدر (الإجمالي: ${sourceRevenues.reduce((a,b) => a+b, 0).toFixed(2)} EGP)`;
    renderSalesBySourceChart(sourceLabels, sourceRevenues);
    const traderAnalysis = accountsData.reduce((acc, account) => {
        const trader = account.trader_name || 'غير محدد';
        if (!acc[trader]) acc[trader] = 0;
        acc[trader] += account.purchase_price || 0;
        return acc;
    }, {});
    const sortedTraders = Object.entries(traderAnalysis).sort((a, b) => b[1] - a[1]);
    const traderLabels = sortedTraders.map(t => t[0]);
    const traderCosts = sortedTraders.map(t => t[1]);
    document.getElementById('trader-analysis-title').textContent = `تحليل تكلفة التجار (الإجمالي: ${traderCosts.reduce((a,b) => a+b, 0).toFixed(2)} EGP)`;
    renderTraderAnalysisChart(traderLabels, traderCosts);
};

const renderMonthlyChart=(l,r,e,p)=>{const t=document.getElementById("monthly-performance-chart").getContext("2d");monthlyChart&&monthlyChart.destroy(),monthlyChart=new Chart(t,{type:"line",data:{labels:l,datasets:[{label:"الدخل",data:r,borderColor:"#4f46e5",backgroundColor:"rgba(79, 70, 229, 0.1)",fill:!0,tension:.4},{label:"المصروفات",data:e,borderColor:"#ef4444",backgroundColor:"rgba(239, 68, 68, 0.1)",fill:!0,tension:.4},{label:"الربح",data:p,borderColor:"#22c55e",backgroundColor:"rgba(34, 197, 94, 0.1)",fill:!0,tension:.4}]},options:{scales:{y:{ticks:{color:"#64748b"},grid:{color:"#e2e8f0",borderDash:[5,5]}},x:{ticks:{color:"#64748b"},grid:{display:!1}}}}})};const renderProductProfitChart=(l,d)=>{const t=document.getElementById("profit-by-product-chart").getContext("2d");productProfitChart&&productProfitChart.destroy();const e=d.map(()=>`rgba(${Math.floor(255*Math.random())}, ${Math.floor(255*Math.random())}, ${Math.floor(255*Math.random())}, 0.8)`);productProfitChart=new Chart(t,{type:"bar",data:{labels:l,datasets:[{label:"الربح",data:d,backgroundColor:e,borderRadius:4}]},options:{indexAxis:"y",scales:{x:{ticks:{color:"#64748b"},grid:{color:"#e2e8f0",borderDash:[5,5]}},y:{ticks:{color:"#64748b"},grid:{display:!1}}}}})};const renderExpenseTypeChart=(l,d)=>{const t=document.getElementById("expenses-by-type-chart").getContext("2d");expenseTypeChart&&expenseTypeChart.destroy(),expenseTypeChart=new Chart(t,{type:"doughnut",data:{labels:l,datasets:[{data:d,backgroundColor:["#ef4444","#3b82f6","#f59e0b"],hoverOffset:4}]}})};const renderSalesBySourceChart=(l,d)=>{const t=document.getElementById("sales-by-source-chart").getContext("2d");salesBySourceChart&&salesBySourceChart.destroy();const e=l.map(()=>`rgba(${Math.floor(255*Math.random())}, ${Math.floor(255*Math.random())}, ${Math.floor(255*Math.random())}, 0.8)`);salesBySourceChart=new Chart(t,{type:"doughnut",data:{labels:l,datasets:[{label:"الدخل",data:d,backgroundColor:e,borderColor:"#f8fafc",borderWidth:4,hoverOffset:8}]},options:{plugins:{legend:{position:"bottom"}}}})};const renderTraderAnalysisChart=(l,d)=>{const t=document.getElementById("trader-analysis-chart").getContext("2d");traderAnalysisChart&&traderAnalysisChart.destroy();const e=d.map(()=>`rgba(${Math.floor(255*Math.random())}, ${Math.floor(255*Math.random())}, ${Math.floor(255*Math.random())}, 0.8)`);traderAnalysisChart=new Chart(t,{type:"bar",data:{labels:l,datasets:[{label:"إجمالي التكلفة",data:d,backgroundColor:e,borderRadius:4}]},options:{indexAxis:"y",scales:{x:{ticks:{color:"#64748b"},grid:{color:"#e2e8f0",borderDash:[5,5]}},y:{ticks:{color:"#64748b"},grid:{display:!1}}}}})};

// New function for detailed product statistics
const updateProductStatistics = () => {
    const container = document.getElementById('product-statistics-container');
    if (!container) return;
    
    const confirmedSales = allSales.filter(s => s.isConfirmed);
    const productStats = {};
    
    // Calculate statistics per product
    allProducts.forEach(product => {
        const productSales = confirmedSales.filter(s => s.productName === product.name);
        const productExpenses = allExpenses.filter(e => e.type === 'إعلان'); // Consider ad expenses for all
        
        // Current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthSales = productSales.filter(s => (s.date?.seconds * 1000) >= startOfMonth.getTime());
        
        // Previous month
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const startOfPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        endOfPrevMonth.setHours(23, 59, 59, 999);
        const prevMonthSales = productSales.filter(s => (s.date?.seconds * 1000) >= startOfPrevMonth.getTime() && (s.date?.seconds * 1000) <= endOfPrevMonth.getTime());
        
        // Calculate stats
        const totalSales = productSales.length;
        const totalRevenue = productSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
        const totalCost = productSales.reduce((sum, s) => sum + (s.costPrice || 0), 0);
        const totalProfit = totalRevenue - totalCost;
        
        const currentMonthRevenue = currentMonthSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
        const currentMonthCost = currentMonthSales.reduce((sum, s) => sum + (s.costPrice || 0), 0);
        const currentMonthProfit = currentMonthRevenue - currentMonthCost;
        
        const prevMonthRevenue = prevMonthSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
        const prevMonthCost = prevMonthSales.reduce((sum, s) => sum + (s.costPrice || 0), 0);
        const prevMonthProfit = prevMonthRevenue - prevMonthCost;
        
        // Growth calculation
        let growthRate = 0;
        if (prevMonthProfit !== 0) {
            growthRate = ((currentMonthProfit - prevMonthProfit) / Math.abs(prevMonthProfit) * 100);
        } else if (currentMonthProfit > 0) {
            growthRate = 100;
        }
        
        // Renewals
        const renewals = productSales.filter(s => s.renewalStatus === 'renewed').length;
        
        productStats[product.name] = {
            totalSales,
            totalRevenue,
            totalCost,
            totalProfit,
            currentMonthSales: currentMonthSales.length,
            currentMonthProfit,
            growthRate,
            renewals
        };
    });
    
    // Render statistics
    container.innerHTML = Object.entries(productStats).map(([productName, stats]) => {
        const growthIcon = stats.growthRate >= 0 ? 'fa-arrow-trend-up text-green-500' : 'fa-arrow-trend-down text-red-500';
        const growthColor = stats.growthRate >= 0 ? 'text-green-600' : 'text-red-600';
        
        return `
            <div class="main-card p-6">
                <h3 class="text-2xl font-bold mb-4 text-gray-800">${productName}</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="stat-mini">
                        <i class="fa-solid fa-shopping-cart text-2xl text-blue-500 mb-2"></i>
                        <p class="text-sm text-gray-500">إجمالي المبيعات</p>
                        <p class="text-2xl font-bold text-gray-800">${stats.totalSales}</p>
                    </div>
                    <div class="stat-mini">
                        <i class="fa-solid fa-dollar-sign text-2xl text-green-500 mb-2"></i>
                        <p class="text-sm text-gray-500">إجمالي الدخل</p>
                        <p class="text-2xl font-bold text-gray-800">${stats.totalRevenue.toFixed(2)}</p>
                    </div>
                    <div class="stat-mini">
                        <i class="fa-solid fa-chart-line text-2xl text-purple-500 mb-2"></i>
                        <p class="text-sm text-gray-500">إجمالي الربح</p>
                        <p class="text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}">${stats.totalProfit.toFixed(2)}</p>
                    </div>
                    <div class="stat-mini">
                        <i class="fa-solid fa-percent text-2xl text-orange-500 mb-2"></i>
                        <p class="text-sm text-gray-500">النمو الشهري</p>
                        <p class="text-xl font-bold ${growthColor}">
                            <i class="fa-solid ${growthIcon}"></i>
                            ${stats.growthRate.toFixed(1)}%
                        </p>
                    </div>
                </div>
                <div class="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div class="bg-blue-50 p-3 rounded-lg">
                        <p class="text-xs text-gray-600">مبيعات الشهر الحالي</p>
                        <p class="text-lg font-bold text-blue-600">${stats.currentMonthSales}</p>
                    </div>
                    <div class="bg-green-50 p-3 rounded-lg">
                        <p class="text-xs text-gray-600">ربح الشهر الحالي</p>
                        <p class="text-lg font-bold text-green-600">${stats.currentMonthProfit.toFixed(2)}</p>
                    </div>
                    <div class="bg-purple-50 p-3 rounded-lg">
                        <p class="text-xs text-gray-600">التجديدات</p>
                        <p class="text-lg font-bold text-purple-600">${stats.renewals}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

const renderProductList = () => {
    const container = document.getElementById('product-list');
    if (!container) return;
    if (allProducts.length === 0) {
        container.innerHTML = `<p class="text-center text-sm text-gray-500">لا توجد منتجات. ابدأ بإضافة منتج جديد.</p>`;
        return;
    }
    container.innerHTML = allProducts.map(prod => `<div class="flex justify-between items-center p-2 bg-gray-100 rounded-md"><span class="font-semibold">${prod.name}</span><button data-id="${prod.id}" class="delete-product-btn text-red-400 hover:text-red-600"><i class="fa-solid fa-trash"></i></button></div>`).join('');
};
const populateProductDropdowns = () => {
    const productDropdowns = document.querySelectorAll('.add-productName, #edit-productName, .add-account-productName, #edit-account-productName, .ad-campaign-product');
    const optionsHTML = allProducts.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    productDropdowns.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = `<option value="">اختر المنتج...</option>${optionsHTML}`;
        if (currentValue) select.value = currentValue;
    });
};
const populateAvailableAccountsDropdown = (selectElement, currentAccountId = null) => {
    const availableAccounts = allAccounts.filter(acc => acc.is_active);
    if (currentAccountId) {
        const currentAccount = allAccounts.find(acc => acc.id === currentAccountId);
        if (currentAccount && !availableAccounts.some(acc => acc.id === currentAccountId)) { availableAccounts.unshift(currentAccount); }
    }
    const groupedAccounts = availableAccounts.reduce((acc, account) => {
        const product = account.productName || 'منتجات أخرى';
        if (!acc[product]) acc[product] = [];
        acc[product].push(account);
        return acc;
    }, {});
    selectElement.innerHTML = '<option value="">اختر الأكونت المتاح</option>';
    for(const product in groupedAccounts) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = product;
        groupedAccounts[product].forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            const usesLeft = acc.allowed_uses === Infinity ? '∞' : acc.allowed_uses - acc.current_uses;
            option.textContent = `${acc.email} (متبقي: ${usesLeft})`;
            optgroup.appendChild(option);
        });
        selectElement.appendChild(optgroup);
    }
    if (currentAccountId) selectElement.value = currentAccountId;
};
const populateProductFilterButtons = () => {
    const salesContainer = document.getElementById('sales-product-filter-container');
    const accountsContainer = document.getElementById('accounts-product-filter-container');
    const products = [...new Set(allProducts.map(p => p.name))].sort();
    
    const createButtonsHTML = (prods, currentFilter) => {
        let html = `<button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-product="all">الكل</button>`;
        prods.forEach(p => { html += `<button class="filter-btn ${currentFilter === p ? 'active' : ''}" data-product="${p}">${p}</button>`; });
        return html;
    }
    salesContainer.innerHTML = createButtonsHTML(products, currentSalesProductFilter);
    accountsContainer.innerHTML = createButtonsHTML(products, currentAccountsProductFilter);
};

const openEditModal=(e)=>{const t=allSales.find(t=>t.id===e);if(!t)return;document.getElementById("edit-sale-id").value=e,document.getElementById("edit-original-accountId").value=t.accountId||"",document.getElementById("edit-contactInfo").value=t.contactInfo||"",document.getElementById("edit-contactMethod").value=t.contactMethod||"",document.getElementById("edit-productName").value=t.productName||"",document.getElementById("edit-accountType").value=t.accountType||"",document.getElementById("edit-subscription").value=t.subscription||"",document.getElementById("edit-sellingPrice").value=t.sellingPrice||0,document.getElementById("edit-costPrice").value=t.costPrice||0;const n=document.getElementById("edit-account-container"),l=document.getElementById("edit-available-accounts-select");t.accountId?(n.classList.remove("hidden"),l.required=!0,populateAvailableAccountsDropdown(l,t.accountId)):(n.classList.add("hidden"),l.required=!1),document.getElementById("edit-cost-price-container").classList.remove("hidden"),document.getElementById("edit-modal-backdrop").classList.remove("hidden"),document.getElementById("edit-modal").classList.remove("hidden")};const closeEditModal=()=>{document.getElementById("edit-modal-backdrop").classList.add("hidden"),document.getElementById("edit-modal").classList.add("hidden")};
const openEditAccountModal=(e)=>{const t=allAccounts.find(t=>t.id===e);if(!t)return;document.getElementById("edit-account-id").value=e,document.getElementById("edit-account-email").value=t.email||"",document.getElementById("edit-account-password").value=t.password||"",document.getElementById("edit-account-productName").value=t.productName||"",document.getElementById("edit-account-purchase_price").value=t.purchase_price||0,document.getElementById("edit-account-trader_name").value=t.trader_name||"",document.getElementById("edit-account-allowed_uses").value=t.allowed_uses===1/0?"":t.allowed_uses,document.getElementById("edit-account-current_uses").value=t.current_uses||0,document.getElementById("edit-account-is_active").checked=t.is_active,document.getElementById("edit-account-modal-backdrop").classList.remove("hidden"),document.getElementById("edit-account-modal").classList.remove("hidden")};const closeEditAccountModal=()=>{document.getElementById("edit-account-modal-backdrop").classList.add("hidden"),document.getElementById("edit-account-modal").classList.add("hidden")};const openEditExpenseModal=(e)=>{const t=allExpenses.find(t=>t.id===e);if(!t)return;document.getElementById("edit-expense-id").value=e,document.getElementById("edit-expense-type").value=t.type||"",document.getElementById("edit-expense-amount").value=t.amount||0,document.getElementById("edit-expense-description").value=t.description||"",document.getElementById("edit-expense-modal-backdrop").classList.remove("hidden"),document.getElementById("edit-expense-modal").classList.remove("hidden")};const closeEditExpenseModal=()=>{document.getElementById("edit-expense-modal-backdrop").classList.add("hidden"),document.getElementById("edit-expense-modal").classList.add("hidden")};

// --- EXPORT FUNCTION ---
const exportSalesToExcel = () => {
    if (!hasPermission(PERMISSIONS.EXPORT_DATA)) {
        showNotification('ليس لديك صلاحية لتصدير البيانات', 'danger');
        return;
    }
    let salesToExport = [...allSales];

    if (dateRangeStart && dateRangeEnd) {
        salesToExport = salesToExport.filter(s => {
            const saleDate = s.date?.seconds ? new Date(s.date.seconds * 1000) : null;
            return saleDate && saleDate >= dateRangeStart && saleDate <= dateRangeEnd;
        });
    }
    if (currentSalesProductFilter !== 'all') {
        salesToExport = salesToExport.filter(s => s.productName === currentSalesProductFilter);
    }
    if (currentStatusFilter === 'unconfirmed') {
        salesToExport = salesToExport.filter(s => !s.isConfirmed);
    }

    if (salesToExport.length === 0) {
        showNotification('لا توجد بيانات لتصديرها.', 'info');
        return;
    }

    const dataForSheet = salesToExport.map(sale => {
        const profit = (sale.sellingPrice || 0) - (sale.costPrice || 0);
        const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000).toLocaleString('ar-EG') : '-';
        return {
            'تاريخ البيع': saleDate,
            'بيانات التواصل': sale.contactInfo,
            'وسيلة التواصل': sale.contactMethod,
            'المنتج': sale.productName,
            'نوع الحساب': sale.accountType,
            'مدة الاشتراك': sale.subscription,
            'إيميل الاشتراك': sale.customerEmail,
            'الباسورد': sale.password,
            'سعر البيع': sale.sellingPrice,
            'التكلفة': sale.costPrice,
            'الربح': profit,
            'الحالة': sale.isConfirmed ? 'مؤكد' : 'غير مؤكد'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'المبيعات');
    
    worksheet['!props'] = { rtl: true };

    XLSX.writeFile(workbook, 'Sales_Report.xlsx');
    showNotification('تم تصدير البيانات بنجاح!', 'success');
};

// --- EVENT LISTENERS & FORM SUBMISSIONS ---
const setupEventListeners = () => {
    const formatContactInfo = e => {
        const input = e.target;
        let value = input.value;
        const hasLetters = /[a-zA-Zء-ي]/.test(value);
        if (!hasLetters && value.includes(' ')) {
            const formattedValue = value.replace(/\s/g, '');
            if (value !== formattedValue) {
                input.value = formattedValue;
            }
        }
    };
    document.getElementById('add-contactInfo').addEventListener('input', formatContactInfo);
    document.getElementById('edit-contactInfo').addEventListener('input', formatContactInfo);

    const tabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const sectionName = tab.dataset.tab;
            
            // Check if user has access to this section
            if (!checkSectionAccess(sectionName)) {
                showUnauthorizedAccessMessage(sectionName);
                return;
            }
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab + '-section');
            tabContents.forEach(tc => tc.classList.add('hidden'));
            target.classList.remove('hidden');
        });
    });

    flatpickrInstance = flatpickr("#date-range-filter", {
        mode: "range", dateFormat: "Y-m-d", locale: "ar",
        onChange: function(selectedDates) {
            if (selectedDates.length === 0) { dateRangeStart = null; dateRangeEnd = null; } 
            else if (selectedDates.length === 1) {
                dateRangeStart = new Date(selectedDates[0].setHours(0, 0, 0, 0));
                dateRangeEnd = new Date(selectedDates[0].setHours(23, 59, 59, 999));
            } else {
                dateRangeStart = new Date(selectedDates[0].setHours(0, 0, 0, 0));
                dateRangeEnd = new Date(selectedDates[1].setHours(23, 59, 59, 999));
            }
            renderData();
        }
    });
    document.getElementById('clear-date-filter-btn').addEventListener('click', () => { if(flatpickrInstance) flatpickrInstance.clear(); });
    
    // Expense date range filter
    expenseFlatpickrInstance = flatpickr("#expense-date-range-filter", {
        mode: "range", dateFormat: "Y-m-d", locale: "ar",
        onChange: function(selectedDates) {
            if (selectedDates.length === 0) { expenseDateRangeStart = null; expenseDateRangeEnd = null; } 
            else if (selectedDates.length === 1) {
                expenseDateRangeStart = new Date(selectedDates[0].setHours(0, 0, 0, 0));
                expenseDateRangeEnd = new Date(selectedDates[0].setHours(23, 59, 59, 999));
            } else {
                expenseDateRangeStart = new Date(selectedDates[0].setHours(0, 0, 0, 0));
                expenseDateRangeEnd = new Date(selectedDates[1].setHours(23, 59, 59, 999));
            }
            renderData();
        }
    });
    document.getElementById('clear-expense-date-filter-btn').addEventListener('click', () => { if(expenseFlatpickrInstance) expenseFlatpickrInstance.clear(); });
    
    // Custom date picker for add sale form
    flatpickr("#add-custom-date", { dateFormat: "Y-m-d", locale: "ar" });
    
    // Custom date picker for add expense form
    flatpickr("#add-expense-custom-date", { dateFormat: "Y-m-d", locale: "ar" });
    
    document.getElementById('export-sales-btn').addEventListener('click', exportSalesToExcel);

    document.body.addEventListener('click', (e) => {
        if(e.target.closest('#sales-product-filter-container .filter-btn')){
            currentSalesProductFilter = e.target.closest('.filter-btn').dataset.product;
            renderData();
        }
        if(e.target.closest('#accounts-product-filter-container .filter-btn')){
            currentAccountsProductFilter = e.target.closest('.filter-btn').dataset.product;
            renderData();
        }
    });
    
    // Accounts status filter
    document.getElementById('accounts-status-filter-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn') || e.target.closest('.filter-btn')) {
            const btn = e.target.classList.contains('filter-btn') ? e.target : e.target.closest('.filter-btn');
            currentAccountsStatusFilter = btn.dataset.status;
            document.querySelectorAll('#accounts-status-filter-container .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderData();
        }
    });
    
    // Expense type filter
    document.getElementById('expense-type-filter-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn') || e.target.closest('.filter-btn')) {
            const btn = e.target.classList.contains('filter-btn') ? e.target : e.target.closest('.filter-btn');
            currentExpenseTypeFilter = btn.dataset.type;
            document.querySelectorAll('#expense-type-filter-container .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderData();
        }
    });
    document.getElementById('sales-status-filter-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            currentStatusFilter = e.target.dataset.status;
            document.querySelectorAll('#sales-status-filter-container .filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderData();
        }
    });

    document.getElementById('search-input').addEventListener('keyup', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        let baseData = allSales.filter(sale => Object.values(sale).some(val => String(val).toLowerCase().includes(searchTerm)));
        updateSalesTable(baseData);
    });
     document.getElementById('search-accounts-input').addEventListener('keyup', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        let baseData = allAccounts.filter(acc => acc.email.toLowerCase().includes(searchTerm) || acc.trader_name.toLowerCase().includes(searchTerm));
        updateAccountsTable(baseData);
    });
    
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('edit-modal-backdrop').addEventListener('click', closeEditModal);
    document.getElementById('cancel-edit-account-btn').addEventListener('click', closeEditAccountModal);
    document.getElementById('edit-account-modal-backdrop').addEventListener('click', closeEditAccountModal);
    document.getElementById('cancel-edit-expense-btn').addEventListener('click', closeEditExpenseModal);
    document.getElementById('edit-expense-modal-backdrop').addEventListener('click', closeEditExpenseModal);

    document.getElementById('toggle-add-sale-form').addEventListener('click', () => {
        populateAvailableAccountsDropdown(document.querySelector('#available-accounts-select'));
        document.getElementById('add-sale-container').classList.toggle('open');
    });
     document.getElementById('toggle-add-problem-form').addEventListener('click', () => {
        const saleSelect = document.getElementById('problem-sale-id');
        const accountSelect = document.getElementById('problem-replacement-account-id');
        saleSelect.innerHTML = `<option value="">اختر الأوردر المرتبط بالمشكلة...</option>` + 
            allSales.filter(s => s.accountId && s.isConfirmed)
            .map(s => `<option value="${s.id}">${s.contactInfo} (${s.productName})</option>`).join('');
        populateAvailableAccountsDropdown(accountSelect);
        document.getElementById('add-problem-container').classList.toggle('open');
    });
    document.getElementById('toggle-add-account-form').addEventListener('click', () => document.getElementById('add-account-container').classList.toggle('open'));
    document.getElementById('toggle-add-expense-form').addEventListener('click', () => document.getElementById('add-expense-container').classList.toggle('open'));

    // FIX: Added event listener for manual sale checkbox
    document.getElementById('manual-sale-checkbox').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const manualContainer = document.getElementById('manual-sale-container');
        const inventoryContainer = document.getElementById('inventory-sale-container');
        const inventorySelect = document.getElementById('available-accounts-select');
        
        manualContainer.classList.toggle('hidden', !isChecked);
        inventoryContainer.classList.toggle('hidden', isChecked);
        
        inventorySelect.required = !isChecked;
    });

    // Shifts date picker
    shiftDatePicker = flatpickr("#shift-date-filter", {
        dateFormat: "Y-m-d",
        locale: "ar",
        defaultDate: new Date(),
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                renderShiftStatistics(selectedDates[0]);
            }
        }
    });

    // Today button for shifts
    document.getElementById('shift-today-btn')?.addEventListener('click', () => {
        if (shiftDatePicker) {
            shiftDatePicker.setDate(new Date());
            renderShiftStatistics(new Date());
        }
    });

    // Renewal filters
    document.body.addEventListener('click', (e) => {
        const renewalFilterBtn = e.target.closest('.renewal-filter-btn');
        if (renewalFilterBtn) {
            currentRenewalFilter = renewalFilterBtn.dataset.filter;
            document.querySelectorAll('.renewal-filter-btn').forEach(btn => btn.classList.remove('active'));
            renewalFilterBtn.classList.add('active');
            renderRenewalsTab();
        }
    });

    // Ad campaign form toggle
    document.getElementById('toggle-ad-campaign-form')?.addEventListener('click', () => {
        document.getElementById('add-ad-campaign-container').classList.toggle('open');
    });

    // Ad campaign date pickers
    adStartDatePicker = flatpickr(".ad-start-date", {
        dateFormat: "Y-m-d",
        locale: "ar"
    });

    adEndDatePicker = flatpickr(".ad-end-date", {
        dateFormat: "Y-m-d",
        locale: "ar"
    });

    // Ad product filters
    document.body.addEventListener('click', (e) => {
        const adProductFilter = e.target.closest('.ad-product-filter');
        if (adProductFilter) {
            currentAdProductFilter = adProductFilter.dataset.product;
            document.querySelectorAll('.ad-product-filter').forEach(btn => btn.classList.remove('active'));
            adProductFilter.classList.add('active');
            renderAdvertisingSection();
        }
    });

    // Delete ad campaign
    document.body.addEventListener('click', async (e) => {
        const deleteAdBtn = e.target.closest('.delete-ad-campaign-btn');
        if (deleteAdBtn) {
            if (confirm('هل أنت متأكد من حذف هذه الحملة الإعلانية؟')) {
            try {
                await deleteDoc(doc(db, PATH_AD_CAMPAIGNS, deleteAdBtn.dataset.id));
                showNotification('تم حذف الحملة بنجاح', 'success');
            } catch (error) {
                handleFirebaseError(error, 'حذف الحملة الإعلانية');
            }
            }
        }
    });
};

const setupFormSubmissions = () => {
    document.getElementById('add-product-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!hasPermission(PERMISSIONS.ADD_PRODUCT)) {
            showNotification('ليس لديك صلاحية لإضافة منتجات', 'danger');
            return;
        }
        const form = e.target;
        const productName = form.productName.value.trim();
        if (productName) {
            try {
                await addDoc(collection(db, PATH_PRODUCTS), { name: productName });
                showNotification(`تمت إضافة منتج "${productName}" بنجاح!`, 'success');
                form.reset();
            } catch (error) { 
                handleFirebaseError(error, 'إضافة المنتج');
            }
        }
    });

    document.getElementById('add-account-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!hasPermission(PERMISSIONS.ADD_ACCOUNT)) {
            showNotification('ليس لديك صلاحية لإضافة أكونتات', 'danger');
            return;
        }
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = 'جاري الإضافة...';
        try {
            const formData = new FormData(form);
            const isLifetime = document.getElementById('lifetime-checkbox').checked;
            const allowedUsesValue = formData.get('allowed_uses');
            if (!isLifetime && (!allowedUsesValue || parseInt(allowedUsesValue) < 1)) throw new Error("يجب تحديد عدد استخدامات صالح.");
            
            const accountsText = formData.get('emails').trim();
            const accountsArray = accountsText.split('\n').map(line => {
                const parts = line.trim().split(':');
                if (parts.length < 2 || !parts[0] || !parts[1]) return null;
                return { email: parts[0].trim(), password: parts.slice(1).join(':').trim() };
            }).filter(Boolean);

            if (accountsArray.length === 0) {
                throw new Error("الرجاء إدخال بيانات الأكونتات بالصيغة الصحيحة (email:password).");
            }

            const commonData = {
                productName: formData.get('productName'), purchase_price: parseFloat(formData.get('purchase_price')),
                trader_name: formData.get('trader_name').trim(), allowed_uses: isLifetime ? Infinity : parseInt(allowedUsesValue),
                current_uses: 0, is_active: true, purchase_date: serverTimestamp()
            };
            const batch = writeBatch(db);
            accountsArray.forEach(account => {
                batch.set(doc(collection(db, PATH_ACCOUNTS)), { ...commonData, email: account.email, password: account.password });
            });
            await batch.commit();
            showNotification(`تمت إضافة ${accountsArray.length} أكونت بنجاح!`, "success");
            form.reset();
            document.getElementById('lifetime-checkbox').dispatchEvent(new Event('change')); 
            document.getElementById('add-account-container').classList.remove('open');
        } catch (err) {
            showNotification(err.message || "حدث خطأ.", "danger");
        } finally {
            submitBtn.disabled = false; submitBtn.textContent = 'إضافة الأكونتات';
        }
    });

    document.getElementById('add-sale-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!hasPermission(PERMISSIONS.ADD_SALE)) {
            showNotification('ليس لديك صلاحية لإضافة مبيعات', 'danger');
            return;
        }
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const isManualSale = document.getElementById('manual-sale-checkbox').checked;
        submitBtn.disabled = true; submitBtn.textContent = 'جاري الإضافة...';
        try {
            const formData = new FormData(form);
            const customDate = formData.get('customDate');
            const saleDate = customDate ? new Date(customDate) : null;
            
            if (isManualSale) {
                const saleData = {
                    contactInfo: formData.get('contactInfo'), contactMethod: formData.get('contactMethod'), productName: formData.get('productName'),
                    accountType: formData.get('accountType'), subscription: formData.get('subscription'), sellingPrice: parseFloat(formData.get('sellingPrice')),
                    costPrice: parseFloat(formData.get('costPrice')) || 0,
                    customerEmail: formData.get('customerEmail'), accountId: null, 
                    date: saleDate ? { seconds: Math.floor(saleDate.getTime() / 1000) } : serverTimestamp(),
                    password: '',
                    isConfirmed: false
                };
                await addDoc(collection(db, PATH_SALES), saleData);
            } else {
                const accountId = form.accountId.value;
                if (!accountId) throw new Error("يجب اختيار أكونت متاح من المخزون.");
                await runTransaction(db, async (transaction) => {
                    const accountRef = doc(db, PATH_ACCOUNTS, accountId);
                    const accountDoc = await transaction.get(accountRef);
                    if (!accountDoc.exists() || !accountDoc.data().is_active) throw new Error("Account not available.");
                    const accountData = accountDoc.data();
                    const accountType = formData.get('accountType');
                    let newUses = accountData.current_uses, newIsActive = accountData.is_active;
                    if (accountType === 'Private') { newIsActive = false; }
                    else if (accountType === 'Subscriber') {
                        newUses++;
                        if(newUses >= accountData.allowed_uses && accountData.allowed_uses !== Infinity) newIsActive = false;
                    }
                    transaction.update(accountRef, { current_uses: newUses, is_active: newIsActive });
                    const saleData = {
                        contactInfo: formData.get('contactInfo'), contactMethod: formData.get('contactMethod'), productName: formData.get('productName'),
                        accountType: accountType, subscription: formData.get('subscription'), sellingPrice: parseFloat(formData.get('sellingPrice')),
                        costPrice: accountData.purchase_price, customerEmail: accountData.email, accountId: accountId, 
                        date: saleDate ? { seconds: Math.floor(saleDate.getTime() / 1000) } : serverTimestamp(),
                        password: accountData.password || '',
                        isConfirmed: false 
                    };
                    transaction.set(doc(collection(db, PATH_SALES)), saleData);
                });
            }
            showNotification("تم إضافة الاوردر بنجاح!", "success");
            form.reset();
            document.getElementById('manual-sale-checkbox').dispatchEvent(new Event('change'));
            document.getElementById('add-sale-container').classList.remove('open');
        } catch (err) {
            showNotification(err.message || "حدث خطأ.", "danger");
        } finally {
            submitBtn.disabled = false; submitBtn.textContent = 'إضافة الاوردر';
        }
    });
    
    document.getElementById('add-problem-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!hasPermission(PERMISSIONS.ADD_PROBLEM)) {
            showNotification('ليس لديك صلاحية لإضافة مشاكل', 'danger');
            return;
        }
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = 'جاري الإضافة...';
        const saleId = form.saleId.value;
        const replacementAccountId = form.replacementAccountId.value;
        const description = form.description.value;
        try {
            await runTransaction(db, async (transaction) => {
                const originalSaleRef = doc(db, PATH_SALES, saleId);
                const originalSaleDoc = await transaction.get(originalSaleRef);
                if (!originalSaleDoc.exists()) throw new Error("الأوردر الأصلي غير موجود.");

                const originalAccountId = originalSaleDoc.data().accountId;
                if (!originalAccountId) throw new Error("هذا الأوردر ليس مرتبطًا بأكونت من المخزون.");
                
                const originalAccountRef = doc(db, PATH_ACCOUNTS, originalAccountId);
                const replacementAccountRef = doc(db, PATH_ACCOUNTS, replacementAccountId);

                const [originalAccountDoc, replacementAccountDoc] = await Promise.all([
                    transaction.get(originalAccountRef),
                    transaction.get(replacementAccountRef)
                ]);
                if (!replacementAccountDoc.exists()) throw new Error("الأكونت البديل غير موجود.");

                transaction.update(originalAccountRef, { is_active: false });

                const replacementAccountData = replacementAccountDoc.data();
                const originalSaleData = originalSaleDoc.data();
                let newUses = replacementAccountData.current_uses;
                let newIsActive = replacementAccountData.is_active;

                if (originalSaleData.accountType === 'Private') {
                    newIsActive = false;
                } else if (originalSaleData.accountType === 'Subscriber') {
                    newUses++;
                    if (newUses >= replacementAccountData.allowed_uses && replacementAccountData.allowed_uses !== Infinity) {
                        newIsActive = false;
                    }
                }
                transaction.update(replacementAccountRef, { current_uses: newUses, is_active: newIsActive });
                
                transaction.update(originalSaleRef, {
                    accountId: replacementAccountId,
                    customerEmail: replacementAccountData.email,
                    costPrice: replacementAccountData.purchase_price
                });

                const problemRef = doc(collection(db, PATH_PROBLEMS));
                transaction.set(problemRef, {
                    saleId, originalAccountId, replacementAccountId, description, date: serverTimestamp(),
                });
            });
            showNotification("تم تسجيل المشكلة بنجاح!", "success");
            form.reset();
            document.getElementById('add-problem-container').classList.remove('open');
        } catch (err) {
            showNotification(err.message || "حدث خطأ.", "danger");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إضافة المشكلة';
        }
    });

    document.getElementById('add-expense-form').addEventListener('submit', async e => {
         e.preventDefault();
        if (!hasPermission(PERMISSIONS.ADD_EXPENSE)) {
            showNotification('ليس لديك صلاحية لإضافة مصروفات', 'danger');
            return;
        }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = 'جاري الإضافة...';
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const customDate = data.customDate;
        const expenseDate = customDate ? new Date(customDate) : null;
        
        try {
            const expenseData = {
                type: data.type,
                category: data.category || '',
                amount: parseFloat(data.amount),
                description: data.description || '',
                date: serverTimestamp()
            };
            
            if (expenseDate) {
                expenseData.customDate = { seconds: Math.floor(expenseDate.getTime() / 1000) };
            }
            
            await addDoc(collection(db, PATH_EXPENSES), expenseData);
            showNotification("تمت إضافة المصروف بنجاح!", "success");
            e.target.reset();
            document.getElementById('add-expense-container').classList.remove('open');
        } catch (err) { 
            showNotification("حدث خطأ أثناء إضافة المصروف.", "danger");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إضافة مصروف';
        }
    });

    document.getElementById('edit-sale-form').addEventListener('submit', async e => {
        e.preventDefault();
        if (!hasPermission(PERMISSIONS.EDIT_SALE)) {
            showNotification('ليس لديك صلاحية لتعديل المبيعات', 'danger');
            return;
        }
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        
        const saleId = form.id.value;
        const originalAccountId = form.querySelector('#edit-original-accountId').value;
        const newAccountId = form.accountId.value;
        
        const saleToUpdate = allSales.find(s => s.id === saleId);
        if (!saleToUpdate) {
            showNotification("لم يتم العثور على الأوردر.", "danger");
            submitBtn.disabled = false;
            return;
        }
        const isOriginallyManualSale = !saleToUpdate.accountId;

        try {
            await runTransaction(db, async (transaction) => {
                const saleRef = doc(db, PATH_SALES, saleId);
                const formData = new FormData(form);
                const updatedFields = {
                    contactInfo: formData.get('contactInfo'), contactMethod: formData.get('contactMethod'),
                    productName: formData.get('productName'), accountType: formData.get('accountType'),
                    subscription: formData.get('subscription'), sellingPrice: parseFloat(formData.get('sellingPrice')),
                    costPrice: parseFloat(formData.get('costPrice'))
                };

                if (isOriginallyManualSale) {
                    transaction.update(saleRef, updatedFields);
                    return; 
                }

                const originalAccountRef = doc(db, PATH_ACCOUNTS, originalAccountId);

                if (originalAccountId && originalAccountId !== newAccountId) {
                    const newAccountRef = doc(db, PATH_ACCOUNTS, newAccountId);
                    
                    const [originalAccountDoc, newAccountDoc] = await Promise.all([
                        transaction.get(originalAccountRef),
                        transaction.get(newAccountRef)
                    ]);
                    if (!newAccountDoc.exists()) throw new Error("الأكونت الجديد غير موجود.");
                    if (!originalAccountDoc.exists()) throw new Error("الأكونت الأصلي المرتبط بالبيع لم يعد موجوداً.");
                    
                    const originalAccountData = originalAccountDoc.data();
                    const revertUpdateData = { is_active: true };
                    if (saleToUpdate.accountType === 'Subscriber') {
                        revertUpdateData.current_uses = Math.max(0, originalAccountData.current_uses - 1);
                    }
                    transaction.update(originalAccountRef, revertUpdateData);

                    const newAccountData = newAccountDoc.data();
                    let newUses = newAccountData.current_uses;
                    let newIsActive = newAccountData.is_active;

                    if (updatedFields.accountType === 'Private') { newIsActive = false; } 
                    else if (updatedFields.accountType === 'Subscriber') {
                        newUses++;
                        if (newUses >= newAccountData.allowed_uses && newAccountData.allowed_uses !== Infinity) {
                            newIsActive = false;
                        }
                    }
                    transaction.update(newAccountRef, { current_uses: newUses, is_active: newIsActive });
                    
                    updatedFields.accountId = newAccountId;
                    updatedFields.customerEmail = newAccountData.email;
                    updatedFields.password = newAccountData.password || '';
                } 
                
                transaction.update(saleRef, updatedFields);
            });
            showNotification("تم التعديل بنجاح!", "info");
            closeEditModal();
        } catch (err) {
            console.error("Edit Sale Error:", err);
            showNotification(err.message || "حدث خطأ أثناء التعديل.", "danger");
        } finally {
            submitBtn.disabled = false;
        }
    });

     document.getElementById('edit-account-form').addEventListener('submit', async (e) => {
         e.preventDefault();
        if (!hasPermission(PERMISSIONS.EDIT_ACCOUNT)) {
            showNotification('ليس لديك صلاحية لتعديل الأكونتات', 'danger');
            return;
        }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const accountId = document.getElementById('edit-account-id').value;
        try {
            const dataToUpdate = {
                 email: document.getElementById('edit-account-email').value.trim(),
                 password: document.getElementById('edit-account-password').value.trim(),
                 productName: document.getElementById('edit-account-productName').value,
                 purchase_price: parseFloat(document.getElementById('edit-account-purchase_price').value), trader_name: document.getElementById('edit-account-trader_name').value.trim(),
                 allowed_uses: parseFloat(document.getElementById('edit-account-allowed_uses').value) || Infinity, current_uses: parseInt(document.getElementById('edit-account-current_uses').value),
                 is_active: document.getElementById('edit-account-is_active').checked
            };
            await updateDoc(doc(db, PATH_ACCOUNTS, accountId), dataToUpdate);
            showNotification("تم تعديل الأكونت بنجاح!", "info");
            closeEditAccountModal();
        } catch (err) {
            showNotification("حدث خطأ أثناء التعديل.", "danger");
        } finally {
            submitBtn.disabled = false;
        }
     });

     document.getElementById('edit-expense-form').addEventListener('submit', async (e) => {
         e.preventDefault();
        if (!hasPermission(PERMISSIONS.EDIT_EXPENSE)) {
            showNotification('ليس لديك صلاحية لتعديل المصروفات', 'danger');
            return;
        }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        const expenseId = document.getElementById('edit-expense-id').value;
        try {
            const dataToUpdate = {
                 type: document.getElementById('edit-expense-type').value,
                 amount: parseFloat(document.getElementById('edit-expense-amount').value),
                 description: document.getElementById('edit-expense-description').value.trim()
            };
            await updateDoc(doc(db, PATH_EXPENSES, expenseId), dataToUpdate);
            showNotification("تم تعديل المصروف بنجاح!", "info");
            closeEditExpenseModal();
        } catch (err) {
            showNotification("حدث خطأ أثناء التعديل.", "danger");
        } finally {
            submitBtn.disabled = false;
        }
     });

    // Add advertising campaign form
    document.getElementById('add-ad-campaign-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الإضافة...';

        try {
            const formData = new FormData(form);
            const startDate = formData.get('startDate');
            const endDate = formData.get('endDate');

            const campaignData = {
                productName: formData.get('productName'),
                platform: formData.get('platform'),
                amount: parseFloat(formData.get('amount')),
                notes: formData.get('notes') || '',
                startDate: startDate ? { seconds: Math.floor(new Date(startDate).getTime() / 1000) } : serverTimestamp(),
                endDate: endDate ? { seconds: Math.floor(new Date(endDate).getTime() / 1000) } : null,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, PATH_AD_CAMPAIGNS), campaignData);
            showNotification('تمت إضافة الحملة الإعلانية بنجاح!', 'success');
            form.reset();
            document.getElementById('add-ad-campaign-container').classList.remove('open');
        } catch (error) {
            showNotification('حدث خطأ أثناء إضافة الحملة', 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'إضافة الحملة';
        }
    });
};

const setupDynamicEventListeners = () => {
    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('.copyable, .confirm-sale-btn, .edit-sale-btn, .delete-sale-btn, .delete-product-btn, .edit-account-btn, .delete-account-btn, .edit-expense-btn, .delete-expense-btn, .renewal-action-btn');
        if (!target) return;

        if (target.matches('.copyable')) {
            const textToCopy = target.dataset.copyText;
            if (textToCopy) copyToClipboard(textToCopy);
        } 
        else if (target.matches('.renewal-action-btn')) {
            if (!hasPermission(PERMISSIONS.MANAGE_RENEWALS)) {
                showNotification('ليس لديك صلاحية لإدارة التجديدات', 'danger');
                return;
            }
            const saleId = target.dataset.id;
            const action = target.dataset.action;
            try {
                await updateDoc(doc(db, PATH_SALES, saleId), { renewalStatus: action });
                let message = '';
                if(action === 'alerted') message = 'تم تسجيل التنبيه.';
                else if(action === 'renewed') message = 'تم تسجيل التجديد.';
                else if(action === 'not-renewed') message = 'تم تسجيل عدم التجديد.';
                showNotification(message, 'info');
            } catch (err) {
                showNotification('خطأ في تحديث الحالة.', 'danger');
            }
        }
        else if (target.matches('.confirm-sale-btn')) {
            if (!hasPermission(PERMISSIONS.CONFIRM_SALE)) {
                showNotification('ليس لديك صلاحية لتأكيد المبيعات', 'danger');
                return;
            }
            const saleId = target.dataset.id;
            if (confirm('هل أنت متأكد من تأكيد هذا الأوردر؟')) {
                try {
                    await updateDoc(doc(db, PATH_SALES, saleId), { isConfirmed: true });
                    showNotification('تم تأكيد الأوردر بنجاح!', 'success');
                } catch (err) { showNotification('خطأ في تأكيد الأوردر.', 'danger');}
            }
        } 
        else if (target.matches('.edit-sale-btn')) {
            openEditModal(target.closest('[data-sale-id]').dataset.saleId);
        } 
        else if (target.matches('.delete-sale-btn')) {
            if (!hasPermission(PERMISSIONS.DELETE_SALE)) {
                showNotification('ليس لديك صلاحية لحذف المبيعات', 'danger');
                return;
            }
            if (confirm('هل أنت متأكد من حذف هذا الاوردر؟ سيتم إرجاع الاستخدام للأكونت المرتبط.')) {
                const saleId = target.closest('[data-sale-id]').dataset.saleId;
                try {
                    const saleToDelete = allSales.find(s => s.id === saleId);
                    if (saleToDelete && saleToDelete.accountId) { 
                        await runTransaction(db, async (transaction) => {
                            const saleRef = doc(db, PATH_SALES, saleId);
                            const accountRef = doc(db, PATH_ACCOUNTS, saleToDelete.accountId);
                            const accountDoc = await transaction.get(accountRef);
                            if (accountDoc.exists()) {
                                const accountData = accountDoc.data();
                                let newCurrentUses = accountData.current_uses;
                                if (saleToDelete.accountType === 'Subscriber') newCurrentUses -= 1;
                                transaction.update(accountRef, { current_uses: Math.max(0, newCurrentUses), is_active: true });
                            }
                            transaction.delete(saleRef);
                        });
                    } else { await deleteDoc(doc(db, PATH_SALES, saleId)); }
                    showNotification("تم حذف الأوردر بنجاح.", "success");
                } catch (err) { showNotification(err.message || "حدث خطأ.", "danger"); }
            }
        } 
        else if (target.matches('.delete-product-btn')) {
            if (!hasPermission(PERMISSIONS.DELETE_PRODUCT)) {
                showNotification('ليس لديك صلاحية لحذف المنتجات', 'danger');
                return;
            }
            const productId = target.dataset.id;
            if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                try {
                    await deleteDoc(doc(db, PATH_PRODUCTS, productId));
                    showNotification('تم حذف المنتج.', 'danger');
                } catch (error) { 
                    handleFirebaseError(error, 'حذف المنتج');
                }
            }
        } 
        else if (target.matches('.edit-account-btn')) {
            const accountId = target.closest('tr').querySelector('.delete-account-btn').dataset.id;
            openEditAccountModal(accountId);
        } 
        else if (target.matches('.delete-account-btn')) {
            if (!hasPermission(PERMISSIONS.DELETE_ACCOUNT)) {
                showNotification('ليس لديك صلاحية لحذف الأكونتات', 'danger');
                return;
            }
            const accountId = target.dataset.id;
            if (allSales.some(sale => sale.accountId === accountId)) {
                return alert("لا يمكن حذف هذا الأكونت لأنه مرتبط بأوردر واحد على الأقل.");
            }
            if (confirm('هل أنت متأكد من حذف هذا الأكونت؟')) {
                try {
                    await deleteDoc(doc(db, PATH_ACCOUNTS, accountId));
                    showNotification("تم حذف الأكونت.", "danger");
                } catch (err) { showNotification("حدث خطأ.", "danger"); }
            }
        } 
        else if(target.matches('.edit-expense-btn')) {
            const expenseId = target.dataset.id;
            openEditExpenseModal(expenseId);
        } 
        else if(target.matches('.delete-expense-btn')) {
            if (!hasPermission(PERMISSIONS.DELETE_EXPENSE)) {
                showNotification('ليس لديك صلاحية لحذف المصروفات', 'danger');
                return;
            }
            if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
                try {
                     await deleteDoc(doc(db, PATH_EXPENSES, target.dataset.id));
                     showNotification("تم الحذف بنجاح.", "danger");
                } catch (err) { showNotification("حدث خطأ.", "danger"); }
            }
        }
    });
};

// Show unauthorized access screen for a section
function showUnauthorizedAccessScreen(sectionName) {
    const sectionNames = {
        'dashboard': 'لوحة التحكم',
        'reports': 'التقارير',
        'sales': 'سجل المبيعات',
        'renewals': 'التنبيهات',
        'problems': 'المشاكل',
        'accounts': 'إدارة الأكونتات',
        'expenses': 'المصروفات'
    };

    const sectionDisplayName = sectionNames[sectionName] || sectionName;
    
    return `
        <div class="unauthorized-access">
            <i class="fas fa-ban"></i>
            <h2>غير مصرح لك بالوصول</h2>
            <p>ليس لديك صلاحية للوصول إلى ${sectionDisplayName}. يرجى التواصل مع المدير للحصول على الصلاحيات المناسبة.</p>
            <a href="#" class="btn" onclick="history.back()">
                <i class="fas fa-arrow-right ml-2"></i>العودة
            </a>
        </div>
    `;
}

// Check and display unauthorized access screens for restricted sections
function checkAndDisplayUnauthorizedScreens() {
    const sections = ['dashboard', 'reports', 'sales', 'renewals', 'problems', 'accounts', 'expenses'];
    
    sections.forEach(sectionName => {
        const sectionElement = document.getElementById(sectionName + '-section');
        if (sectionElement && !checkSectionAccess(sectionName)) {
            sectionElement.innerHTML = showUnauthorizedAccessScreen(sectionName);
        }
    });
}

// Public mode: always allow access without redirecting to login
async function checkAuthenticationOnLoad() {
    return true;
}

// --- SHIFTS STATISTICS FUNCTIONS ---
function getShiftForTime(hour) {
    if (hour >= SHIFTS.NIGHT.start && hour < SHIFTS.NIGHT.end) return 'NIGHT';
    if (hour >= SHIFTS.MORNING.start && hour < SHIFTS.MORNING.end) return 'MORNING';
    if (hour >= SHIFTS.EVENING.start && hour < SHIFTS.EVENING.end) return 'EVENING';
    return 'EVENING'; // fallback
}

function calculateShiftStats(salesData, selectedDate) {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dayOrders = salesData.filter(sale => {
        const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000) : null;
        return saleDate && saleDate >= startOfDay && saleDate <= endOfDay;
    });

    const shiftData = {
        NIGHT: { orders: [], revenue: 0, profit: 0, count: 0 },
        MORNING: { orders: [], revenue: 0, profit: 0, count: 0 },
        EVENING: { orders: [], revenue: 0, profit: 0, count: 0 }
    };

    dayOrders.forEach(sale => {
        const saleDate = new Date(sale.date.seconds * 1000);
        const hour = saleDate.getHours();
        const shift = getShiftForTime(hour);
        
        shiftData[shift].orders.push(sale);
        shiftData[shift].revenue += sale.sellingPrice || 0;
        shiftData[shift].profit += (sale.sellingPrice || 0) - (sale.costPrice || 0);
        shiftData[shift].count++;
    });

    return shiftData;
}

function renderShiftStatistics(date) {
    const container = document.getElementById('shifts-statistics-container');
    const shiftStats = calculateShiftStats(allSales, date);
    
    const totalDayOrders = Object.values(shiftStats).reduce((sum, shift) => sum + shift.count, 0);
    const totalDayRevenue = Object.values(shiftStats).reduce((sum, shift) => sum + shift.revenue, 0);
    const totalDayProfit = Object.values(shiftStats).reduce((sum, shift) => sum + shift.profit, 0);

    let html = `
        <div class="main-card p-6 mb-6">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">
                <i class="fa-solid fa-calendar-day ml-2 text-indigo-600"></i>
                ملخص ${date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="stat-card bg-gradient-to-br from-green-500 to-emerald-600">
                    <p class="font-semibold text-white/90">إجمالي الطلبات</p>
                    <p class="text-4xl font-bold mt-2">${totalDayOrders}</p>
                </div>
                <div class="stat-card bg-gradient-to-br from-blue-500 to-indigo-600">
                    <p class="font-semibold text-white/90">إجمالي الإيرادات</p>
                    <p class="text-4xl font-bold mt-2">${totalDayRevenue.toFixed(2)} EGP</p>
                </div>
                <div class="stat-card bg-gradient-to-br from-purple-500 to-pink-600">
                    <p class="font-semibold text-white/90">إجمالي الربح</p>
                    <p class="text-4xl font-bold mt-2">${totalDayProfit.toFixed(2)} EGP</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    `;

    Object.entries(SHIFTS).forEach(([key, shift]) => {
        const data = shiftStats[key];
        const percentage = totalDayOrders > 0 ? ((data.count / totalDayOrders) * 100).toFixed(1) : 0;
        
        html += `
            <div class="shift-card">
                <div class="shift-header">
                    <div>
                        <h4 class="text-xl font-bold text-gray-800">${shift.name}</h4>
                        <p class="text-sm text-gray-600">${shift.start}:00 - ${shift.end}:00</p>
                    </div>
                    <div class="stat-card bg-gradient-to-br ${shift.color} px-4 py-2">
                        <p class="text-3xl font-bold">${data.count}</p>
                        <p class="text-xs text-white/80">طلبات</p>
                    </div>
                </div>
                
                <div class="shift-stats">
                    <div class="shift-stat-item">
                        <p class="text-xs text-gray-600 mb-1">النسبة المئوية</p>
                        <p class="text-lg font-bold text-indigo-600">${percentage}%</p>
                    </div>
                    <div class="shift-stat-item">
                        <p class="text-xs text-gray-600 mb-1">الإيرادات</p>
                        <p class="text-lg font-bold text-green-600">${data.revenue.toFixed(2)}</p>
                    </div>
                    <div class="shift-stat-item">
                        <p class="text-xs text-gray-600 mb-1">الربح</p>
                        <p class="text-lg font-bold ${data.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}">${data.profit.toFixed(2)}</p>
                    </div>
                    <div class="shift-stat-item">
                        <p class="text-xs text-gray-600 mb-1">متوسط الربح/طلب</p>
                        <p class="text-lg font-bold text-purple-600">${data.count > 0 ? (data.profit / data.count).toFixed(2) : '0.00'}</p>
                    </div>
                </div>

                ${data.orders.length > 0 ? `
                    <div class="mt-4 pt-4 border-t border-gray-300">
                        <h5 class="font-semibold text-gray-700 mb-2">
                            <i class="fa-solid fa-list ml-1"></i>
                            الطلبات (${data.orders.length})
                        </h5>
                        <div class="space-y-2 max-h-64 overflow-y-auto">
                            ${data.orders.map(order => {
                                const orderTime = new Date(order.date.seconds * 1000);
                                return `
                                    <div class="bg-gray-50 p-2 rounded text-xs">
                                        <div class="flex justify-between items-center">
                                            <span class="font-semibold">${order.contactInfo || 'N/A'}</span>
                                            <span class="text-gray-500">${orderTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div class="flex justify-between mt-1">
                                            <span>${order.productName}</span>
                                            <span class="font-bold text-green-600">${((order.sellingPrice || 0) - (order.costPrice || 0)).toFixed(2)} EGP</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : '<p class="text-center text-gray-500 mt-4">لا توجد طلبات في هذا الشيفت</p>'}
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// --- RENEWALS SYSTEM FUNCTIONS ---
function getRenewalData() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return allSales
        .filter(sale => sale.isConfirmed && sale.subscription !== 'Lifetime')
        .map(sale => {
            const expiryDate = calculateExpiryDate(sale.date, sale.subscription);
            const daysRemaining = calculateDaysRemaining(expiryDate);
            
            let category = 'normal';
            if (daysRemaining < 0) category = 'expired';
            else if (daysRemaining <= 3) category = 'urgent';
            else if (daysRemaining <= 7) category = 'soon';

            return {
                ...sale,
                expiryDate,
                daysRemaining,
                category,
                renewalStatus: sale.renewalStatus || 'pending'
            };
        })
        .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));
}

function renderRenewalsTab() {
    const container = document.getElementById('renewals-list-container');
    let renewals = getRenewalData();

    // Apply filter
    if (currentRenewalFilter !== 'all') {
        renewals = renewals.filter(r => r.category === currentRenewalFilter);
    }

    // Update renewal count badge
    const urgentCount = renewals.filter(r => r.category === 'urgent' || r.category === 'expired').length;
    const renewalCountBadge = document.getElementById('renewals-count');
    if (renewalCountBadge) {
        if (urgentCount > 0) {
            renewalCountBadge.textContent = urgentCount;
            renewalCountBadge.classList.remove('hidden');
        } else {
            renewalCountBadge.classList.add('hidden');
        }
    }

    if (renewals.length === 0) {
        container.innerHTML = '<p class="text-center py-10 text-gray-500">لا توجد تجديدات متاحة</p>';
        return;
    }

    const groupedRenewals = {
        expired: renewals.filter(r => r.category === 'expired'),
        urgent: renewals.filter(r => r.category === 'urgent'),
        soon: renewals.filter(r => r.category === 'soon'),
        normal: renewals.filter(r => r.category === 'normal')
    };

    let html = '';
    
    Object.entries(groupedRenewals).forEach(([category, items]) => {
        if (items.length === 0) return;

        const categoryInfo = {
            expired: { title: 'منتهية', icon: 'fa-times-circle', color: 'text-red-600' },
            urgent: { title: 'عاجلة (خلال 3 أيام)', icon: 'fa-exclamation-triangle', color: 'text-orange-600' },
            soon: { title: 'قريبة (خلال 7 أيام)', icon: 'fa-clock', color: 'text-yellow-600' },
            normal: { title: 'عادية', icon: 'fa-check-circle', color: 'text-green-600' }
        };

        html += `
            <div class="mb-6">
                <h3 class="text-lg font-bold ${categoryInfo[category].color} mb-3 flex items-center">
                    <i class="fa-solid ${categoryInfo[category].icon} ml-2"></i>
                    ${categoryInfo[category].title} (${items.length})
                </h3>
                <div class="space-y-3">
                    ${items.map(renewal => {
                        const expiryDateStr = renewal.expiryDate ? 
                            renewal.expiryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
                        
                        const statusBadges = {
                            pending: { text: 'في الانتظار', color: 'bg-gray-200 text-gray-800' },
                            alerted: { text: 'تم التنبيه', color: 'bg-blue-200 text-blue-800' },
                            renewed: { text: 'تم التجديد', color: 'bg-green-200 text-green-800' },
                            'not-renewed': { text: 'لم يجدد', color: 'bg-red-200 text-red-800' }
                        };

                        const statusBadge = statusBadges[renewal.renewalStatus] || statusBadges.pending;

                        return `
                            <div class="main-card p-4 renewal-card ${category}">
                                <div class="flex flex-wrap justify-between items-start gap-4">
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-2">
                                            <h4 class="font-bold text-gray-800">${renewal.contactInfo || 'N/A'}</h4>
                                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusBadge.color}">
                                                ${statusBadge.text}
                                            </span>
                                        </div>
                                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <p class="text-gray-600">المنتج</p>
                                                <p class="font-semibold">${renewal.productName}</p>
                                            </div>
                                            <div>
                                                <p class="text-gray-600">الاشتراك</p>
                                                <p class="font-semibold">${renewal.subscription}</p>
                                            </div>
                                            <div>
                                                <p class="text-gray-600">تاريخ الانتهاء</p>
                                                <p class="font-semibold">${expiryDateStr}</p>
                                            </div>
                                            <div>
                                                <p class="text-gray-600">الأيام المتبقية</p>
                                                <p class="font-bold ${renewal.daysRemaining < 0 ? 'text-red-600' : 'text-green-600'}">
                                                    ${renewal.daysRemaining < 0 ? 'منتهي' : renewal.daysRemaining + ' يوم'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        ${renewal.renewalStatus === 'pending' ? `
                                            <button class="renewal-action-btn primary-btn text-xs py-1 px-3 bg-blue-600 hover:bg-blue-700" data-id="${renewal.id}" data-action="alerted">
                                                <i class="fa-solid fa-bell ml-1"></i>تم التنبيه
                                            </button>
                                        ` : ''}
                                        ${renewal.renewalStatus === 'alerted' || renewal.renewalStatus === 'pending' ? `
                                            <button class="renewal-action-btn primary-btn text-xs py-1 px-3 bg-green-600 hover:bg-green-700" data-id="${renewal.id}" data-action="renewed">
                                                <i class="fa-solid fa-check ml-1"></i>تم التجديد
                                            </button>
                                            <button class="renewal-action-btn primary-btn text-xs py-1 px-3 bg-red-600 hover:bg-red-700" data-id="${renewal.id}" data-action="not-renewed">
                                                <i class="fa-solid fa-times ml-1"></i>لم يجدد
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// --- ADVERTISING FUNCTIONS ---
function renderAdvertisingSection() {
    renderAdCampaignsTable();
    renderAdCharts();
}

function renderAdCampaignsTable() {
    const tbody = document.getElementById('ad-campaigns-tbody');
    let campaigns = [...allAdCampaigns];

    // Apply product filter
    if (currentAdProductFilter !== 'all') {
        campaigns = campaigns.filter(c => c.productName === currentAdProductFilter);
    }

    if (campaigns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-500">لا توجد حملات إعلانية</td></tr>';
        return;
    }

    tbody.innerHTML = campaigns.map(campaign => {
        const startDate = campaign.startDate?.seconds ? 
            new Date(campaign.startDate.seconds * 1000).toLocaleDateString('ar-EG') : '-';
        const endDate = campaign.endDate?.seconds ? 
            new Date(campaign.endDate.seconds * 1000).toLocaleDateString('ar-EG') : 'مستمرة';

        const platformClass = `platform-${campaign.platform.toLowerCase()}`;

        return `
            <tr class="ad-campaign-row">
                <td class="px-4 py-3" data-label="المنتج">
                    <span class="font-semibold text-gray-800">${campaign.productName}</span>
                </td>
                <td class="px-4 py-3" data-label="المنصة">
                    <span class="platform-badge ${platformClass}">${campaign.platform}</span>
                </td>
                <td class="px-4 py-3" data-label="المبلغ">
                    <span class="font-bold text-purple-600">${campaign.amount.toFixed(2)} EGP</span>
                </td>
                <td class="px-4 py-3" data-label="التاريخ">
                    <div class="text-sm">
                        <p>${startDate}</p>
                        <p class="text-gray-500 text-xs">${endDate}</p>
                    </div>
                </td>
                <td class="px-4 py-3" data-label="الإجراءات">
                    <div class="flex gap-2">
                        <button class="text-red-500 hover:text-red-700 delete-ad-campaign-btn" data-id="${campaign.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderAdCharts() {
    // Ad Spend by Product Chart
    const adSpendByProduct = {};
    allAdCampaigns.forEach(campaign => {
        if (!adSpendByProduct[campaign.productName]) {
            adSpendByProduct[campaign.productName] = 0;
        }
        adSpendByProduct[campaign.productName] += campaign.amount || 0;
    });

    const adSpendCtx = document.getElementById('ad-spend-by-product-chart')?.getContext('2d');
    if (adSpendCtx) {
        if (adSpendChart) adSpendChart.destroy();
        
        adSpendChart = new Chart(adSpendCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(adSpendByProduct),
                datasets: [{
                    data: Object.values(adSpendByProduct),
                    backgroundColor: ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.label}: ${context.parsed.toFixed(2)} EGP`
                        }
                    }
                }
            }
        });
    }

    // ROAS by Product Chart
    const roasByProduct = {};
    allProducts.forEach(product => {
        const productSales = allSales.filter(s => s.isConfirmed && s.productName === product.name);
        const productAdSpend = allAdCampaigns
            .filter(c => c.productName === product.name)
            .reduce((sum, c) => sum + (c.amount || 0), 0);
        const productRevenue = productSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
        
        if (productAdSpend > 0) {
            roasByProduct[product.name] = productRevenue / productAdSpend;
        }
    });

    const roasCtx = document.getElementById('roas-by-product-chart')?.getContext('2d');
    if (roasCtx) {
        if (roasChart) roasChart.destroy();
        
        roasChart = new Chart(roasCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(roasByProduct),
                datasets: [{
                    label: 'ROAS',
                    data: Object.values(roasByProduct),
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => value.toFixed(2) + 'x'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `ROAS: ${context.parsed.y.toFixed(2)}x`
                        }
                    }
                }
            }
        });
    }
}

function updateAdProductFilters() {
    const container = document.querySelector('.ad-product-filter')?.parentElement;
    if (!container) return;
    
    container.innerHTML = '<button class="filter-btn active ad-product-filter" data-product="all">كل المنتجات</button>';
    
    allProducts.forEach(product => {
        const count = allAdCampaigns.filter(c => c.productName === product.name).length;
        if (count > 0) {
            const btn = document.createElement('button');
            btn.className = 'filter-btn ad-product-filter';
            btn.dataset.product = product.name;
            btn.textContent = `${product.name} (${count})`;
            container.appendChild(btn);
        }
    });
}

// --- APP INITIALIZATION ---
async function initializeAppAndListeners() {
    console.log('🚀 بدء تهيئة التطبيق...');
    
    // Check connection status on load
    updateConnectionStatus(navigator.onLine);
    
    if (!navigator.onLine) {
        console.warn('⚠️ بدء التشغيل في وضع عدم الاتصال');
        showNotification('تم البدء في وضع عدم الاتصال. بعض الميزات قد لا تعمل.', 'info');
    }
    
    console.log('🔐 فحص المصادقة...');
    // Check authentication immediately
    const isAuthenticated = await checkAuthenticationOnLoad();
    if (!isAuthenticated) {
        console.error('❌ فشل المصادقة');
        return;
    }
    console.log('✅ تم التحقق من المصادقة');

    console.log('⚙️ تهيئة الإعدادات الأساسية...');
    initDarkMode();
    setupChartDefaults();
    setupEventListeners();
    setupFormSubmissions();
    setupDynamicEventListeners();
    console.log('✅ تم إعداد الإعدادات الأساسية');

    // Initialize authentication and check permissions
    try {
        console.log('🔑 تهيئة نظام المصادقة والأذونات...');
        await initAuth(auth, db);
        console.log("✅ تم التحقق من المستخدم بنجاح");
        
        // Apply UI restrictions based on user role
        applyUIRestrictions();
        
        // Check and display unauthorized access screens
        checkAndDisplayUnauthorizedScreens();
        
        // Initialize user management for admins
        initUserManagement(db, showNotification);
        
        // Add logout button listener
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#logout-btn')) {
                logout(auth);
            }
        });
        
    } catch (error) {
        console.error("❌ فشل المصادقة:", error);
        return; // Stop initialization if auth fails
    }

    // Fetch initial data to show the UI quickly, then set up real-time listeners
    try {
        console.log('📊 جلب البيانات الأولية من Firebase...');
        const [salesSnap, expensesSnap, accountsSnap, productsSnap, problemsSnap, adCampaignsSnap] = await Promise.all([
            getDocs(query(collection(db, PATH_SALES), orderBy("date", "desc"))),
            getDocs(query(collection(db, PATH_EXPENSES), orderBy("date", "desc"))),
            getDocs(query(collection(db, PATH_ACCOUNTS), orderBy("purchase_date", "desc"))),
            getDocs(query(collection(db, PATH_PRODUCTS), orderBy("name"))),
            getDocs(query(collection(db, PATH_PROBLEMS), orderBy("date", "desc"))),
            getDocs(query(collection(db, PATH_AD_CAMPAIGNS), orderBy("createdAt", "desc"))).catch(() => ({ docs: [] }))
        ]);

        allSales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allExpenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allProblems = problemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        allAdCampaigns = adCampaignsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        console.log(`✅ تم جلب البيانات: ${allSales.length} مبيعة، ${allAccounts.length} حساب، ${allProducts.length} منتج`);
        
        console.log('🎨 عرض البيانات في الواجهة...');
        populateProductDropdowns();
        renderProductList();
        renderData();
        renderAdvertisingSection();
        updateAdProductFilters();
        
        // Initialize shift statistics with today's date
        renderShiftStatistics(new Date());
        
        console.log('✅ إخفاء شاشة التحميل وعرض المحتوى');
        document.getElementById('dashboard-loader').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
        
        console.log('🎉 تم تحميل التطبيق بنجاح!');

    } catch (error) {
        console.error("Error fetching initial data:", error);
        
        // Show more specific error message
        let errorMessage = 'فشل الاتصال بقاعدة البيانات.';
        if (error.code === 'unavailable') {
            errorMessage = 'خطأ في الاتصال بالخادم. تحقق من اتصال الإنترنت.';
        } else if (error.code === 'permission-denied') {
            errorMessage = 'تم رفض الصلاحية. يرجى تسجيل الدخول مرة أخرى.';
        } else if (error.message) {
            errorMessage = `خطأ: ${error.message}`;
        }
        
        document.getElementById('dashboard-loader').innerHTML = `
            <div class="text-center py-10">
                <div class="text-red-500 text-xl font-bold mb-4">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p>${errorMessage}</p>
                </div>
                <button onclick="location.reload()" class="primary-btn mt-4">
                    <i class="fas fa-sync-alt ml-2"></i>إعادة تحميل الصفحة
                </button>
            </div>
        `;
        
        showNotification(errorMessage, "danger");
    }

    // Set up real-time listeners with error handling
    onSnapshot(
        query(collection(db, PATH_SALES), orderBy("date", "desc")), 
        snap => { 
            allSales = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
            renderData(); 
            renderRenewalsTab();
            if (shiftDatePicker && shiftDatePicker.selectedDates.length > 0) {
                renderShiftStatistics(shiftDatePicker.selectedDates[0]);
            }
        },
        error => {
            console.error("خطأ في الاستماع للمبيعات:", error);
            showNotification("فقد الاتصال بقاعدة بيانات المبيعات. جاري إعادة المحاولة...", "danger");
        }
    );
    
    onSnapshot(
        query(collection(db, PATH_EXPENSES), orderBy("date", "desc")), 
        snap => { 
            allExpenses = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
            renderData(); 
        },
        error => {
            console.error("خطأ في الاستماع للمصروفات:", error);
            showNotification("فقد الاتصال بقاعدة بيانات المصروفات. جاري إعادة المحاولة...", "danger");
        }
    );
    
    onSnapshot(
        query(collection(db, PATH_ACCOUNTS), orderBy("purchase_date", "desc")), 
        snap => { 
            allAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
            renderData(); 
        },
        error => {
            console.error("خطأ في الاستماع للحسابات:", error);
            showNotification("فقد الاتصال بقاعدة بيانات الحسابات. جاري إعادة المحاولة...", "danger");
        }
    );
    
    onSnapshot(
        query(collection(db, PATH_PRODUCTS), orderBy("name")), 
        snap => { 
            allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
            populateProductDropdowns(); 
            renderProductList(); 
            renderData();
            updateAdProductFilters();
        },
        error => {
            console.error("خطأ في الاستماع للمنتجات:", error);
            showNotification("فقد الاتصال بقاعدة بيانات المنتجات. جاري إعادة المحاولة...", "danger");
        }
    );
    
    onSnapshot(
        query(collection(db, PATH_PROBLEMS), orderBy("date", "desc")), 
        snap => { 
            allProblems = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
            renderData(); 
        },
        error => {
            console.error("خطأ في الاستماع للمشاكل:", error);
            showNotification("فقد الاتصال بقاعدة بيانات المشاكل. جاري إعادة المحاولة...", "danger");
        }
    );
    
    onSnapshot(
        query(collection(db, PATH_AD_CAMPAIGNS), orderBy("createdAt", "desc")), 
        snap => { 
            allAdCampaigns = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
            renderAdvertisingSection();
            updateAdProductFilters();
            renderData(); // To update ROAS calculations in dashboard
        },
        error => {
            console.error("خطأ في الاستماع للحملات الإعلانية:", error);
            showNotification("فقد الاتصال بقاعدة بيانات الحملات الإعلانية. جاري إعادة المحاولة...", "danger");
        }
    );
}

// Wait for all required libraries to load before initializing
function waitForLibraries() {
    console.log('⏳ انتظار تحميل المكتبات المطلوبة...');
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.error('❌ انتهت مهلة تحميل المكتبات');
            reject(new Error('انتهت مهلة تحميل المكتبات. تحقق من اتصال الإنترنت.'));
        }, 10000); // 10 seconds timeout
        
        const checkLibraries = () => {
            const chartLoaded = typeof Chart !== 'undefined';
            const flatpickrLoaded = typeof flatpickr !== 'undefined';
            const xlsxLoaded = typeof XLSX !== 'undefined';
            
            if (chartLoaded && flatpickrLoaded && xlsxLoaded) {
                console.log('✅ تم تحميل جميع المكتبات بنجاح');
                clearTimeout(timeout);
                resolve();
            } else {
                const missing = [];
                if (!chartLoaded) missing.push('Chart.js');
                if (!flatpickrLoaded) missing.push('Flatpickr');
                if (!xlsxLoaded) missing.push('XLSX');
                console.log(`⏳ انتظار المكتبات: ${missing.join(', ')}`);
                setTimeout(checkLibraries, 100);
            }
        };
        checkLibraries();
    });
}

// Initialize app when DOM and libraries are ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await waitForLibraries();
            await initializeAppAndListeners();
        } catch (error) {
            console.error('فشل تهيئة التطبيق:', error);
            const loader = document.getElementById('dashboard-loader');
            if (loader) {
                loader.innerHTML = `
                    <div class="text-center py-10">
                        <div class="text-red-500 text-xl font-bold mb-4">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>حدث خطأ أثناء تحميل التطبيق</p>
                            <p class="text-sm mt-2">${error.message}</p>
                        </div>
                        <button onclick="location.reload()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md mt-4">
                            <i class="fas fa-sync-alt ml-2"></i>إعادة تحميل الصفحة
                        </button>
                    </div>
                `;
            }
        }
    });
} else {
    waitForLibraries().then(async () => {
        try {
            await initializeAppAndListeners();
        } catch (error) {
            console.error('فشل تهيئة التطبيق:', error);
            const loader = document.getElementById('dashboard-loader');
            if (loader) {
                loader.innerHTML = `
                    <div class="text-center py-10">
                        <div class="text-red-500 text-xl font-bold mb-4">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>حدث خطأ أثناء تحميل التطبيق</p>
                            <p class="text-sm mt-2">${error.message}</p>
                        </div>
                        <button onclick="location.reload()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-md mt-4">
                            <i class="fas fa-sync-alt ml-2"></i>إعادة تحميل الصفحة
                        </button>
                    </div>
                `;
            }
        }
    });
}
