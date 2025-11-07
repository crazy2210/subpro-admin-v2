// shift-reports.js - Shift-Based Reporting System
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Shift definitions (24-hour format)
export const SHIFTS = {
    MORNING: { 
        name: 'شيفت الصباح', 
        nameEn: 'Morning Shift',
        start: 8, 
        end: 16, 
        color: 'from-yellow-400 to-orange-500',
        icon: 'fa-sun',
        id: 'morning'
    },
    EVENING: { 
        name: 'شيفت العصر', 
        nameEn: 'Evening Shift',
        start: 16, 
        end: 24, // 12 AM midnight
        color: 'from-blue-500 to-cyan-500',
        icon: 'fa-cloud-sun',
        id: 'evening'
    },
    NIGHT: { 
        name: 'الشيفت الليلي', 
        nameEn: 'Night Shift',
        start: 0, // 12 AM midnight
        end: 8, 
        color: 'from-indigo-500 to-purple-600',
        icon: 'fa-moon',
        id: 'night'
    }
};

/**
 * Get shift for a given time
 */
export function getShiftForTime(date = new Date()) {
    const hour = date.getHours();
    
    if (hour >= SHIFTS.MORNING.start && hour < SHIFTS.MORNING.end) {
        return SHIFTS.MORNING;
    } else if (hour >= SHIFTS.EVENING.start || hour < SHIFTS.NIGHT.end) {
        // Evening shift wraps around midnight
        return hour >= SHIFTS.EVENING.start ? SHIFTS.EVENING : SHIFTS.NIGHT;
    }
    
    return SHIFTS.MORNING; // Default fallback
}

/**
 * Get current shift
 */
export function getCurrentShift() {
    return getShiftForTime(new Date());
}

/**
 * Get shift time range for a specific date and shift
 */
export function getShiftTimeRange(date, shift) {
    const shiftDate = new Date(date);
    shiftDate.setHours(0, 0, 0, 0);
    
    const startTime = new Date(shiftDate);
    const endTime = new Date(shiftDate);
    
    if (shift.id === 'night') {
        // Night shift: 12 AM - 8 AM (same day)
        startTime.setHours(shift.start, 0, 0, 0);
        endTime.setHours(shift.end, 0, 0, 0);
    } else if (shift.id === 'morning') {
        // Morning shift: 8 AM - 4 PM (same day)
        startTime.setHours(shift.start, 0, 0, 0);
        endTime.setHours(shift.end, 0, 0, 0);
    } else if (shift.id === 'evening') {
        // Evening shift: 4 PM - 12 AM (wraps to next day)
        startTime.setHours(shift.start, 0, 0, 0);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(0, 0, 0, 0);
    }
    
    return { startTime, endTime };
}

/**
 * Generate shift report data
 */
export async function generateShiftReport(db, date, shift, allSales, allExpenses, allAccounts, allProblems) {
    const { startTime, endTime } = getShiftTimeRange(date, shift);
    
    // Filter sales for this shift
    const shiftSales = allSales.filter(sale => {
        if (!sale.date?.seconds) return false;
        const saleTime = new Date(sale.date.seconds * 1000);
        return saleTime >= startTime && saleTime < endTime;
    });
    
    // Filter expenses for this shift
    const shiftExpenses = allExpenses.filter(expense => {
        if (!expense.date?.seconds) return false;
        const expenseTime = new Date(expense.date.seconds * 1000);
        return expenseTime >= startTime && expenseTime < endTime;
    });
    
    // Filter problems for this shift
    const shiftProblems = allProblems.filter(problem => {
        if (!problem.date?.seconds) return false;
        const problemTime = new Date(problem.date.seconds * 1000);
        return problemTime >= startTime && problemTime < endTime;
    });
    
    // Calculate metrics
    const confirmedSales = shiftSales.filter(s => s.isConfirmed);
    const totalOrders = shiftSales.length;
    const confirmedOrders = confirmedSales.length;
    const totalRevenue = confirmedSales.reduce((sum, s) => sum + (s.sellingPrice || 0), 0);
    const totalCost = confirmedSales.reduce((sum, s) => sum + (s.costPrice || 0), 0);
    const totalExpenses = shiftExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalProfit = totalRevenue - totalCost - totalExpenses;
    
    // Get unique accounts used
    const accountsUsed = [...new Set(confirmedSales
        .filter(s => s.accountId)
        .map(s => s.accountId))];
    
    // Calculate advanced metrics
    const conversionRate = totalOrders > 0 ? (confirmedOrders / totalOrders * 100).toFixed(1) : 0;
    const avgOrderValue = confirmedOrders > 0 ? (totalRevenue / confirmedOrders).toFixed(2) : 0;
    const shiftDurationHours = (endTime - startTime) / (1000 * 60 * 60);
    const ordersPerHour = shiftDurationHours > 0 ? (confirmedOrders / shiftDurationHours).toFixed(1) : 0;
    
    // Product breakdown
    const productBreakdown = {};
    confirmedSales.forEach(sale => {
        const product = sale.productName || 'Unknown';
        if (!productBreakdown[product]) {
            productBreakdown[product] = {
                count: 0,
                revenue: 0,
                cost: 0,
                profit: 0
            };
        }
        productBreakdown[product].count++;
        productBreakdown[product].revenue += (sale.sellingPrice || 0);
        productBreakdown[product].cost += (sale.costPrice || 0);
        productBreakdown[product].profit += ((sale.sellingPrice || 0) - (sale.costPrice || 0));
    });
    
    // Payment method breakdown
    const paymentBreakdown = {};
    confirmedSales.forEach(sale => {
        const method = sale.paymentType || 'Unknown';
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + 1;
    });
    
    return {
        shiftType: shift.id,
        shiftName: shift.name,
        shiftDate: date,
        startTime,
        endTime,
        summary: {
            totalOrders,
            confirmedOrders,
            unconfirmedOrders: totalOrders - confirmedOrders,
            totalRevenue,
            totalCost,
            totalExpenses,
            totalProfit,
            accountsUsed: accountsUsed.length,
            problemsReported: shiftProblems.length
        },
        metrics: {
            conversionRate: parseFloat(conversionRate),
            avgOrderValue: parseFloat(avgOrderValue),
            ordersPerHour: parseFloat(ordersPerHour),
            profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0
        },
        breakdowns: {
            products: productBreakdown,
            paymentMethods: paymentBreakdown
        },
        details: {
            sales: shiftSales.map(s => ({
                id: s.id,
                customer: s.customerName,
                product: s.productName,
                price: s.sellingPrice,
                status: s.isConfirmed ? 'confirmed' : 'pending'
            })),
            problems: shiftProblems.map(p => ({
                id: p.id,
                type: p.problemType,
                description: p.description
            })),
            accountsUsedList: accountsUsed
        },
        generatedAt: new Date()
    };
}

