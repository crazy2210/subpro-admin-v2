// product-statistics.js - نظام إحصائيات المنتجات المتقدم

// متغيرات عامة لإحصائيات المنتجات
let productStatsDateRange = { start: null, end: null };
let productStatsFlatpickr = null;

/**
 * تهيئة نظام إحصائيات المنتجات
 */
export function initProductStatistics(db, allSales, allProducts) {
    // تهيئة منتقي التاريخ
    productStatsFlatpickr = flatpickr("#product-stats-date-filter", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "ar",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                productStatsDateRange.start = new Date(selectedDates[0].setHours(0, 0, 0, 0));
                productStatsDateRange.end = new Date(selectedDates[1].setHours(23, 59, 59, 999));
                renderProductStatistics(allSales, allProducts);
            } else if (selectedDates.length === 0) {
                productStatsDateRange.start = null;
                productStatsDateRange.end = null;
                renderProductStatistics(allSales, allProducts);
            }
        }
    });
    
    // زر مسح الفلتر
    document.getElementById('clear-product-stats-date-btn')?.addEventListener('click', () => {
        if (productStatsFlatpickr) {
            productStatsFlatpickr.clear();
        }
        productStatsDateRange = { start: null, end: null };
        renderProductStatistics(allSales, allProducts);
    });
    
    // زر التحديث
    document.getElementById('refresh-product-stats-btn')?.addEventListener('click', () => {
        renderProductStatistics(allSales, allProducts);
    });
    
    // زر التصدير
    document.getElementById('export-product-stats-btn')?.addEventListener('click', () => {
        exportProductStatistics(allSales, allProducts);
    });
    
    // عرض الإحصائيات الأولية
    renderProductStatistics(allSales, allProducts);
}

/**
 * حساب إحصائيات كل منتج
 */
function calculateProductStatistics(allSales, allProducts) {
    // فلترة المبيعات حسب النطاق الزمني
    let filteredSales = [...allSales];
    
    if (productStatsDateRange.start && productStatsDateRange.end) {
        filteredSales = filteredSales.filter(sale => {
            const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000) : null;
            return saleDate && saleDate >= productStatsDateRange.start && saleDate <= productStatsDateRange.end;
        });
    }
    
    // حساب الإجمالي
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
    const totalCost = filteredSales.reduce((sum, s) => sum + (s.costPrice || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    
    // إحصائيات لكل منتج
    const productStats = {};
    
    filteredSales.forEach(sale => {
        const productName = sale.productName || 'غير محدد';
        
        if (!productStats[productName]) {
            productStats[productName] = {
                productName: productName,
                orderCount: 0,
                revenue: 0,
                cost: 0,
                profit: 0,
                averagePrice: 0
            };
        }
        
        productStats[productName].orderCount++;
        productStats[productName].revenue += (sale.sellingPrice || 0);
        productStats[productName].cost += (sale.costPrice || 0);
        productStats[productName].profit += (sale.sellingPrice || 0) - (sale.costPrice || 0);
    });
    
    // حساب المتوسطات والنسب
    Object.keys(productStats).forEach(productName => {
        const stats = productStats[productName];
        stats.averagePrice = stats.orderCount > 0 ? stats.revenue / stats.orderCount : 0;
        stats.percentage = totalRevenue > 0 ? (stats.revenue / totalRevenue * 100).toFixed(2) : 0;
    });
    
    // تحويل إلى مصفوفة وترتيب حسب الإيرادات
    const statsArray = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);
    
    return {
        products: statsArray,
        totals: {
            totalProducts: statsArray.length,
            totalOrders: filteredSales.length,
            totalRevenue: totalRevenue,
            totalCost: totalCost,
            totalProfit: totalProfit
        }
    };
}

/**
 * عرض إحصائيات المنتجات
 */
