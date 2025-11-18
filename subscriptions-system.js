/**
 * نظام إدارة الاشتراكات والتجديدات
 * SubPro Subscriptions Management System
 * 
 * هذا الملف يحتوي على جميع الدوال الخاصة بـ:
 * - إدارة الاشتراكات
 * - التجديدات اليدوية والتلقائية
 * - التنبيهات
 * - استبدال الحسابات التالفة
 * - الاشتراكات طويلة المدة
 */

import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    serverTimestamp,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// حالات الاشتراك
export const SUBSCRIPTION_STATUS = {
    ACTIVE: 'active',
    EXPIRING_SOON: 'expiring_soon',
    EXPIRED: 'expired',
    RENEWED: 'renewed',
    CANCELLED: 'cancelled'
};

// أنواع الأوردرات
export const ORDER_TYPE = {
    NEW: 'new',
    RENEWAL: 'renewal'
};

// حالات الدفع
export const PAYMENT_STATUS = {
    PAID: 'paid',
    PARTIAL: 'partial',
    UNPAID: 'unpaid'
};

// أنواع التنبيهات
export const NOTIFICATION_TYPE = {
    SUBSCRIPTION_EXPIRING: 'subscription_expiring',
    RENEWAL_FAILED: 'renewal_failed',
    PAYMENT_PENDING: 'payment_pending',
    ACCOUNT_CHANGE_DUE: 'account_change_due'
};

// تكرار تغيير الحساب
export const ACCOUNT_CHANGE_FREQUENCY = {
    NONE: 'none',
    MONTHLY: 'monthly',
    QUARTERLY: 'quarterly',
    SEMI_ANNUAL: 'semi_annual'
};

/**
 * حساب تاريخ انتهاء الاشتراك
 * @param {Date} startDate - تاريخ البداية
 * @param {number} durationMonths - مدة الاشتراك بالأشهر
 * @returns {Date} تاريخ الانتهاء
 */
export function calculateSubscriptionEnd(startDate, durationMonths) {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);
    return endDate;
}

/**
 * حساب حالة الاشتراك بناءً على تاريخ الانتهاء
 * @param {Date} endDate - تاريخ انتهاء الاشتراك
 * @returns {string} حالة الاشتراك
 */
export function calculateSubscriptionStatus(endDate) {
    const now = new Date();
    const timeUntilExpiry = endDate - now;
    const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
    
    if (timeUntilExpiry < 0) {
        return SUBSCRIPTION_STATUS.EXPIRED;
    } else if (hoursUntilExpiry <= 48) {
        return SUBSCRIPTION_STATUS.EXPIRING_SOON;
    } else {
        return SUBSCRIPTION_STATUS.ACTIVE;
    }
}

/**
 * حساب تاريخ التغيير التالي للحساب
 * @param {Date} lastChange - آخر تاريخ تغيير
 * @param {string} frequency - تكرار التغيير
 * @returns {Date} تاريخ التغيير التالي
 */
export function calculateNextAccountChange(lastChange, frequency) {
    const nextChange = new Date(lastChange);
    
    switch (frequency) {
        case ACCOUNT_CHANGE_FREQUENCY.MONTHLY:
            nextChange.setMonth(nextChange.getMonth() + 1);
            break;
        case ACCOUNT_CHANGE_FREQUENCY.QUARTERLY:
            nextChange.setMonth(nextChange.getMonth() + 3);
            break;
        case ACCOUNT_CHANGE_FREQUENCY.SEMI_ANNUAL:
            nextChange.setMonth(nextChange.getMonth() + 6);
            break;
        default:
            return null;
    }
    
    return nextChange;
}

/**
 * إنشاء أوردر تجديد
 * @param {object} db - Firestore database instance
 * @param {object} originalOrder - الأوردر الأصلي
 * @param {object} renewalData - بيانات التجديد
 * @returns {Promise<string>} معرف الأوردر الجديد
 */
