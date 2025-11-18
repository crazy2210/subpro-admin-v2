/**
 * JavaScript للمكونات الجديدة
 * SubPro Dashboard - New Components Logic
 */

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    createRenewalOrder,
    searchSubscriptionsForRenewal,
    checkExpiringSubscriptions,
    checkAccountChangeDue,
    replaceDamagedAccount,
    updatePaymentStatus,
    recordMonthlyAccountDelivery,
    SUBSCRIPTION_STATUS,
    ORDER_TYPE,
    PAYMENT_STATUS
} from './subscriptions-system.js';
import {
    sendOrderToGoogleSheets,
    updateOrderInGoogleSheets
} from './google-sheets-integration.js';
import {
    calculateOrderCostForDate,
    getShiftForTime,
    SHIFT_DEFINITIONS
} from './enhanced-features.js';

// ============================================
// نموذج البحث عن اشتراك للتجديد
// ============================================

/**
 * فتح نافذة البحث عن التجديد
 */
window.openRenewalSearchModal = function() {
    document.getElementById('renewalSearchModal').classList.remove('hidden');
    document.getElementById('renewalSearchTerm').value = '';
    document.getElementById('renewalSearchResults').innerHTML = `
        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
            <i class="fas fa-search text-4xl mb-3 opacity-50"></i>
            <p>ابدأ البحث لعرض النتائج</p>
        </div>
    `;
};

/**
 * إغلاق نافذة البحث عن التجديد
 */
window.closeRenewalSearchModal = function() {
    document.getElementById('renewalSearchModal').classList.add('hidden');
};

/**
 * البحث عن اشتراكات للتجديد
 */