function renderProductStatistics(allSales, allProducts) {
    const stats = calculateProductStatistics(allSales, allProducts);
    
    // تحديث البطاقات الملخصة
    document.getElementById('total-products-count').textContent = stats.totals.totalProducts;
    document.getElementById('total-product-orders').textContent = stats.totals.totalOrders;
    document.getElementById('total-product-revenue').textContent = `${stats.totals.totalRevenue.toFixed(2)} EGP`;
    document.getElementById('total-product-profit').textContent = `${stats.totals.totalProfit.toFixed(2)} EGP`;
    
    // عرض الجدول
    const tbody = document.getElementById('product-stats-tbody');
    tbody.innerHTML = '';
    
    if (stats.products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-10 text-center text-gray-500">
                    <i class="fas fa-info-circle text-4xl mb-2 block"></i>
                    لا توجد بيانات لعرضها
                </td>
            </tr>
        `;
        return;
    }
    
    stats.products.forEach((product, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        
        // تحديد لون الربح
        const profitColor = product.profit >= 0 ? 'text-green-600' : 'text-red-600';
        
        row.innerHTML = `
            <td class="px-4 py-3" data-label="المنتج">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold">
                        ${index + 1}
                    </span>
                    <span class="font-semibold text-gray-800">${product.productName}</span>
                </div>
            </td>
            <td class="px-4 py-3" data-label="عدد الطلبات">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ${product.orderCount} طلب
                </span>
            </td>
            <td class="px-4 py-3 font-semibold text-cyan-600" data-label="الإيرادات">
                ${product.revenue.toFixed(2)} EGP
            </td>
            <td class="px-4 py-3 font-semibold text-orange-600" data-label="التكلفة">
                ${product.cost.toFixed(2)} EGP
            </td>
            <td class="px-4 py-3 font-bold ${profitColor}" data-label="الربح">
                ${product.profit.toFixed(2)} EGP
            </td>
            <td class="px-4 py-3" data-label="النسبة">
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div class="bg-indigo-600 h-2 rounded-full transition-all" style="width: ${product.percentage}%"></div>
                    </div>
                    <span class="text-sm font-semibold text-gray-700">${product.percentage}%</span>
                </div>
            </td>
            <td class="px-4 py-3 font-semibold text-purple-600" data-label="متوسط السعر">
                ${product.averagePrice.toFixed(2)} EGP
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * تصدير إحصائيات المنتجات إلى Excel
 */
function exportProductStatistics(allSales, allProducts) {
    const stats = calculateProductStatistics(allSales, allProducts);
    
    const exportData = stats.products.map((product, index) => ({
        'الترتيب': index + 1,
        'المنتج': product.productName,
        'عدد الطلبات': product.orderCount,
        'الإيرادات': product.revenue.toFixed(2),
        'التكلفة': product.cost.toFixed(2),
        'الربح': product.profit.toFixed(2),
        'النسبة %': product.percentage,
        'متوسط السعر': product.averagePrice.toFixed(2)
    }));
    
    // إضافة صف الإجمالي
    exportData.push({
        'الترتيب': '',
        'المنتج': 'الإجمالي',
        'عدد الطلبات': stats.totals.totalOrders,
        'الإيرادات': stats.totals.totalRevenue.toFixed(2),
        'التكلفة': stats.totals.totalCost.toFixed(2),
        'الربح': stats.totals.totalProfit.toFixed(2),
        'النسبة %': '100.00',
        'متوسط السعر': stats.totals.totalOrders > 0 ? (stats.totals.totalRevenue / stats.totals.totalOrders).toFixed(2) : '0.00'
    });
    
    // التصدير باستخدام XLSX
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'إحصائيات المنتجات');
        
        const dateRange = productStatsDateRange.start && productStatsDateRange.end 
            ? `_${productStatsDateRange.start.toISOString().split('T')[0]}_${productStatsDateRange.end.toISOString().split('T')[0]}`
            : '';
        
        XLSX.writeFile(wb, `product_statistics${dateRange}.xlsx`);
        
        // إشعار بالنجاح
        if (typeof showNotification === 'function') {
            showNotification('تم تصدير الإحصائيات بنجاح', 'success');
        }
    } else {
        console.error('مكتبة XLSX غير متوفرة');
        if (typeof showNotification === 'function') {
            showNotification('فشل التصدير: المكتبة غير متوفرة', 'danger');
        }
    }
}

// تصدير الوظائف
export default {
    initProductStatistics,
    renderProductStatistics,
    calculateProductStatistics,
    exportProductStatistics
};