export async function createRenewalOrder(db, originalOrder, renewalData) {
    try {
        const now = new Date();
        const subscriptionEnd = calculateSubscriptionEnd(
            now, 
            renewalData.durationMonths || originalOrder.subscription_duration_months || 1
        );
        
        const renewalOrder = {
            // بيانات العميل من الأوردر الأصلي
            customer_name: originalOrder.customer_name,
            customer_phone: originalOrder.customer_phone,
            customer_email: originalOrder.customer_email,
            
            // بيانات المنتج
            product: renewalData.product || originalOrder.product,
            price: renewalData.price || originalOrder.price,
            cost: renewalData.cost || originalOrder.cost,
            profit: (renewalData.price || originalOrder.price) - (renewalData.cost || originalOrder.cost),
            
            // نوع الأوردر والربط
            order_type: ORDER_TYPE.RENEWAL,
            parent_order_id: originalOrder.id,
            
            // بيانات الاشتراك
            subscription_start: Timestamp.fromDate(now),
            subscription_end: Timestamp.fromDate(subscriptionEnd),
            subscription_status: SUBSCRIPTION_STATUS.ACTIVE,
            subscription_duration_months: renewalData.durationMonths || originalOrder.subscription_duration_months || 1,
            auto_renew: renewalData.auto_renew || false,
            
            // تكرار تغيير الحساب
            account_change_frequency: renewalData.account_change_frequency || ACCOUNT_CHANGE_FREQUENCY.NONE,
            last_account_change: renewalData.account_change_frequency !== ACCOUNT_CHANGE_FREQUENCY.NONE 
                ? Timestamp.fromDate(now) 
                : null,
            next_account_change: renewalData.account_change_frequency !== ACCOUNT_CHANGE_FREQUENCY.NONE 
                ? Timestamp.fromDate(calculateNextAccountChange(now, renewalData.account_change_frequency))
                : null,
            
            // حالة الدفع
            payment_status: renewalData.payment_status || PAYMENT_STATUS.UNPAID,
            amount_paid: renewalData.amount_paid || 0,
            amount_remaining: (renewalData.price || originalOrder.price) - (renewalData.amount_paid || 0),
            
            // الحساب
            account_email: renewalData.account_email || '',
            account_password: renewalData.account_password || '',
            
            // الحالة والتواريخ
            status: 'pending',
            created_at: serverTimestamp(),
            confirmed_at: null,
            
            // سجل الاستبدال
            replacement_history: []
        };
        
        // إضافة الأوردر الجديد
        const docRef = await addDoc(collection(db, 'sales'), renewalOrder);
        
        // تحديث الأوردر الأصلي
        await updateDoc(doc(db, 'sales', originalOrder.id), {
            subscription_status: SUBSCRIPTION_STATUS.RENEWED,
            renewed_at: serverTimestamp(),
            renewal_order_id: docRef.id
        });
        
        // إنشاء سجل في Audit Log
        await addDoc(collection(db, 'audit_logs'), {
            action_type: 'subscription_renewed',
            order_id: docRef.id,
            original_order_id: originalOrder.id,
            performed_at: serverTimestamp(),
            details: `تم تجديد الاشتراك للعميل ${originalOrder.customer_name}`
        });
        
        return docRef.id;
    } catch (error) {
        console.error('خطأ في إنشاء أوردر التجديد:', error);
        throw error;
    }
}

/**
 * البحث عن اشتراكات للتجديد
 * @param {object} db - Firestore database instance
 * @param {string} searchTerm - كلمة البحث
 * @param {string} searchType - نوع البحث (name, phone, email, order_id, product)
 * @returns {Promise<Array>} قائمة الاشتراكات المطابقة
 */