/**
 * Save shift report to Firestore
 */
export async function saveShiftReport(db, reportData, moderatorName = 'System', notes = '') {
    try {
        const reportDoc = {
            ...reportData,
            moderator: moderatorName,
            notes,
            createdAt: serverTimestamp(),
            version: '1.0'
        };
        
        const docRef = await addDoc(collection(db, 'shift_reports'), reportDoc);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error saving shift report:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get recent shift reports
 */
export async function getRecentShiftReports(db, limitCount = 10) {
    try {
        const q = query(
            collection(db, 'shift_reports'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error fetching shift reports:', error);
        return [];
    }
}

/**
 * Render shift report UI
 */
export function renderShiftReportUI(report) {
    const shift = Object.values(SHIFTS).find(s => s.id === report.shiftType) || SHIFTS.MORNING;
    
    return `
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6 pb-4 border-b">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br ${shift.color} flex items-center justify-center text-white">
                        <i class="fas ${shift.icon} text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-bold text-gray-800">${report.shiftName}</h3>
                        <p class="text-sm text-gray-600">
                            ${new Date(report.shiftDate).toLocaleDateString('ar-EG')} | 
                            ${new Date(report.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} - 
                            ${new Date(report.endTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">المشرف</p>
                    <p class="font-bold text-gray-800">${report.moderator || 'غير محدد'}</p>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <p class="text-xs text-blue-600 font-semibold">إجمالي الأوردرات</p>
                    <p class="text-3xl font-bold text-blue-700">${report.summary.totalOrders}</p>
                    <p class="text-xs text-blue-500 mt-1">مؤكد: ${report.summary.confirmedOrders}</p>
                </div>
                
                <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <p class="text-xs text-green-600 font-semibold">الإيرادات</p>
                    <p class="text-2xl font-bold text-green-700">EGP ${report.summary.totalRevenue.toFixed(2)}</p>
                    <p class="text-xs text-green-500 mt-1">الربح: ${report.summary.totalProfit.toFixed(2)}</p>
                </div>
                
                <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                    <p class="text-xs text-orange-600 font-semibold">معدل التحويل</p>
                    <p class="text-3xl font-bold text-orange-700">${report.metrics.conversionRate}%</p>
                    <p class="text-xs text-orange-500 mt-1">${report.metrics.ordersPerHour} أوردر/ساعة</p>
                </div>
                
                <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                    <p class="text-xs text-purple-600 font-semibold">الأكونتات المستخدمة</p>
                    <p class="text-3xl font-bold text-purple-700">${report.summary.accountsUsed}</p>
                    <p class="text-xs text-purple-500 mt-1">مشاكل: ${report.summary.problemsReported}</p>
                </div>
            </div>

            <!-- Product Breakdown -->
            ${Object.keys(report.breakdowns.products).length > 0 ? `
                <div class="mb-6">
                    <h4 class="font-bold text-gray-700 mb-3">📊 تفصيل المنتجات</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${Object.entries(report.breakdowns.products).map(([product, data]) => `
                            <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <p class="font-semibold text-gray-800 mb-2">${product}</p>
                                <div class="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p class="text-gray-600">الكمية</p>
                                        <p class="font-bold text-gray-800">${data.count}</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-600">الإيرادات</p>
                                        <p class="font-bold text-green-600">EGP ${data.revenue.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-600">التكلفة</p>
                                        <p class="font-bold text-red-600">EGP ${data.cost.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p class="text-gray-600">الربح</p>
                                        <p class="font-bold text-blue-600">EGP ${data.profit.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Notes -->
            ${report.notes ? `
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                    <p class="font-bold text-yellow-800 mb-2">📝 ملاحظات الشيفت</p>
                    <p class="text-yellow-700">${report.notes}</p>
                </div>
            ` : ''}

            <!-- Problems -->
            ${report.details.problems.length > 0 ? `
                <div class="mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                    <p class="font-bold text-red-800 mb-2">⚠️ مشاكل مسجلة (${report.details.problems.length})</p>
                    <ul class="text-sm text-red-700 space-y-1">
                        ${report.details.problems.map(p => `
                            <li>• ${p.type}: ${p.description}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Initialize shift reports section in UI
 */
export function initShiftReportsUI(container, db, allSales, allExpenses, allAccounts, allProblems, showNotification) {
    container.innerHTML = `
        <div class="mb-6">
            <h2 class="text-3xl font-bold text-gray-800 mb-2">📊 تقارير الشيفتات</h2>
            <p class="text-gray-600">تقارير مفصلة لكل شيفت عمل</p>
        </div>

        <!-- Quick Actions -->
        <div class="flex flex-wrap gap-3 mb-6">
            <button id="generate-current-shift-report" class="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all">
                <i class="fas fa-file-alt mr-2"></i>إنشاء تقرير للشيفت الحالي
            </button>
            <button id="generate-custom-shift-report" class="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all">
                <i class="fas fa-calendar-alt mr-2"></i>إنشاء تقرير مخصص
            </button>
            <button id="export-shift-reports" class="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all">
                <i class="fas fa-file-excel mr-2"></i>تصدير التقارير
            </button>
        </div>

        <!-- Current Shift Info -->
        <div id="current-shift-info" class="mb-6"></div>

        <!-- Reports List -->
        <div id="shift-reports-list"></div>
    `;
    
    // Show current shift info
    const currentShift = getCurrentShift();
    const currentShiftInfo = document.getElementById('current-shift-info');
    currentShiftInfo.innerHTML = `
        <div class="bg-gradient-to-r ${currentShift.color} rounded-lg p-6 text-white shadow-lg">
            <div class="flex items-center gap-4">
                <i class="fas ${currentShift.icon} text-4xl"></i>
                <div>
                    <p class="text-sm opacity-90">الشيفت الحالي</p>
                    <p class="text-2xl font-bold">${currentShift.name}</p>
                    <p class="text-sm opacity-90">
                        ${currentShift.start}:00 - ${currentShift.end === 24 ? '12' : currentShift.end}:00 
                        ${currentShift.end === 24 ? 'AM' : currentShift.end < 12 ? 'AM' : 'PM'}
                    </p>
                </div>
            </div>
        </div>
    `;
    
    // Load recent reports
    loadRecentReports();
    
    // Event listeners
    document.getElementById('generate-current-shift-report').addEventListener('click', async () => {
        await generateCurrentShiftReport();
    });
    
    async function generateCurrentShiftReport() {
        const currentShift = getCurrentShift();
        const today = new Date();
        
        showNotification('جاري إنشاء التقرير...', 'info');
        
        const report = await generateShiftReport(
            db, 
            today, 
            currentShift, 
            allSales, 
            allExpenses, 
            allAccounts, 
            allProblems
        );
        
        // Show report preview
        const reportsList = document.getElementById('shift-reports-list');
        reportsList.insertAdjacentHTML('afterbegin', renderShiftReportUI(report));
        
        // Ask if user wants to save
        if (confirm('هل تريد حفظ هذا التقرير؟')) {
            const notes = prompt('أضف ملاحظات (اختياري):') || '';
            const result = await saveShiftReport(db, report, 'Admin', notes);
            
            if (result.success) {
                showNotification('تم حفظ التقرير بنجاح', 'success');
            } else {
                showNotification('فشل حفظ التقرير', 'danger');
            }
        }
    }
    
    async function loadRecentReports() {
        const reports = await getRecentShiftReports(db, 5);
        const reportsList = document.getElementById('shift-reports-list');
        
        if (reports.length === 0) {
            reportsList.innerHTML = `
                <div class="text-center py-10 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>لا توجد تقارير محفوظة بعد</p>
                </div>
            `;
            return;
        }
        
        reportsList.innerHTML = reports.map(report => renderShiftReportUI(report)).join('');
    }
}
