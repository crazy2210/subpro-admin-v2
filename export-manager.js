// export-manager.js - Excel/CSV Export Manager
// Note: This uses SheetJS (xlsx) library which should be included in HTML:
// <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>

/**
 * Export sales/orders to Excel
 */
export function exportSalesToExcel(sales, filename = 'sales_export') {
    if (!window.XLSX) {
        alert('مكتبة Excel غير محملة. يرجى تحديث الصفحة.');
        return;
    }

    // Prepare data
    const data = sales.map((sale, index) => ({
        '#': index + 1,
        'Order ID': sale.id || '',
        'التاريخ': sale.date?.seconds ? new Date(sale.date.seconds * 1000).toLocaleDateString('ar-EG') : '',
        'الوقت': sale.date?.seconds ? new Date(sale.date.seconds * 1000).toLocaleTimeString('ar-EG') : '',
        'اسم العميل': sale.customerName || '',
        'رقم التواصل': sale.contactInfo || '',
        'المنتج': sale.productName || '',
        'نوع الاشتراك': sale.subscription || '',
        'سعر البيع': sale.sellingPrice || 0,
        'سعر التكلفة': sale.costPrice || 0,
        'الربح': (sale.sellingPrice || 0) - (sale.costPrice || 0),
        'نوع الدفع': sale.paymentType || '',
        'مصدر البيع': sale.salesSource || '',
        'الحساب المستخدم': sale.accountEmail || '',
        'اسم التاجر': sale.traderName || '',
        'الحالة': sale.isConfirmed ? 'مؤكد' : 'غير مؤكد',
        'ملاحظات': sale.notes || ''
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 15 },  // Order ID
        { wch: 12 },  // Date
        { wch: 10 },  // Time
        { wch: 20 },  // Customer Name
        { wch: 15 },  // Contact
        { wch: 15 },  // Product
        { wch: 12 },  // Subscription
        { wch: 12 },  // Selling Price
        { wch: 12 },  // Cost Price
        { wch: 10 },  // Profit
        { wch: 12 },  // Payment Type
        { wch: 15 },  // Sales Source
        { wch: 25 },  // Account Email
        { wch: 15 },  // Trader Name
        { wch: 10 },  // Status
        { wch: 30 }   // Notes
    ];

    // Add summary sheet
    const summary = {
        'إجمالي الأوردرات': sales.length,
        'الأوردرات المؤكدة': sales.filter(s => s.isConfirmed).length,
        'إجمالي المبيعات': sales.filter(s => s.isConfirmed).reduce((sum, s) => sum + (s.sellingPrice || 0), 0).toFixed(2),
        'إجمالي التكلفة': sales.filter(s => s.isConfirmed).reduce((sum, s) => sum + (s.costPrice || 0), 0).toFixed(2),
        'صافي الربح': sales.filter(s => s.isConfirmed).reduce((sum, s) => sum + ((s.sellingPrice || 0) - (s.costPrice || 0)), 0).toFixed(2)
    };

    const summaryData = Object.entries(summary).map(([key, value]) => ({
        'المؤشر': key,
        'القيمة': value
    }));

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];

    // Add sheets to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'المبيعات');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    // Download
    XLSX.writeFile(wb, finalFilename);
}

/**
 * Export accounts to Excel
 */
