// enhanced-features.js - Enhanced Features for SubPro Dashboard
// نظام متقدم لإدارة الشيفتات، المصروفات، الأكونتات، والتقارير المفصلة

import { getFirestore, doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// SHIFT MANAGEMENT - نظام إدارة الشيفتات
// ============================================

/**
 * تعريف الشيفتات الثلاثة الثابتة
 * شيفت العصر: 16:00 → 23:59:59
 * شيفت الليل: 00:00 → 07:59:59
 * شيفت الصبح: 08:00 → 15:59:59
 */
export const SHIFT_DEFINITIONS = {
    EVENING: {
        id: 'evening',
        name: 'شيفت العصر',
        nameEn: 'Evening Shift',
        startHour: 16,
        endHour: 23,
        endMinute: 59,
        color: 'from-blue-500 to-cyan-500',
        icon: 'fa-cloud-sun',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200'
    },
    NIGHT: {
        id: 'night',
        name: 'شيفت الليل',
        nameEn: 'Night Shift',
        startHour: 0,
        endHour: 7,
        endMinute: 59,
        color: 'from-indigo-500 to-purple-600',
        icon: 'fa-moon',
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-700',
        borderColor: 'border-indigo-200'
    },
    MORNING: {
        id: 'morning',
        name: 'شيفت الصبح',
        nameEn: 'Morning Shift',
        startHour: 8,
        endHour: 15,
        endMinute: 59,
        color: 'from-yellow-500 to-orange-500',
        icon: 'fa-sun',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
    }
};

/**
 * تحديد أي شيفت ينتمي إليه وقت معين
 */
export function getShiftForTime(date) {
    const hour = date.getHours();
    
    if (hour >= 16 && hour <= 23) {
        return SHIFT_DEFINITIONS.EVENING;
    } else if (hour >= 0 && hour <= 7) {
        return SHIFT_DEFINITIONS.NIGHT;
    } else {
        return SHIFT_DEFINITIONS.MORNING;
    }
}

/**
 * حساب إحصائيات الشيفت ليوم معين
 */
export async function calculateShiftStatistics(db, targetDate = new Date()) {
    try {
        // تحديد بداية ونهاية اليوم المحدد
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        // جلب جميع الأوردرات لهذا اليوم
        const salesRef = collection(db, 'sales');
        const salesQuery = query(
            salesRef,
            where('date', '>=', dayStart.toISOString()),
            where('date', '<=', dayEnd.toISOString()),
            orderBy('date', 'asc')
        );
        
        const salesSnapshot = await getDocs(salesQuery);
        const allOrders = salesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // تصنيف الأوردرات حسب الشيفتات
        const shiftStats = {};
        
        Object.values(SHIFT_DEFINITIONS).forEach(shift => {
            shiftStats[shift.id] = {
                ...shift,
                totalOrders: 0,
                ordersDetails: [],
                accountsUsed: new Set(),
                productBreakdown: {},
                totalRevenue: 0,
                totalProfit: 0
            };
        });
        
        // تحليل كل أوردر
        allOrders.forEach(order => {
            const orderDate = new Date(order.date);
            const shift = getShiftForTime(orderDate);
            
            if (shiftStats[shift.id]) {
                shiftStats[shift.id].totalOrders++;
                shiftStats[shift.id].ordersDetails.push({
                    id: order.id,
                    customer: order.customer,
                    product: order.product,
                    price: order.price || 0,
                    time: orderDate.toLocaleTimeString('ar-EG')
                });
                
                // تتبع الأكونتات المستخدمة
                if (order.account_id) {
                    shiftStats[shift.id].accountsUsed.add(order.account_id);
                }
                
                // تفصيل حسب المنتج
                const product = order.product || 'غير محدد';
                if (!shiftStats[shift.id].productBreakdown[product]) {
                    shiftStats[shift.id].productBreakdown[product] = {
                        count: 0,
                        revenue: 0
                    };
                }
                shiftStats[shift.id].productBreakdown[product].count++;
                shiftStats[shift.id].productBreakdown[product].revenue += (order.price || 0);
                
                // إجمالي الإيرادات والأرباح
                shiftStats[shift.id].totalRevenue += (order.price || 0);
                shiftStats[shift.id].totalProfit += (order.profit || 0);
            }
        });
        
        // تحويل Set إلى عدد
        Object.keys(shiftStats).forEach(shiftId => {
            shiftStats[shiftId].accountsUsedCount = shiftStats[shiftId].accountsUsed.size;
            delete shiftStats[shiftId].accountsUsed; // إزالة Set من النتيجة النهائية
        });
        
        return {
            date: targetDate.toLocaleDateString('ar-EG'),
            shifts: shiftStats,
            totalDayOrders: allOrders.length,
            totalDayRevenue: allOrders.reduce((sum, o) => sum + (o.price || 0), 0),
            totalDayProfit: allOrders.reduce((sum, o) => sum + (o.profit || 0), 0)
        };
        
    } catch (error) {
        console.error('خطأ في حساب إحصائيات الشيفتات:', error);
        throw error;
    }
}

/**
 * تصدير تقرير شيفت إلى CSV
 */
export function exportShiftReportToCSV(shiftStats, targetDate) {
    let csvContent = 'تقرير الشيفتات - ' + targetDate + '\n\n';
    
    csvContent += 'الشيفت,عدد الأوردرات,عدد الأكونتات المستخدمة,الإيرادات,الأرباح\n';
    
    Object.values(shiftStats.shifts).forEach(shift => {
        csvContent += `${shift.name},${shift.totalOrders},${shift.accountsUsedCount},${shift.totalRevenue},${shift.totalProfit}\n`;
    });
    
    csvContent += '\nتفاصيل المنتجات لكل شيفت:\n\n';
    
    Object.values(shiftStats.shifts).forEach(shift => {
        csvContent += `\n${shift.name}:\n`;
        csvContent += 'المنتج,العدد,الإيرادات\n';
        
        Object.entries(shift.productBreakdown).forEach(([product, data]) => {
            csvContent += `${product},${data.count},${data.revenue}\n`;
        });
    });
    
    // تحميل الملف
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shift-report-${targetDate}.csv`;
    link.click();
}

// ============================================
// EXPENSE MANAGEMENT - إدارة المصروفات المحسنة
// ============================================

/**
 * فئات المصروفات
 */
export const EXPENSE_CATEGORIES = {
    ADS: { id: 'ads', name: 'إعلانات', color: 'bg-blue-500', icon: 'fa-bullhorn' },
    OPERATIONAL: { id: 'operational', name: 'تشغيلي', color: 'bg-green-500', icon: 'fa-cogs' },
    RENEWAL: { id: 'renewal', name: 'تجديد', color: 'bg-purple-500', icon: 'fa-sync-alt' },
    OTHER: { id: 'other', name: 'أخرى', color: 'bg-gray-500', icon: 'fa-ellipsis-h' }
};

/**
 * إضافة مصروف جديد مع التحقق من التاريخ
 */
export async function addExpenseWithDate(db, expenseData) {
    // التحقق من صحة التاريخ
    if (!expenseData.date) {
        throw new Error('التاريخ إلزامي');
    }
    
    const expenseDate = new Date(expenseData.date);
    const now = new Date();
    
    // التحقق من أن التاريخ ليس بعيداً جداً في المستقبل (أكثر من سنة)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    if (expenseDate > oneYearFromNow) {
        throw new Error('التاريخ المدخل بعيد جداً في المستقبل');
    }
    
    // التحقق من أن التاريخ ليس قديماً جداً (أكثر من 5 سنوات)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    
    if (expenseDate < fiveYearsAgo) {
        throw new Error('التاريخ المدخل قديم جداً');
    }
    
    // إضافة المصروف
    const expensesRef = collection(db, 'expenses');
    await addDoc(expensesRef, {
        ...expenseData,
        date: expenseDate.toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

/**
 * تجميع المصروفات حسب الفترة (يومي/أسبوعي/شهري)
 */
export function aggregateExpenses(expenses, period = 'daily') {
    const aggregated = {};
    
    expenses.forEach(expense => {
        const date = new Date(expense.date);
        let key;
        
        switch (period) {
            case 'daily':
                key = date.toLocaleDateString('ar-EG');
                break;
            case 'weekly':
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toLocaleDateString('ar-EG');
                break;
            case 'monthly':
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                break;
            default:
                key = date.toLocaleDateString('ar-EG');
        }
        
        if (!aggregated[key]) {
            aggregated[key] = {
                total: 0,
                count: 0,
                byCategory: {},
                byProduct: {}
            };
        }
        
        aggregated[key].total += expense.amount || 0;
        aggregated[key].count++;
        
        // تجميع حسب الفئة
        const category = expense.category || 'other';
        if (!aggregated[key].byCategory[category]) {
            aggregated[key].byCategory[category] = 0;
        }
        aggregated[key].byCategory[category] += expense.amount || 0;
        
        // تجميع حسب المنتج
        const product = expense.product_id || 'غير محدد';
        if (!aggregated[key].byProduct[product]) {
            aggregated[key].byProduct[product] = 0;
        }
        aggregated[key].byProduct[product] += expense.amount || 0;
    });
    
    return aggregated;
}

// ============================================
// ACCOUNT MANAGEMENT - إدارة الأكونتات المحسنة
// ============================================

/**
 * حالات الأكونت
 */
export const ACCOUNT_STATUS = {
    AVAILABLE: 'available',
    USED: 'used',
    DAMAGED: 'damaged'
};

/**
 * استبدال أكونت تالف بآخر متاح
 */
export async function replaceDeamagedAccount(db, orderId, damageReason = '', moderatorId = 'guest') {
    try {
        return await runTransaction(db, async (transaction) => {
            // 1. جلب بيانات الأوردر
            const orderRef = doc(db, 'sales', orderId);
            const orderDoc = await transaction.get(orderRef);
            
            if (!orderDoc.exists()) {
                throw new Error('الأوردر غير موجود');
            }
            
            const orderData = orderDoc.data();
            const currentAccountId = orderData.account_id;
            const productId = orderData.product;
            
            if (!currentAccountId) {
                throw new Error('لا يوجد حساب مرتبط بهذا الأوردر');
            }
            
            // 2. وسم الأكونت الحالي كـ تالف
            const currentAccountRef = doc(db, 'accounts', currentAccountId);
            const currentAccountDoc = await transaction.get(currentAccountRef);
            
            if (!currentAccountDoc.exists()) {
                throw new Error('الحساب الحالي غير موجود');
            }
            
            transaction.update(currentAccountRef, {
                status: ACCOUNT_STATUS.DAMAGED,
                damaged_at: serverTimestamp(),
                damage_reason: damageReason,
                damaged_by: moderatorId,
                updatedAt: serverTimestamp()
            });
            
            // 3. البحث عن أكونت بديل متاح
            const accountsRef = collection(db, 'accounts');
            const availableAccountsQuery = query(
                accountsRef,
                where('product_id', '==', productId),
                where('status', '==', ACCOUNT_STATUS.AVAILABLE),
                orderBy('createdAt', 'asc'),
                limit(1)
            );
            
            const availableSnapshot = await getDocs(availableAccountsQuery);
            
            if (availableSnapshot.empty) {
                throw new Error('لا يوجد حساب بديل متاح لهذا المنتج');
            }
            
            const replacementAccountDoc = availableSnapshot.docs[0];
            const replacementAccountId = replacementAccountDoc.id;
            
            // 4. تحديث الأكونت البديل
            const replacementAccountRef = doc(db, 'accounts', replacementAccountId);
            transaction.update(replacementAccountRef, {
                status: ACCOUNT_STATUS.USED,
                assigned_to_order: orderId,
                assigned_at: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            // 5. تحديث الأوردر
            transaction.update(orderRef, {
                account_id: replacementAccountId,
                damaged_account_id: currentAccountId,
                replacement_account_id: replacementAccountId,
                replacement_timestamp: serverTimestamp(),
                replacement_by: moderatorId,
                replacement_reason: damageReason,
                updatedAt: serverTimestamp()
            });
            
            // 6. إضافة سجل تدقيق (Audit Log)
            const auditLogRef = doc(collection(db, 'audit_logs'));
            transaction.set(auditLogRef, {
                action: 'account_replace_due_to_damage',
                order_id: orderId,
                product_id: productId,
                old_account_id: currentAccountId,
                new_account_id: replacementAccountId,
                moderator_id: moderatorId,
                note: damageReason,
                timestamp: serverTimestamp()
            });
            
            return {
                success: true,
                oldAccountId: currentAccountId,
                newAccountId: replacementAccountId,
                replacementAccountData: replacementAccountDoc.data()
            };
        });
        
    } catch (error) {
        console.error('خطأ في استبدال الأكونت:', error);
        throw error;
    }
}

/**
 * جلب إحصائيات الأكونتات
 */
export async function getAccountsStatistics(db, productFilter = null) {
    try {
        let accountsQuery;
        const accountsRef = collection(db, 'accounts');
        
        if (productFilter) {
            accountsQuery = query(
                accountsRef,
                where('product_id', '==', productFilter)
            );
        } else {
            accountsQuery = query(accountsRef);
        }
        
        const snapshot = await getDocs(accountsQuery);
        const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const stats = {
            total: accounts.length,
            available: accounts.filter(a => a.status === ACCOUNT_STATUS.AVAILABLE).length,
            used: accounts.filter(a => a.status === ACCOUNT_STATUS.USED).length,
            damaged: accounts.filter(a => a.status === ACCOUNT_STATUS.DAMAGED).length,
            byProduct: {}
        };
        
        // إحصائيات حسب المنتج
        accounts.forEach(account => {
            const product = account.product_id || 'غير محدد';
            if (!stats.byProduct[product]) {
                stats.byProduct[product] = {
                    total: 0,
                    available: 0,
                    used: 0,
                    damaged: 0
                };
            }
            
            stats.byProduct[product].total++;
            if (account.status === ACCOUNT_STATUS.AVAILABLE) stats.byProduct[product].available++;
            if (account.status === ACCOUNT_STATUS.USED) stats.byProduct[product].used++;
            if (account.status === ACCOUNT_STATUS.DAMAGED) stats.byProduct[product].damaged++;
        });
        
        return stats;
        
    } catch (error) {
        console.error('خطأ في جلب إحصائيات الأكونتات:', error);
        throw error;
    }
}

// ============================================
// PRODUCT STATISTICS - إحصائيات المنتجات
// ============================================

/**
 * حساب إحصائيات منتج معين
 */
export async function calculateProductStatistics(db, productId, startDate = null, endDate = null) {
    try {
        const salesRef = collection(db, 'sales');
        let salesQuery = query(
            salesRef,
            where('product', '==', productId),
            orderBy('date', 'desc')
        );
        
        const snapshot = await getDocs(salesQuery);
        const allSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // فلترة حسب التاريخ إذا تم تحديدها
        let filteredSales = allSales;
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            filteredSales = allSales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= start && saleDate <= end;
            });
        }
        
        const totalOrders = filteredSales.length;
        const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.price || 0), 0);
        const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        
        // حساب نسبة المساهمة من إجمالي المبيعات
        const allSalesSnapshot = await getDocs(query(salesRef));
        const allSalesRevenue = allSalesSnapshot.docs.reduce((sum, doc) => sum + (doc.data().price || 0), 0);
        const contributionPercentage = allSalesRevenue > 0 ? (totalRevenue / allSalesRevenue) * 100 : 0;
        
        return {
            productId,
            totalOrders,
            totalRevenue,
            totalProfit,
            averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            contributionPercentage: contributionPercentage.toFixed(2),
            salesTrend: calculateSalesTrend(filteredSales)
        };
        
    } catch (error) {
        console.error('خطأ في حساب إحصائيات المنتج:', error);
        throw error;
    }
}

/**
 * حساب اتجاه المبيعات (Sales Trend)
 */
function calculateSalesTrend(sales) {
    if (sales.length < 2) return 'stable';
    
    // تجميع المبيعات حسب اليوم
    const dailySales = {};
    sales.forEach(sale => {
        const date = new Date(sale.date).toLocaleDateString('ar-EG');
        if (!dailySales[date]) {
            dailySales[date] = 0;
        }
        dailySales[date] += (sale.price || 0);
    });
    
    const dates = Object.keys(dailySales).sort();
    if (dates.length < 2) return 'stable';
    
    const firstHalf = dates.slice(0, Math.floor(dates.length / 2));
    const secondHalf = dates.slice(Math.floor(dates.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, date) => sum + dailySales[date], 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, date) => sum + dailySales[date], 0) / secondHalf.length;
    
    const changePercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    
    if (changePercentage > 10) return 'increasing';
    if (changePercentage < -10) return 'decreasing';
    return 'stable';
}

// ============================================
// ORDER DETAILS - تفاصيل الأوردر المحسنة
// ============================================

/**
 * جلب تفاصيل أوردر شاملة
 */
export async function getOrderDetails(db, orderId) {
    try {
        const orderRef = doc(db, 'sales', orderId);
        const orderDoc = await getDoc(orderRef);
        
        if (!orderDoc.exists()) {
            throw new Error('الأوردر غير موجود');
        }
        
        const orderData = { id: orderId, ...orderDoc.data() };
        
        // جلب بيانات الأكونت المرتبط
        let accountData = null;
        if (orderData.account_id) {
            const accountRef = doc(db, 'accounts', orderData.account_id);
            const accountDoc = await getDoc(accountRef);
            if (accountDoc.exists()) {
                accountData = { id: orderData.account_id, ...accountDoc.data() };
            }
        }
        
        // جلب بيانات الأكونت التالف (إذا وجد)
        let damagedAccountData = null;
        if (orderData.damaged_account_id) {
            const damagedAccountRef = doc(db, 'accounts', orderData.damaged_account_id);
            const damagedAccountDoc = await getDoc(damagedAccountRef);
            if (damagedAccountDoc.exists()) {
                damagedAccountData = { id: orderData.damaged_account_id, ...damagedAccountDoc.data() };
            }
        }
        
        // جلب سجل التدقيق المرتبط
        const auditLogsRef = collection(db, 'audit_logs');
        const auditQuery = query(
            auditLogsRef,
            where('order_id', '==', orderId),
            orderBy('timestamp', 'desc')
        );
        
        const auditSnapshot = await getDocs(auditQuery);
        const auditLogs = auditSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        return {
            order: orderData,
            account: accountData,
            damagedAccount: damagedAccountData,
            auditLogs,
            timeline: generateOrderTimeline(orderData, auditLogs)
        };
        
    } catch (error) {
        console.error('خطأ في جلب تفاصيل الأوردر:', error);
        throw error;
    }
}

/**
 * إنشاء خط زمني للأوردر
 */
function generateOrderTimeline(orderData, auditLogs) {
    const timeline = [];
    
    // حدث الإنشاء
    if (orderData.date) {
        timeline.push({
            type: 'created',
            icon: 'fa-plus-circle',
            color: 'text-green-600',
            title: 'تم إنشاء الأوردر',
            description: `تم إنشاء أوردر جديد للعميل: ${orderData.customer}`,
            timestamp: orderData.date
        });
    }
    
    // حدث ربط الحساب
    if (orderData.account_id && !orderData.replacement_timestamp) {
        timeline.push({
            type: 'account_assigned',
            icon: 'fa-link',
            color: 'text-blue-600',
            title: 'تم ربط حساب',
            description: 'تم ربط حساب بالأوردر',
            timestamp: orderData.date
        });
    }
    
    // حدث الاستبدال
    if (orderData.replacement_timestamp) {
        timeline.push({
            type: 'account_replaced',
            icon: 'fa-exchange-alt',
            color: 'text-red-600',
            title: 'تم استبدال الحساب',
            description: `السبب: ${orderData.replacement_reason || 'غير محدد'}`,
            timestamp: orderData.replacement_timestamp.toDate ? orderData.replacement_timestamp.toDate().toISOString() : orderData.replacement_timestamp
        });
    }
    
    // إضافة سجلات التدقيق
    auditLogs.forEach(log => {
        timeline.push({
            type: log.action,
            icon: 'fa-file-alt',
            color: 'text-gray-600',
            title: getAuditActionTitle(log.action),
            description: log.note || '',
            timestamp: log.timestamp.toDate ? log.timestamp.toDate().toISOString() : log.timestamp
        });
    });
    
    // ترتيب حسب الوقت
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return timeline;
}

/**
 * الحصول على عنوان عربي لإجراء التدقيق
 */
function getAuditActionTitle(action) {
    const titles = {
        'account_replace_due_to_damage': 'استبدال حساب تالف',
        'order_created': 'إنشاء أوردر',
        'order_updated': 'تحديث أوردر',
        'account_assigned': 'ربط حساب',
        'account_removed': 'إزالة حساب'
    };
    return titles[action] || action;
}

// ============================================
// EXPORT & UTILITIES - أدوات التصدير والمساعدة
// ============================================

/**
 * تصدير بيانات إلى Excel
 */
export function exportToExcel(data, filename, sheetName = 'Sheet1') {
    try {
        if (typeof XLSX === 'undefined') {
            throw new Error('مكتبة XLSX غير متوفرة');
        }
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${filename}.xlsx`);
        
        return true;
    } catch (error) {
        console.error('خطأ في التصدير:', error);
        return false;
    }
}