export async function searchSubscriptionsForRenewal(db, searchTerm, searchType = 'all') {
    try {
        const salesRef = collection(db, 'sales');
        let queries = [];
        
        if (searchType === 'all' || searchType === 'name') {
            queries.push(query(salesRef, where('customer_name', '>=', searchTerm), where('customer_name', '<=', searchTerm + '\uf8ff')));
        }
        if (searchType === 'all' || searchType === 'phone') {
            queries.push(query(salesRef, where('customer_phone', '==', searchTerm)));
        }
        if (searchType === 'all' || searchType === 'email') {
            queries.push(query(salesRef, where('customer_email', '==', searchTerm)));
        }
        if (searchType === 'all' || searchType === 'product') {
            queries.push(query(salesRef, where('product', '==', searchTerm)));
        }
        
        const results = [];
        const seenIds = new Set();
        
        for (const q of queries) {
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                if (!seenIds.has(doc.id)) {
                    seenIds.add(doc.id);
                    const data = doc.data();
                    results.push({
                        id: doc.id,
                        ...data,
                        subscription_end: data.subscription_end?.toDate(),
                        subscription_start: data.subscription_start?.toDate(),
                        created_at: data.created_at?.toDate()
                    });
                }
            });
        }
        
        return results;
    } catch (error) {
        console.error('خطأ في البحث عن الاشتراكات:', error);
        throw error;
    }
}

/**
 * فحص الاشتراكات القريبة من الانتهاء وإنشاء تنبيهات
 * @param {object} db - Firestore database instance
 * @returns {Promise<Array>} قائمة التنبيهات المنشأة
 */
export async function checkExpiringSubscriptions(db) {
    try {
        const now = new Date();
        const in48Hours = new Date(now.getTime() + (48 * 60 * 60 * 1000));
        
        const salesRef = collection(db, 'sales');
        const q = query(
            salesRef,
            where('subscription_status', 'in', [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.EXPIRING_SOON]),
            where('subscription_end', '<=', Timestamp.fromDate(in48Hours))
        );
        
        const snapshot = await getDocs(q);
        const notifications = [];
        
        for (const docSnap of snapshot.docs) {
            const order = { id: docSnap.id, ...docSnap.data() };
            const endDate = order.subscription_end.toDate();
            const hoursUntilExpiry = (endDate - now) / (1000 * 60 * 60);
            
            // تحديث حالة الاشتراك
            const newStatus = calculateSubscriptionStatus(endDate);
            if (order.subscription_status !== newStatus) {
                await updateDoc(doc(db, 'sales', order.id), {
                    subscription_status: newStatus
                });
            }
            
            // التحقق من وجود تنبيه سابق
            const notificationsRef = collection(db, 'notifications');
            const existingNotifQuery = query(
                notificationsRef,
                where('related_order_id', '==', order.id),
                where('type', '==', NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRING),
                where('is_read', '==', false)
            );
            
            const existingNotif = await getDocs(existingNotifQuery);
            
            if (existingNotif.empty && hoursUntilExpiry > 0) {
                // إنشاء تنبيه جديد
                const notification = {
                    type: NOTIFICATION_TYPE.SUBSCRIPTION_EXPIRING,
                    title: 'اشتراك قريب من الانتهاء',
                    message: `اشتراك العميل ${order.customer_name} في ${order.product} سينتهي خلال ${Math.floor(hoursUntilExpiry)} ساعة`,
                    related_order_id: order.id,
                    priority: hoursUntilExpiry <= 24 ? 'high' : 'medium',
                    is_read: false,
                    action_required: true,
                    auto_dismiss_on_action: true,
                    created_at: serverTimestamp()
                };
                
                const notifRef = await addDoc(notificationsRef, notification);
                notifications.push({ id: notifRef.id, ...notification });
            }
        }
        
        return notifications;
    } catch (error) {
        console.error('خطأ في فحص الاشتراكات:', error);
        throw error;
    }
}

/**
 * فحص الاشتراكات التي تحتاج تغيير حساب
 * @param {object} db - Firestore database instance
 * @returns {Promise<Array>} قائمة التنبيهات المنشأة
 */