export function exportAccountsToExcel(accounts, filename = 'accounts_export') {
    if (!window.XLSX) {
        alert('مكتبة Excel غير محملة. يرجى تحديث الصفحة.');
        return;
    }

    // Prepare data
    const data = accounts.map((account, index) => ({
        '#': index + 1,
        'Account ID': account.id || '',
        'المنتج': account.productName || '',
        'البريد الإلكتروني': account.email || '',
        'كلمة المرور': account.password || '',
        'الحالة': account.is_active ? 'نشط' : 'غير نشط',
        'عدد الاستخدامات': account.current_uses || 0,
        'الحد المسموح': account.allowed_uses === Infinity ? 'غير محدود' : (account.allowed_uses || 0),
        'الاستخدام المتبقي': account.allowed_uses === Infinity ? 'غير محدود' : Math.max(0, (account.allowed_uses || 0) - (account.current_uses || 0)),
        'تاريخ الإنشاء': account.createdAt ? new Date(account.createdAt).toLocaleDateString('ar-EG') : '',
        'ملاحظات': account.notes || ''
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 15 },  // Account ID
        { wch: 15 },  // Product
        { wch: 30 },  // Email
        { wch: 20 },  // Password
        { wch: 10 },  // Status
        { wch: 12 },  // Current Uses
        { wch: 12 },  // Allowed Uses
        { wch: 15 },  // Remaining
        { wch: 12 },  // Created At
        { wch: 30 }   // Notes
    ];

    // Add summary
    const activeAccounts = accounts.filter(a => a.is_active);
    const availableAccounts = accounts.filter(a => a.is_active && a.current_uses < a.allowed_uses);
    
    const summary = {
        'إجمالي الأكونتات': accounts.length,
        'الأكونتات النشطة': activeAccounts.length,
        'الأكونتات المتاحة': availableAccounts.length,
        'الأكونتات المستهلكة': accounts.filter(a => a.current_uses >= a.allowed_uses && a.allowed_uses !== Infinity).length
    };

    const summaryData = Object.entries(summary).map(([key, value]) => ({
        'المؤشر': key,
        'القيمة': value
    }));

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, 'الأكونتات');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص');

    const timestamp = new Date().toISOString().slice(0, 10);
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    XLSX.writeFile(wb, finalFilename);
}

/**
 * Export expenses to Excel
 */