/**
 * نسخ نص إلى الحافظة
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('خطأ في النسخ:', error);
        return false;
    }
}

/**
 * عرض إشعار Toast
 */
export function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-semibold z-50 transition-all duration-300`;
    
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };
    
    toast.classList.add(colors[type] || colors.info);
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * عرض Dialog تأكيد
 */
export function showConfirmDialog(message, onConfirm, onCancel = null) {
    const dialog = document.createElement('div');
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div class="flex items-center mb-4">
                <i class="fas fa-exclamation-triangle text-yellow-500 text-3xl ml-3"></i>
                <h3 class="text-xl font-bold text-gray-800">تأكيد الإجراء</h3>
            </div>
            <p class="text-gray-600 mb-6">${message}</p>
            <div class="flex gap-3 justify-end">
                <button class="cancel-btn px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors">
                    إلغاء
                </button>
                <button class="confirm-btn px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">
                    تأكيد
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    const confirmBtn = dialog.querySelector('.confirm-btn');
    const cancelBtn = dialog.querySelector('.cancel-btn');
    
    confirmBtn.addEventListener('click', () => {
        dialog.remove();
        if (onConfirm) onConfirm();
    });
    
    cancelBtn.addEventListener('click', () => {
        dialog.remove();
        if (onCancel) onCancel();
    });
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.remove();
            if (onCancel) onCancel();
        }
    });
}

// تصدير جميع الوظائف
export default {
    SHIFT_DEFINITIONS,
    getShiftForTime,
    calculateShiftStatistics,
    exportShiftReportToCSV,
    EXPENSE_CATEGORIES,
    addExpenseWithDate,
    aggregateExpenses,
    ACCOUNT_STATUS,
    replaceDeamagedAccount,
    getAccountsStatistics,
    calculateProductStatistics,
    getOrderDetails,
    exportToExcel,
    copyToClipboard,
    showToast,
    showConfirmDialog
};