export async function checkAccountChangeDue(db) {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        
        const salesRef = collection(db, 'sales');
        const q = query(
            salesRef,
            where('account_change_frequency', '!=', ACCOUNT_CHANGE_FREQUENCY.NONE),
            where('next_account_change', '<=', Timestamp.fromDate(tomorrow))
        );
        
        const snapshot = await getDocs(q);
        const notifications = [];
        
        for (const docSnap of snapshot.docs) {
            const order = { id: docSnap.id, ...docSnap.data() };
            
            // التحقق من وجود تنبيه سابق
            const notificationsRef = collection(db, 'notifications');
            const existingNotifQuery = query(
                notificationsRef,
                where('related_order_id', '==', order.id),
                where('type', '==', NOTIFICATION_TYPE.ACCOUNT_CHANGE_DUE),
                where('is_read', '==', false)
            );
            
            const existingNotif = await getDocs(existingNotifQuery);
            
            if (existingNotif.empty) {
                // إنشاء تنبيه جديد
                const notification = {
                    type: NOTIFICATION_TYPE.ACCOUNT_CHANGE_DUE,
                    title: 'حان موعد تغيير الحساب',
                    message: `يجب تسليم حساب جديد للعميل ${order.customer_name} في ${order.product}`,
                    related_order_id: order.id,
                    priority: 'high',
                    is_read: false,
                    action_required: true,
                    auto_dismiss_on_action: false,
                    created_at: serverTimestamp()
                };
                
                const notifRef = await addDoc(notificationsRef, notification);
                notifications.push({ id: notifRef.id, ...notification });
            }
        }
        
        return notifications;
    } catch (error) {
        console.error('خطأ في فحص تغيير الحسابات:', error);
        throw error;
    }
}

/**
 * استبدال حساب تالف
 * @param {object} db - Firestore database instance
 * @param {string} orderId - معرف الأوردر
 * @param {string} userId - معرف المستخدم الذي يقوم بالاستبدال
 * @returns {Promise<object>} نتيجة الاستبدال
 */
export async function replaceDamagedAccount(db, orderId, userId) {
    try {
        // جلب الأوردر
        const orderRef = doc(db, 'sales', orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            throw new Error('الأوردر غير موجود');
        }
        
        const order = { id: orderSnap.id, ...orderSnap.data() };
        
        if (!order.account_email) {
            throw new Error('لا يوجد حساب مرتبط بهذا الأوردر');
        }
        
        // البحث عن حساب بديل متاح من نفس المنتج
        const accountsRef = collection(db, 'accounts');
        const q = query(
            accountsRef,
            where('product', '==', order.product),
            where('status', '==', 'available'),
            orderBy('created_at', 'asc')
        );
        
        const accountsSnap = await getDocs(q);
        
        if (accountsSnap.empty) {
            throw new Error(`لا يوجد حساب متاح للمنتج ${order.product}`);
        }
        
        // أخذ أول حساب متاح
        const newAccountDoc = accountsSnap.docs[0];
        const newAccount = { id: newAccountDoc.id, ...newAccountDoc.data() };
        
        // الحساب القديم
        const oldAccount = {
            email: order.account_email,
            password: order.account_password,
            replaced_at: new Date(),
            replaced_by: userId
        };
        
        // تحديث الأوردر
        const replacementHistory = order.replacement_history || [];
        replacementHistory.push({
            old_account: oldAccount,
            new_account: {
                email: newAccount.email,
                password: newAccount.password
            },
            timestamp: serverTimestamp(),
            user: userId
        });
        
        await updateDoc(orderRef, {
            account_email: newAccount.email,
            account_password: newAccount.password,
            replaced_account: oldAccount,
            replacement_history: replacementHistory,
            status: 'replaced'
        });
        
        // تحديث الحساب الجديد
        await updateDoc(doc(db, 'accounts', newAccount.id), {
            status: 'used',
            used_at: serverTimestamp(),
            linked_order_id: orderId
        });
        
        // إضافة سجل في Audit Log
        await addDoc(collection(db, 'audit_logs'), {
            action_type: 'account_replaced',
            order_id: orderId,
            old_value: oldAccount,
            new_value: {
                email: newAccount.email,
                password: newAccount.password
            },
            performed_by: userId,
            performed_at: serverTimestamp(),
            details: `تم استبدال حساب تالف للعميل ${order.customer_name}`
        });
        
        return {
            success: true,
            oldAccount,
            newAccount: {
                email: newAccount.email,
                password: newAccount.password
            }
        };
    } catch (error) {
        console.error('خطأ في استبدال الحساب:', error);
        throw error;
    }
}