export function exportExpensesToExcel(expenses, filename = 'expenses_export') {
    if (!window.XLSX) {
        alert('مكتبة Excel غير محملة. يرجى تحديث الصفحة.');
        return;
    }

    const data = expenses.map((expense, index) => ({
        '#': index + 1,
        'Expense ID': expense.id || '',
        'التاريخ': expense.date?.seconds ? new Date(expense.date.seconds * 1000).toLocaleDateString('ar-EG') : '',
        'النوع': expense.type || '',
        'المبلغ': expense.amount || 0,
        'الوصف': expense.description || '',
        'المنتج المرتبط': expense.linkedProduct || 'عام',
        'الفئة': expense.category || 'أخرى'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 15 },  // Expense ID
        { wch: 12 },  // Date
        { wch: 15 },  // Type
        { wch: 12 },  // Amount
        { wch: 35 },  // Description
        { wch: 15 },  // Linked Product
        { wch: 12 }   // Category
    ];

    // Add summary
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const expensesByType = {};
    expenses.forEach(e => {
        const type = e.type || 'أخرى';
        expensesByType[type] = (expensesByType[type] || 0) + (e.amount || 0);
    });

    const summaryData = [
        { 'المؤشر': 'إجمالي المصروفات', 'القيمة': totalExpenses.toFixed(2) },
        ...Object.entries(expensesByType).map(([type, amount]) => ({
            'المؤشر': `مصروفات ${type}`,
            'القيمة': amount.toFixed(2)
        }))
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, 'المصروفات');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص');

    const timestamp = new Date().toISOString().slice(0, 10);
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    XLSX.writeFile(wb, finalFilename);
}

/**
 * Export comprehensive statistics to Excel
 */
export function exportStatisticsToExcel(sales, expenses, accounts, products, filename = 'statistics_export') {
    if (!window.XLSX) {
        alert('مكتبة Excel غير محملة. يرجى تحديث الصفحة.');
        return;
    }

    const wb = XLSX.utils.book_new();
    
    // Overall Summary
    const confirmedSales = sales.filter(s => s.isConfirmed);
    const totalRevenue = confirmedSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
    const totalCost = confirmedSales.reduce((sum, s) => sum + (s.costPrice || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalRevenue - totalCost - totalExpenses;

    const overallData = [
        { 'المؤشر': 'إجمالي الأوردرات', 'القيمة': sales.length },
        { 'المؤشر': 'الأوردرات المؤكدة', 'القيمة': confirmedSales.length },
        { 'المؤشر': 'إجمالي المبيعات', 'القيمة': totalRevenue.toFixed(2) },
        { 'المؤشر': 'إجمالي التكلفة', 'القيمة': totalCost.toFixed(2) },
        { 'المؤشر': 'إجمالي المصروفات', 'القيمة': totalExpenses.toFixed(2) },
        { 'المؤشر': 'صافي الربح', 'القيمة': netProfit.toFixed(2) },
        { 'المؤشر': 'هامش الربح', 'القيمة': totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%' },
        { 'المؤشر': 'إجمالي الأكونتات', 'القيمة': accounts.length },
        { 'المؤشر': 'إجمالي المنتجات', 'القيمة': products.length }
    ];

    const wsOverall = XLSX.utils.json_to_sheet(overallData);
    wsOverall['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsOverall, 'الملخص العام');

    // Product-wise breakdown
    const productStats = {};
    confirmedSales.forEach(sale => {
        const product = sale.productName || 'Unknown';
        if (!productStats[product]) {
            productStats[product] = {
                count: 0,
                revenue: 0,
                cost: 0,
                profit: 0
            };
        }
        productStats[product].count++;
        productStats[product].revenue += (sale.sellingPrice || 0);
        productStats[product].cost += (sale.costPrice || 0);
        productStats[product].profit += ((sale.sellingPrice || 0) - (sale.costPrice || 0));
    });

    const productData = Object.entries(productStats).map(([product, stats]) => ({
        'المنتج': product,
        'عدد المبيعات': stats.count,
        'الإيرادات': stats.revenue.toFixed(2),
        'التكلفة': stats.cost.toFixed(2),
        'الربح': stats.profit.toFixed(2),
        'هامش الربح': stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) + '%' : '0%'
    }));

    const wsProducts = XLSX.utils.json_to_sheet(productData);
    wsProducts['!cols'] = [
        { wch: 20 }, // Product
        { wch: 12 }, // Count
        { wch: 15 }, // Revenue
        { wch: 15 }, // Cost
        { wch: 15 }, // Profit
        { wch: 12 }  // Margin
    ];
    XLSX.utils.book_append_sheet(wb, wsProducts, 'تحليل المنتجات');

    // Daily performance (last 30 days)
    const dailyStats = {};
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    confirmedSales.forEach(sale => {
        if (!sale.date?.seconds) return;
        const saleDate = new Date(sale.date.seconds * 1000);
        if (saleDate < last30Days) return;
        
        const dateKey = saleDate.toLocaleDateString('ar-EG');
        if (!dailyStats[dateKey]) {
            dailyStats[dateKey] = {
                orders: 0,
                revenue: 0,
                profit: 0
            };
        }
        dailyStats[dateKey].orders++;
        dailyStats[dateKey].revenue += (sale.sellingPrice || 0);
        dailyStats[dateKey].profit += ((sale.sellingPrice || 0) - (sale.costPrice || 0));
    });

    const dailyData = Object.entries(dailyStats)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .map(([date, stats]) => ({
            'التاريخ': date,
            'عدد الأوردرات': stats.orders,
            'الإيرادات': stats.revenue.toFixed(2),
            'الربح': stats.profit.toFixed(2)
        }));

    if (dailyData.length > 0) {
        const wsDaily = XLSX.utils.json_to_sheet(dailyData);
        wsDaily['!cols'] = [
            { wch: 15 }, // Date
            { wch: 12 }, // Orders
            { wch: 15 }, // Revenue
            { wch: 15 }  // Profit
        ];
        XLSX.utils.book_append_sheet(wb, wsDaily, 'الأداء اليومي');
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    XLSX.writeFile(wb, finalFilename);
}

/**
 * Export shift report to Excel
 */
export function exportShiftReportToExcel(report, filename = 'shift_report') {
    if (!window.XLSX) {
        alert('مكتبة Excel غير محملة. يرجى تحديث الصفحة.');
        return;
    }

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
        { 'المؤشر': 'نوع الشيفت', 'القيمة': report.shiftName },
        { 'المؤشر': 'التاريخ', 'القيمة': new Date(report.shiftDate).toLocaleDateString('ar-EG') },
        { 'المؤشر': 'وقت البدء', 'القيمة': new Date(report.startTime).toLocaleTimeString('ar-EG') },
        { 'المؤشر': 'وقت الانتهاء', 'القيمة': new Date(report.endTime).toLocaleTimeString('ar-EG') },
        { 'المؤشر': 'المشرف', 'القيمة': report.moderator || 'غير محدد' },
        { 'المؤشر': '', 'القيمة': '' },
        { 'المؤشر': 'إجمالي الأوردرات', 'القيمة': report.summary.totalOrders },
        { 'المؤشر': 'الأوردرات المؤكدة', 'القيمة': report.summary.confirmedOrders },
        { 'المؤشر': 'إجمالي الإيرادات', 'القيمة': report.summary.totalRevenue.toFixed(2) },
        { 'المؤشر': 'إجمالي المصروفات', 'القيمة': report.summary.totalExpenses.toFixed(2) },
        { 'المؤشر': 'صافي الربح', 'القيمة': report.summary.totalProfit.toFixed(2) },
        { 'المؤشر': 'الأكونتات المستخدمة', 'القيمة': report.summary.accountsUsed },
        { 'المؤشر': '', 'القيمة': '' },
        { 'المؤشر': 'معدل التحويل', 'القيمة': report.metrics.conversionRate + '%' },
        { 'المؤشر': 'متوسط قيمة الأوردر', 'القيمة': report.metrics.avgOrderValue },
        { 'المؤشر': 'أوردرات في الساعة', 'القيمة': report.metrics.ordersPerHour }
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص');

    // Product breakdown
    if (report.breakdowns.products && Object.keys(report.breakdowns.products).length > 0) {
        const productData = Object.entries(report.breakdowns.products).map(([product, data]) => ({
            'المنتج': product,
            'الكمية': data.count,
            'الإيرادات': data.revenue.toFixed(2),
            'التكلفة': data.cost.toFixed(2),
            'الربح': data.profit.toFixed(2)
        }));

        const wsProducts = XLSX.utils.json_to_sheet(productData);
        wsProducts['!cols'] = [
            { wch: 20 }, // Product
            { wch: 10 }, // Count
            { wch: 15 }, // Revenue
            { wch: 15 }, // Cost
            { wch: 15 }  // Profit
        ];
        XLSX.utils.book_append_sheet(wb, wsProducts, 'تفصيل المنتجات');
    }

    // Sales details
    if (report.details.sales && report.details.sales.length > 0) {
        const salesData = report.details.sales.map((sale, index) => ({
            '#': index + 1,
            'Order ID': sale.id,
            'اسم العميل': sale.customer,
            'المنتج': sale.product,
            'السعر': sale.price,
            'الحالة': sale.status === 'confirmed' ? 'مؤكد' : 'غير مؤكد'
        }));

        const wsSales = XLSX.utils.json_to_sheet(salesData);
        wsSales['!cols'] = [
            { wch: 5 },  // #
            { wch: 15 }, // Order ID
            { wch: 20 }, // Customer
            { wch: 15 }, // Product
            { wch: 12 }, // Price
            { wch: 10 }  // Status
        ];
        XLSX.utils.book_append_sheet(wb, wsSales, 'تفاصيل المبيعات');
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const finalFilename = `${filename}_${timestamp}.xlsx`;

    XLSX.writeFile(wb, finalFilename);
}

/**
 * Export data to CSV (simpler format)
 */
export function exportToCSV(data, filename = 'export') {
    const csvContent = convertToCSV(data);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) value = '';
            value = value.toString().replace(/"/g, '""');
            return `"${value}"`;
        }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
}