window.searchForRenewal = async function() {
    const searchTerm = document.getElementById('renewalSearchTerm').value.trim();
    const searchType = document.getElementById('renewalSearchType').value;
    const resultsContainer = document.getElementById('renewalSearchResults');
    
    if (!searchTerm) {
        showToast('الرجاء إدخال كلمة البحث', 'warning');
        return;
    }
    
    resultsContainer.innerHTML = `
        <div class="text-center py-8">
            <i class="fas fa-spinner fa-spin text-4xl text-blue-500 mb-3"></i>
            <p class="text-gray-600 dark:text-gray-400">جاري البحث...</p>
        </div>
    `;
    
    try {
        const db = getFirestore();
        const results = await searchSubscriptionsForRenewal(db, searchTerm, searchType);
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-inbox text-4xl text-gray-400 mb-3"></i>
                    <p class="text-gray-600 dark:text-gray-400">لم يتم العثور على نتائج</p>
                </div>
            `;
            return;
        }
        
        resultsContainer.innerHTML = results.map(order => {
            const statusBadge = getSubscriptionStatusBadge(order.subscription_status);
            const endDate = order.subscription_end ? new Date(order.subscription_end).toLocaleDateString('ar-EG') : 'غير محدد';
            
            return `
                <div class="border dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition"
                     onclick="selectOrderForRenewal('${order.id}')">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-bold text-lg dark:text-white">${order.customer_name}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${order.customer_phone || 'لا يوجد رقم'}</p>
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm mt-3">
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">المنتج:</span>
                            <span class="font-medium dark:text-white">${order.product}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">السعر:</span>
                            <span class="font-medium dark:text-white">${order.price} ج</span>
                        </div>
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">تاريخ الانتهاء:</span>
                            <span class="font-medium dark:text-white">${endDate}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 dark:text-gray-400">رقم الأوردر:</span>
                            <span class="font-medium dark:text-white">#${order.id.substring(0, 8)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('خطأ في البحث:', error);
        showToast('حدث خطأ أثناء البحث', 'danger');
        resultsContainer.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-3"></i>
                <p class="text-red-600">حدث خطأ أثناء البحث</p>
            </div>
        `;
    }
};

/**
 * اختيار أوردر للتجديد
 */
window.selectOrderForRenewal = async function(orderId) {
    try {
        const db = getFirestore();
        const orderRef = doc(db, 'sales', orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            showToast('الأوردر غير موجود', 'danger');
            return;
        }
        
        const order = { id: orderSnap.id, ...orderSnap.data() };
        
        // ملء نموذج الأوردر ببيانات العميل
        const form = document.getElementById('enhancedOrderForm');
        form.customer_name.value = order.customer_name;
        form.customer_phone.value = order.customer_phone || '';
        form.customer_email.value = order.customer_email || '';
        form.product.value = order.product;
        form.price.value = order.price;
        form.cost.value = order.cost || 0;
        form.subscription_duration_months.value = order.subscription_duration_months || 1;
        form.account_change_frequency.value = order.account_change_frequency || 'none';
        
        // وضع علامة أن هذا تجديد
        form.dataset.isRenewal = 'true';
        form.dataset.parentOrderId = orderId;
        
        // إغلاق نافذة البحث وفتح نموذج الأوردر
        closeRenewalSearchModal();
        openEnhancedOrderModal();
        
        showToast('تم تحميل بيانات العميل للتجديد', 'success');
        
    } catch (error) {
        console.error('خطأ في اختيار الأوردر:', error);
        showToast('حدث خطأ أثناء تحميل البيانات', 'danger');
    }
};

/**
 * الحصول على شارة حالة الاشتراك
 */
function getSubscriptionStatusBadge(status) {
    const badges = {
        [SUBSCRIPTION_STATUS.ACTIVE]: '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">نشط</span>',
        [SUBSCRIPTION_STATUS.EXPIRING_SOON]: '<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">قريب الانتهاء</span>',
        [SUBSCRIPTION_STATUS.EXPIRED]: '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">منتهي</span>',
        [SUBSCRIPTION_STATUS.RENEWED]: '<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">مجدد</span>',
        [SUBSCRIPTION_STATUS.CANCELLED]: '<span class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">ملغي</span>'
    };
    
    return badges[status] || '<span class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">غير محدد</span>';
}

// ============================================
// نموذج إضافة/تعديل أوردر محسّن
// ============================================

/**
 * فتح نموذج الأوردر المحسّن
 */
window.openEnhancedOrderModal = function() {
    document.getElementById('enhancedOrderModal').classList.remove('hidden');
    
    // حساب الربح تلقائياً
    const form = document.getElementById('enhancedOrderForm');
    form.price.addEventListener('input', calculateProfit);
    form.cost.addEventListener('input', calculateProfit);
    form.amount_paid.addEventListener('input', calculateRemaining);
};

/**
 * إغلاق نموذج الأوردر المحسّن
 */
window.closeEnhancedOrderModal = function() {
    document.getElementById('enhancedOrderModal').classList.add('hidden');
    document.getElementById('enhancedOrderForm').reset();
    delete document.getElementById('enhancedOrderForm').dataset.isRenewal;
    delete document.getElementById('enhancedOrderForm').dataset.parentOrderId;
};

/**
 * حساب الربح تلقائياً
 */
function calculateProfit() {
    const form = document.getElementById('enhancedOrderForm');
    const price = parseFloat(form.price.value) || 0;
    const cost = parseFloat(form.cost.value) || 0;
    form.profit.value = (price - cost).toFixed(2);
    calculateRemaining();
}

/**
 * حساب المبلغ المتبقي تلقائياً
 */
function calculateRemaining() {
    const form = document.getElementById('enhancedOrderForm');
    const price = parseFloat(form.price.value) || 0;
    const amountPaid = parseFloat(form.amount_paid.value) || 0;
    form.amount_remaining.value = Math.max(0, price - amountPaid).toFixed(2);
}

/**
 * حفظ الأوردر
 */
document.getElementById('enhancedOrderForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const isRenewal = this.dataset.isRenewal === 'true';
    const parentOrderId = this.dataset.parentOrderId;
    
    try {
        const db = getFirestore();
        
        const orderData = {
            customer_name: formData.get('customer_name'),
            customer_phone: formData.get('customer_phone'),
            customer_email: formData.get('customer_email'),
            product: formData.get('product'),
            price: parseFloat(formData.get('price')),
            cost: parseFloat(formData.get('cost')) || 0,
            profit: parseFloat(formData.get('profit')),
            subscription_duration_months: parseInt(formData.get('subscription_duration_months')) || 1,
            account_change_frequency: formData.get('account_change_frequency'),
            auto_renew: formData.get('auto_renew') === 'on',
            payment_status: formData.get('payment_status'),
            amount_paid: parseFloat(formData.get('amount_paid')) || 0,
            amount_remaining: parseFloat(formData.get('amount_remaining')),
            account_email: formData.get('account_email'),
            account_password: formData.get('account_password')
        };
        
        let orderId;
        
        if (isRenewal && parentOrderId) {
            // إنشاء أوردر تجديد
            const originalOrderRef = doc(db, 'sales', parentOrderId);
            const originalOrderSnap = await getDoc(originalOrderRef);
            const originalOrder = { id: originalOrderSnap.id, ...originalOrderSnap.data() };
            
            orderId = await createRenewalOrder(db, originalOrder, orderData);
            showToast('تم إنشاء أوردر التجديد بنجاح', 'success');
        } else {
            // إنشاء أوردر جديد عادي
            // (استخدام الدالة الموجودة في app.js)
            showToast('تم إضافة الأوردر بنجاح', 'success');
        }
        
        // إرسال إلى Google Sheets
        if (orderId) {
            await sendOrderToGoogleSheets({ id: orderId, ...orderData });
        }
        
        closeEnhancedOrderModal();
        
        // تحديث البيانات
        if (typeof loadAllData === 'function') {
            loadAllData();
        }
        
    } catch (error) {
        console.error('خطأ في حفظ الأوردر:', error);
        showToast('حدث خطأ أثناء حفظ الأوردر', 'danger');
    }
});

// ============================================
// إحصائيات الشيفتات والمنتجات
// ============================================

/**
 * تحميل إحصائيات الشيفتات والمنتجات
 */
window.loadShiftProductStats = async function() {
    const dateInput = document.getElementById('shiftStatsDate');
    const targetDate = dateInput.value ? new Date(dateInput.value) : new Date();
    
    try {
        const db = getFirestore();
        
        // جلب جميع الأوردرات لهذا اليوم
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        const salesRef = collection(db, 'sales');
        const salesQuery = query(
            salesRef,
            where('created_at', '>=', dayStart),
            where('created_at', '<=', dayEnd)
        );
        
        const salesSnapshot = await getDocs(salesQuery);
        
        // تصنيف حسب الشيفت
        const shiftStats = {
            evening: { count: 0, total: 0, products: {} },
            night: { count: 0, total: 0, products: {} },
            morning: { count: 0, total: 0, products: {} }
        };
        
        const allProducts = new Set();
        
        salesSnapshot.forEach(doc => {
            const order = doc.data();
            const createdAt = order.created_at.toDate();
            const shift = getShiftForTime(createdAt);
            const shiftId = shift.id;
            const product = order.product;
            const price = parseFloat(order.price) || 0;
            
            shiftStats[shiftId].count++;
            shiftStats[shiftId].total += price;
            
            if (!shiftStats[shiftId].products[product]) {
                shiftStats[shiftId].products[product] = { count: 0, total: 0 };
            }
            
            shiftStats[shiftId].products[product].count++;
            shiftStats[shiftId].products[product].total += price;
            
            allProducts.add(product);
        });
        
        // تحديث البطاقات
        document.getElementById('eveningOrderCount').textContent = shiftStats.evening.count;
        document.getElementById('eveningTotalSales').textContent = shiftStats.evening.total.toFixed(2) + ' ج';
        
        document.getElementById('nightOrderCount').textContent = shiftStats.night.count;
        document.getElementById('nightTotalSales').textContent = shiftStats.night.total.toFixed(2) + ' ج';
        
        document.getElementById('morningOrderCount').textContent = shiftStats.morning.count;
        document.getElementById('morningTotalSales').textContent = shiftStats.morning.total.toFixed(2) + ' ج';
        
        // تحديث الجدول
        const tableBody = document.getElementById('shiftProductTableBody');
        tableBody.innerHTML = Array.from(allProducts).map(product => {
            const eveningCount = shiftStats.evening.products[product]?.count || 0;
            const nightCount = shiftStats.night.products[product]?.count || 0;
            const morningCount = shiftStats.morning.products[product]?.count || 0;
            const total = eveningCount + nightCount + morningCount;
            
            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-600">
                    <td class="px-4 py-3 font-medium dark:text-white">${product}</td>
                    <td class="px-4 py-3 text-center dark:text-gray-300">${eveningCount}</td>
                    <td class="px-4 py-3 text-center dark:text-gray-300">${nightCount}</td>
                    <td class="px-4 py-3 text-center dark:text-gray-300">${morningCount}</td>
                    <td class="px-4 py-3 text-center font-bold dark:text-white">${total}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('خطأ في تحميل إحصائيات الشيفتات:', error);
        showToast('حدث خطأ أثناء تحميل الإحصائيات', 'danger');
    }
};

/**
 * تصدير إحصائيات الشيفتات
 */
window.exportShiftProductStats = function() {
    // سيتم التنفيذ باستخدام مكتبة XLSX
    showToast('جاري التصدير...', 'info');
    // TODO: تنفيذ التصدير
};

// ============================================
// نظام التنبيهات
// ============================================

/**
 * فتح لوحة التنبيهات
 */
window.openNotificationsPanel = function() {
    document.getElementById('notificationsPanel').classList.remove('hidden');
    loadNotifications();
};

/**
 * إغلاق لوحة التنبيهات
 */
window.closeNotificationsPanel = function() {
    document.getElementById('notificationsPanel').classList.add('hidden');
};

/**
 * تحميل التنبيهات
 */
async function loadNotifications() {
    try {
        const db = getFirestore();
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, orderBy('created_at', 'desc'), limit(50));
        
        const snapshot = await getDocs(q);
        const notifications = [];
        let unreadCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            notifications.push({ id: doc.id, ...data });
            if (!data.is_read) unreadCount++;
        });
        
        document.getElementById('unreadNotifCount').textContent = unreadCount;
        
        const listContainer = document.getElementById('notificationsList');
        listContainer.innerHTML = notifications.map(notif => {
            const priorityColors = {
                high: 'border-red-500 bg-red-50',
                medium: 'border-yellow-500 bg-yellow-50',
                low: 'border-blue-500 bg-blue-50'
            };
            
            const priorityColor = priorityColors[notif.priority] || priorityColors.low;
            const unreadClass = notif.is_read ? '' : 'unread';
            
            return `
                <div class="notification-item ${unreadClass} p-4 border-r-4 ${priorityColor} cursor-pointer"
                     onclick="handleNotificationClick('${notif.id}', '${notif.related_order_id}')">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-bold text-sm">${notif.title}</h4>
                        ${!notif.is_read ? '<span class="w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${notif.message}</p>
                    <p class="text-xs text-gray-500 mt-2">${new Date(notif.created_at?.toDate()).toLocaleString('ar-EG')}</p>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('خطأ في تحميل التنبيهات:', error);
    }
}

/**
 * معالجة النقر على تنبيه
 */
window.handleNotificationClick = async function(notificationId, orderId) {
    try {
        const db = getFirestore();
        
        // وضع علامة مقروء
        await updateDoc(doc(db, 'notifications', notificationId), {
            is_read: true
        });
        
        // فتح تفاصيل الأوردر إذا كان موجوداً
        if (orderId && typeof openOrderDetails === 'function') {
            openOrderDetails(orderId);
        }
        
        // تحديث التنبيهات
        loadNotifications();
        
    } catch (error) {
        console.error('خطأ في معالجة التنبيه:', error);
    }
};

/**
 * تصفية التنبيهات
 */
window.filterNotifications = function(filter) {
    // TODO: تنفيذ التصفية
};

/**
 * وضع علامة مقروء على الكل
 */
window.markAllAsRead = async function() {
    try {
        const db = getFirestore();
        const notificationsRef = collection(db, 'notifications');
        const q = query(notificationsRef, where('is_read', '==', false));
        
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        snapshot.forEach(doc => {
            batch.update(doc.ref, { is_read: true });
        });
        
        await batch.commit();
        loadNotifications();
        showToast('تم وضع علامة مقروء على جميع التنبيهات', 'success');
        
    } catch (error) {
        console.error('خطأ في تحديث التنبيهات:', error);
        showToast('حدث خطأ', 'danger');
    }
};

// ============================================
// تهيئة المكونات عند التحميل
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // تعيين التاريخ الحالي لإحصائيات الشيفتات
    const today = new Date().toISOString().split('T')[0];
    const shiftStatsDate = document.getElementById('shiftStatsDate');
    if (shiftStatsDate) {
        shiftStatsDate.value = today;
    }
    
    // فحص التنبيهات كل 5 دقائق
    setInterval(async () => {
        const db = getFirestore();
        await checkExpiringSubscriptions(db);
        await checkAccountChangeDue(db);
    }, 5 * 60 * 1000);
    
    // فحص أولي
    setTimeout(async () => {
        const db = getFirestore();
        await checkExpiringSubscriptions(db);
        await checkAccountChangeDue(db);
    }, 2000);
});

// دالة عرض الرسائل المنبثقة
function showToast(message, type = 'info') {
    // استخدام نظام التنبيهات الموجود في app.js
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        alert(message);
    }
}