/**
 * تحديث حالة الدفع للأوردر
 * @param {object} db - Firestore database instance
 * @param {string} orderId - معرف الأوردر
 * @param {number} amountPaid - المبلغ المدفوع
 * @param {number} totalAmount - المبلغ الإجمالي
 * @returns {Promise<void>}
 */
export async function updatePaymentStatus(db, orderId, amountPaid, totalAmount) {
    try {
        const amountRemaining = totalAmount - amountPaid;
        let paymentStatus;
        
        if (amountPaid >= totalAmount) {
            paymentStatus = PAYMENT_STATUS.PAID;
        } else if (amountPaid > 0) {
            paymentStatus = PAYMENT_STATUS.PARTIAL;
        } else {
            paymentStatus = PAYMENT_STATUS.UNPAID;
        }
        
        await updateDoc(doc(db, 'sales', orderId), {
            payment_status: paymentStatus,
            amount_paid: amountPaid,
            amount_remaining: Math.max(0, amountRemaining)
        });
        
        // إنشاء تنبيه إذا كان هناك مبلغ متبقي
        if (amountRemaining > 0) {
            const orderRef = doc(db, 'sales', orderId);
            const orderSnap = await getDoc(orderRef);
            const order = orderSnap.data();
            
            await addDoc(collection(db, 'notifications'), {
                type: NOTIFICATION_TYPE.PAYMENT_PENDING,
                title: 'مبلغ متبقي على أوردر',
                message: `العميل ${order.customer_name} عليه مبلغ متبقي ${amountRemaining} جنيه`,
                related_order_id: orderId,
                priority: 'medium',
                is_read: false,
                action_required: true,
                auto_dismiss_on_action: false,
                created_at: serverTimestamp()
            });
        }
    } catch (error) {
        console.error('خطأ في تحديث حالة الدفع:', error);
        throw error;
    }
}

/**
 * تسجيل تسليم حساب شهري
 * @param {object} db - Firestore database instance
 * @param {string} orderId - معرف الأوردر
 * @param {object} accountData - بيانات الحساب الجديد
 * @returns {Promise<void>}
 */
export async function recordMonthlyAccountDelivery(db, orderId, accountData) {
    try {
        const orderRef = doc(db, 'sales', orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            throw new Error('الأوردر غير موجود');
        }
        
        const order = orderSnap.data();
        const now = new Date();
        const nextChange = calculateNextAccountChange(now, order.account_change_frequency);
        
        await updateDoc(orderRef, {
            account_email: accountData.email,
            account_password: accountData.password,
            last_account_change: Timestamp.fromDate(now),
            next_account_change: nextChange ? Timestamp.fromDate(nextChange) : null
        });
        
        // إزالة التنبيه المرتبط
        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('related_order_id', '==', orderId),
            where('type', '==', NOTIFICATION_TYPE.ACCOUNT_CHANGE_DUE),
            where('is_read', '==', false)
        );
        
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
            await updateDoc(doc(db, 'notifications', docSnap.id), {
                is_read: true
            });
        }
    } catch (error) {
        console.error('خطأ في تسجيل تسليم الحساب:', error);
        throw error;
    }
}

/**
 * الحصول على إحصائيات الاشتراكات
 * @param {object} db - Firestore database instance
 * @returns {Promise<object>} إحصائيات الاشتراكات
 */
export async function getSubscriptionStatistics(db) {
    try {
        const salesRef = collection(db, 'sales');
        const snapshot = await getDocs(salesRef);
        
        const stats = {
            total: 0,
            active: 0,
            expiring_soon: 0,
            expired: 0,
            renewed: 0,
            cancelled: 0,
            auto_renew_enabled: 0
        };
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.subscription_status) {
                stats.total++;
                stats[data.subscription_status]++;
                if (data.auto_renew) {
                    stats.auto_renew_enabled++;
                }
            }
        });
        
        return stats;
    } catch (error) {
        console.error('خطأ في جلب إحصائيات الاشتراكات:', error);
        throw error;
    }
}
