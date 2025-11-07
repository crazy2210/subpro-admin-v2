// automation.js - Automation and Export Module for SubPro Dashboard V3

// Export shift report to Excel
export async function exportShiftReportToExcel(shiftDate, shiftKey, shiftData, allSalesData) {
    try {
        const XLSX = window.XLSX;
        if (!XLSX) {
            throw new Error('XLSX library not loaded');
        }

        const shiftInfo = {
            NIGHT: { name: 'الشيفت الليلي', time: '12:00 ص - 8:00 ص' },
            MORNING: { name: 'شيفت الصباح', time: '8:00 ص - 4:00 م' },
            EVENING: { name: 'شيفت العصر', time: '4:00 م - 12:00 ص' }
        };

        const shift = shiftInfo[shiftKey];
        const dateStr = shiftDate.toLocaleDateString('ar-EG');
        
        // Summary Data
        const summaryData = [
            ['تقرير الشيفت - SubPro Dashboard'],
            ['التاريخ:', dateStr],
            ['الشيفت:', shift.name],
            ['الوقت:', shift.time],
            [''],
            ['ملخص الأداء'],
            ['إجمالي الطلبات:', shiftData.count],
            ['إجمالي الإيرادات:', `${shiftData.revenue.toFixed(2)} EGP`],
            ['إجمالي الربح:', `${shiftData.profit.toFixed(2)} EGP`],
            ['متوسط الربح للطلب:', shiftData.count > 0 ? `${(shiftData.profit / shiftData.count).toFixed(2)} EGP` : '0 EGP'],
            [''],
            ['تفاصيل الطلبات']
        ];

        // Orders Details
        const ordersData = [
            ['#', 'رقم الطلب', 'اسم العميل', 'المنتج', 'الاشتراك', 'السعر', 'التكلفة', 'الربح', 'الوقت', 'طريقة الدفع']
        ];

        shiftData.orders.forEach((order, index) => {
            const orderTime = new Date(order.date.seconds * 1000);
            ordersData.push([
                index + 1,
                order.id || 'N/A',
                order.contactInfo || 'N/A',
                order.productName || 'N/A',
                order.subscription || 'N/A',
                (order.sellingPrice || 0).toFixed(2),
                (order.costPrice || 0).toFixed(2),
                ((order.sellingPrice || 0) - (order.costPrice || 0)).toFixed(2),
                orderTime.toLocaleTimeString('ar-EG'),
                order.paymentMethod || 'N/A'
            ]);
        });

        // Get accounts used in this shift
        const accountsUsedSet = new Set();
        shiftData.orders.forEach(order => {
            if (order.accountEmail) {
                accountsUsedSet.add(order.accountEmail);
            }
        });

        const accountsData = [
            [''],
            ['الأكونتات المستخدمة في الشيفت'],
            ['البريد الإلكتروني', 'عدد الاستخدامات']
        ];

        Array.from(accountsUsedSet).forEach(email => {
            const count = shiftData.orders.filter(o => o.accountEmail === email).length;
            accountsData.push([email, count]);
        });

        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Create worksheets
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        const ws2 = XLSX.utils.aoa_to_sheet(ordersData);
        const ws3 = XLSX.utils.aoa_to_sheet(accountsData);

        // Add worksheets to workbook
        XLSX.utils.book_append_sheet(wb, ws1, 'ملخص الشيفت');
        XLSX.utils.book_append_sheet(wb, ws2, 'تفاصيل الطلبات');
        XLSX.utils.book_append_sheet(wb, ws3, 'الأكونتات');

        // Download file
        const fileName = `تقرير_شيفت_${shift.name}_${dateStr.replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        return { success: true, fileName };
    } catch (error) {
        console.error('Error exporting shift report:', error);
        return { success: false, error: error.message };
    }
}

// Export daily summary report (all shifts)
export async function exportDailySummaryToExcel(date, allShiftsData, allSalesData, allExpensesData) {
    try {
        const XLSX = window.XLSX;
        if (!XLSX) {
            throw new Error('XLSX library not loaded');
        }

        const dateStr = date.toLocaleDateString('ar-EG');
        
        // Calculate daily totals
        const totalOrders = Object.values(allShiftsData).reduce((sum, shift) => sum + shift.count, 0);
        const totalRevenue = Object.values(allShiftsData).reduce((sum, shift) => sum + shift.revenue, 0);
        const totalProfit = Object.values(allShiftsData).reduce((sum, shift) => sum + shift.profit, 0);
        
        // Daily expenses
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        const dailyExpenses = allExpensesData.filter(exp => {
            const expDate = exp.date?.seconds ? new Date(exp.date.seconds * 1000) : null;
            return expDate && expDate >= startOfDay && expDate <= endOfDay;
        });
        
        const totalExpenses = dailyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const netProfit = totalProfit - totalExpenses;

        // Summary Data
        const summaryData = [
            ['التقرير اليومي الشامل - SubPro Dashboard'],
            ['التاريخ:', dateStr],
            [''],
            ['ملخص الأداء اليومي'],
            ['إجمالي الطلبات:', totalOrders],
            ['إجمالي الإيرادات:', `${totalRevenue.toFixed(2)} EGP`],
            ['إجمالي الربح من المبيعات:', `${totalProfit.toFixed(2)} EGP`],
            ['إجمالي المصروفات:', `${totalExpenses.toFixed(2)} EGP`],
            ['صافي الربح:', `${netProfit.toFixed(2)} EGP`],
            [''],
            ['أداء الشيفتات']
        ];

        const shiftsComparisonData = [
            ['الشيفت', 'الوقت', 'الطلبات', 'الإيرادات', 'الربح', 'النسبة %']
        ];

        const shiftNames = {
            NIGHT: { name: 'الليلي', time: '12ص - 8ص' },
            MORNING: { name: 'الصباح', time: '8ص - 4م' },
            EVENING: { name: 'العصر', time: '4م - 12ص' }
        };

        Object.entries(allShiftsData).forEach(([key, data]) => {
            const percentage = totalOrders > 0 ? ((data.count / totalOrders) * 100).toFixed(1) : 0;
            shiftsComparisonData.push([
                shiftNames[key].name,
                shiftNames[key].time,
                data.count,
                data.revenue.toFixed(2),
                data.profit.toFixed(2),
                `${percentage}%`
            ]);
        });

        // Expenses breakdown
        const expensesData = [
            [''],
            ['تفاصيل المصروفات اليومية'],
            ['النوع', 'المبلغ', 'الوصف', 'الوقت']
        ];

        dailyExpenses.forEach(exp => {
            const expTime = exp.date?.seconds ? new Date(exp.date.seconds * 1000).toLocaleTimeString('ar-EG') : 'N/A';
            expensesData.push([
                exp.type || 'N/A',
                (exp.amount || 0).toFixed(2),
                exp.description || 'N/A',
                expTime
            ]);
        });

        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Combine all data for main sheet
        const mainSheetData = [...summaryData, [], ...shiftsComparisonData, ...expensesData];
        const ws = XLSX.utils.aoa_to_sheet(mainSheetData);

        XLSX.utils.book_append_sheet(wb, ws, 'التقرير اليومي');

        // Download file
        const fileName = `تقرير_يومي_شامل_${dateStr.replace(/\//g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        return { success: true, fileName };
    } catch (error) {
        console.error('Error exporting daily summary:', error);
        return { success: false, error: error.message };
    }
}

// Export all data (comprehensive backup)
export async function exportComprehensiveBackup(allSalesData, allAccountsData, allExpensesData, allProductsData) {
    try {
        const XLSX = window.XLSX;
        if (!XLSX) {
            throw new Error('XLSX library not loaded');
        }

        const timestamp = new Date().toLocaleString('ar-EG');

        // Sales data
        const salesData = [
            ['ID', 'تاريخ الطلب', 'العميل', 'المنتج', 'الاشتراك', 'السعر', 'التكلفة', 'الربح', 'طريقة الدفع', 'الأكونت', 'مؤكد', 'التاجر']
        ];

        allSalesData.forEach(sale => {
            const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000).toLocaleString('ar-EG') : 'N/A';
            salesData.push([
                sale.id || 'N/A',
                saleDate,
                sale.contactInfo || 'N/A',
                sale.productName || 'N/A',
                sale.subscription || 'N/A',
                (sale.sellingPrice || 0).toFixed(2),
                (sale.costPrice || 0).toFixed(2),
                ((sale.sellingPrice || 0) - (sale.costPrice || 0)).toFixed(2),
                sale.paymentMethod || 'N/A',
                sale.accountEmail || 'N/A',
                sale.isConfirmed ? 'نعم' : 'لا',
                sale.traderName || 'N/A'
            ]);
        });

        // Accounts data
        const accountsData = [
            ['ID', 'البريد الإلكتروني', 'كلمة المرور', 'المنتج', 'الاستخدامات الحالية', 'الاستخدامات المسموحة', 'نشط', 'تاريخ الإنشاء']
        ];

        allAccountsData.forEach(acc => {
            const createdDate = acc.created_at?.seconds ? new Date(acc.created_at.seconds * 1000).toLocaleString('ar-EG') : 'N/A';
            accountsData.push([
                acc.id || 'N/A',
                acc.email || 'N/A',
                acc.password || 'N/A',
                acc.productName || 'N/A',
                acc.current_uses || 0,
                acc.allowed_uses === Infinity ? 'غير محدود' : acc.allowed_uses || 0,
                acc.is_active ? 'نعم' : 'لا',
                createdDate
            ]);
        });

        // Expenses data
        const expensesData = [
            ['ID', 'التاريخ', 'النوع', 'المبلغ', 'الوصف', 'المنتج']
        ];

        allExpensesData.forEach(exp => {
            const expDate = exp.date?.seconds ? new Date(exp.date.seconds * 1000).toLocaleString('ar-EG') : 'N/A';
            expensesData.push([
                exp.id || 'N/A',
                expDate,
                exp.type || 'N/A',
                (exp.amount || 0).toFixed(2),
                exp.description || 'N/A',
                exp.productName || 'N/A'
            ]);
        });

        // Products data
        const productsData = [
            ['ID', 'اسم المنتج', 'الاستخدامات المسموحة', 'تاريخ الإنشاء']
        ];

        allProductsData.forEach(prod => {
            const createdDate = prod.created_at?.seconds ? new Date(prod.created_at.seconds * 1000).toLocaleString('ar-EG') : 'N/A';
            productsData.push([
                prod.id || 'N/A',
                prod.name || 'N/A',
                prod.allowed_uses === Infinity ? 'غير محدود' : prod.allowed_uses || 0,
                createdDate
            ]);
        });

        // Create workbook
        const wb = XLSX.utils.book_new();
        
        const ws1 = XLSX.utils.aoa_to_sheet(salesData);
        const ws2 = XLSX.utils.aoa_to_sheet(accountsData);
        const ws3 = XLSX.utils.aoa_to_sheet(expensesData);
        const ws4 = XLSX.utils.aoa_to_sheet(productsData);

        XLSX.utils.book_append_sheet(wb, ws1, 'المبيعات');
        XLSX.utils.book_append_sheet(wb, ws2, 'الأكونتات');
        XLSX.utils.book_append_sheet(wb, ws3, 'المصروفات');
        XLSX.utils.book_append_sheet(wb, ws4, 'المنتجات');

        // Download file
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `نسخة_احتياطية_شاملة_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);

        return { success: true, fileName };
    } catch (error) {
        console.error('Error creating comprehensive backup:', error);
        return { success: false, error: error.message };
    }
}

// Generate shift report summary text for messaging
export function generateShiftReportText(shiftDate, shiftKey, shiftData) {
    const shiftNames = {
        NIGHT: 'الشيفت الليلي (12ص - 8ص)',
        MORNING: 'شيفت الصباح (8ص - 4م)',
        EVENING: 'شيفت العصر (4م - 12ص)'
    };

    const dateStr = shiftDate.toLocaleDateString('ar-EG', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    const avgProfitPerOrder = shiftData.count > 0 ? (shiftData.profit / shiftData.count).toFixed(2) : '0.00';

    return `
📊 تقرير ${shiftNames[shiftKey]}
📅 التاريخ: ${dateStr}

📈 ملخص الأداء:
• إجمالي الطلبات: ${shiftData.count}
• إجمالي الإيرادات: ${shiftData.revenue.toFixed(2)} EGP
• إجمالي الربح: ${shiftData.profit.toFixed(2)} EGP
• متوسط الربح للطلب: ${avgProfitPerOrder} EGP

✅ تم إنشاء هذا التقرير تلقائياً بواسطة نظام SubPro Dashboard V3
    `.trim();
}

// Auto-generate shift report at end of shift
export function scheduleAutomaticShiftReports(callback) {
    // Check every minute if we're at the end of a shift
    const checkInterval = setInterval(() => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // At the end of each shift (8:00, 16:00, 00:00)
        if (minute === 0 && (hour === 8 || hour === 16 || hour === 0)) {
            // Determine which shift just ended
            let shiftKey;
            if (hour === 8) shiftKey = 'NIGHT';
            else if (hour === 16) shiftKey = 'MORNING';
            else if (hour === 0) shiftKey = 'EVENING';

            // Trigger callback
            if (callback && typeof callback === 'function') {
                callback(shiftKey);
            }
        }
    }, 60000); // Check every minute

    return checkInterval;
}

// Copy report text to clipboard
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return { success: true };
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return { success: true };
            } catch (err) {
                document.body.removeChild(textArea);
                return { success: false, error: err.message };
            }
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Check for duplicate accounts
export function detectDuplicateAccounts(allAccountsData) {
    const emailMap = new Map();
    const duplicates = [];

    allAccountsData.forEach(acc => {
        const email = acc.email?.toLowerCase();
        if (email) {
            if (emailMap.has(email)) {
                duplicates.push({
                    email: acc.email,
                    ids: [emailMap.get(email), acc.id]
                });
            } else {
                emailMap.set(email, acc.id);
            }
        }
    });

    return duplicates;
}

// Check for inactive accounts (not used in last 30 days)
export function detectInactiveAccounts(allAccountsData, allSalesData) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const inactiveAccounts = allAccountsData.filter(acc => {
        // Find last use in sales
        const lastUse = allSalesData
            .filter(sale => sale.accountEmail === acc.email)
            .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))[0];

        if (!lastUse) return true; // Never used

        const lastUseDate = lastUse.date?.seconds ? new Date(lastUse.date.seconds * 1000) : null;
        return lastUseDate && lastUseDate < thirtyDaysAgo;
    });

    return inactiveAccounts;
}

// Export accounts to Excel (with optional product filter)
export async function exportAccountsToExcel(allAccountsData, productFilter = 'all') {
    try {
        const XLSX = window.XLSX;
        if (!XLSX) {
            throw new Error('XLSX library not loaded');
        }

        // Filter accounts if needed
        let accountsToExport = productFilter === 'all' 
            ? allAccountsData 
            : allAccountsData.filter(acc => acc.productName === productFilter);

        const timestamp = new Date().toLocaleString('ar-EG');

        // Accounts data
        const accountsData = [
            ['تقرير الأكونتات - SubPro Dashboard'],
            ['التاريخ:', timestamp],
            ['المنتج:', productFilter === 'all' ? 'جميع المنتجات' : productFilter],
            ['إجمالي الأكونتات:', accountsToExport.length],
            [''],
            ['ID', 'البريد الإلكتروني', 'كلمة المرور', 'المنتج', 'الاستخدام الحالي', 'الاستخدام المسموح', 'النسبة %', 'نشط', 'سعر الشراء', 'اسم التاجر', 'تاريخ الشراء', 'الحالة']
        ];

        accountsToExport.forEach(acc => {
            const usagePercent = acc.allowed_uses === Infinity 
                ? '0' 
                : ((acc.current_uses / acc.allowed_uses) * 100).toFixed(1);
            
            let status = 'متاح';
            if (!acc.is_active) status = 'غير نشط';
            else if (acc.current_uses >= acc.allowed_uses && acc.allowed_uses !== Infinity) status = 'مكتمل';
            else if (acc.current_uses > 0) status = 'قيد الاستخدام';
            
            const purchaseDate = acc.purchase_date?.seconds 
                ? new Date(acc.purchase_date.seconds * 1000).toLocaleString('ar-EG') 
                : 'N/A';
            
            accountsData.push([
                acc.id || 'N/A',
                acc.email || 'N/A',
                acc.password || 'N/A',
                acc.productName || 'N/A',
                acc.current_uses || 0,
                acc.allowed_uses === Infinity ? 'غير محدود' : acc.allowed_uses || 0,
                usagePercent + '%',
                acc.is_active ? 'نعم' : 'لا',
                (acc.purchase_price || 0).toFixed(2),
                acc.trader_name || 'N/A',
                purchaseDate,
                status
            ]);
        });

        // Statistics
        const availableCount = accountsToExport.filter(a => a.is_active && a.current_uses < a.allowed_uses).length;
        const inUseCount = accountsToExport.filter(a => a.is_active && a.current_uses > 0 && a.current_uses < a.allowed_uses).length;
        const fullCount = accountsToExport.filter(a => a.current_uses >= a.allowed_uses && a.allowed_uses !== Infinity).length;
        const inactiveCount = accountsToExport.filter(a => !a.is_active).length;
        
        const statsData = [
            [''],
            ['إحصائيات الأكونتات'],
            ['الأكونتات المتاحة:', availableCount],
            ['قيد الاستخدام:', inUseCount],
            ['المكتملة:', fullCount],
            ['غير النشطة:', inactiveCount]
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        
        const ws = XLSX.utils.aoa_to_sheet([...accountsData, ...statsData]);
        XLSX.utils.book_append_sheet(wb, ws, 'الأكونتات');

        // Download file
        const productName = productFilter === 'all' ? 'جميع_المنتجات' : productFilter;
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `أكونتات_${productName}_${dateStr}.xlsx`;
        XLSX.writeFile(wb, fileName);

        return { success: true, fileName, count: accountsToExport.length };
    } catch (error) {
        console.error('Error exporting accounts:', error);
        return { success: false, error: error.message };
    }
}

// Get account status badge info
export function getAccountStatusBadge(account) {
    if (!account.is_active) {
        return { text: 'غير نشط', bgColor: 'bg-gray-100', textColor: 'text-gray-800', icon: 'fa-ban' };
    }
    
    if (account.allowed_uses !== Infinity && account.current_uses >= account.allowed_uses) {
        return { text: 'مكتمل', bgColor: 'bg-red-100', textColor: 'text-red-800', icon: 'fa-check-circle' };
    }
    
    if (account.current_uses > 0) {
        const usagePercent = (account.current_uses / account.allowed_uses) * 100;
        if (usagePercent >= 80) {
            return { text: 'قرب الامتلاء', bgColor: 'bg-orange-100', textColor: 'text-orange-800', icon: 'fa-exclamation-triangle' };
        }
        return { text: 'قيد الاستخدام', bgColor: 'bg-blue-100', textColor: 'text-blue-800', icon: 'fa-spinner' };
    }
    
    return { text: 'متاح', bgColor: 'bg-green-100', textColor: 'text-green-800', icon: 'fa-check' };
}
