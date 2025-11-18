/**
 * Google Sheets Integration
 * نظام الربط التلقائي مع Google Sheets
 * 
 * هذا الملف يتعامل مع:
 * - إرسال الأوردرات تلقائياً إلى Google Sheets
 * - تحديث البيانات عند التعديل
 * - معالجة الأخطاء
 */

/**
 * إعدادات Google Sheets
 * يجب تعديل هذه القيم حسب حسابك
 */
const GOOGLE_SHEETS_CONFIG = {
    // معرف الشيت (يمكن الحصول عليه من رابط الشيت)
    spreadsheetId: '', // ضع هنا معرف الشيت
    
    // اسم الورقة داخل الشيت
    sheetName: 'Orders',
    
    // Web App URL (بعد نشر Google Apps Script)
    webAppUrl: '', // ضع هنا رابط Web App
    
    // تفعيل/تعطيل الربط
    enabled: false // غير إلى true بعد الإعداد
};

/**
 * حساب الشيفت من التاريخ
 * @param {Date} date - التاريخ
 * @returns {string} اسم الشيفت
 */
function getShiftFromDate(date) {
    const hour = date.getHours();
    
    if (hour >= 16 || hour < 0) {
        return 'مسائي (4م-12م)';
    } else if (hour >= 0 && hour < 8) {
        return 'ليلي (12م-8ص)';
    } else {
        return 'صباحي (8ص-4م)';
    }
}

/**
 * تحويل الأوردر إلى صف في الشيت
 * @param {object} order - بيانات الأوردر
 * @returns {Array} صف البيانات
 */
function orderToSheetRow(order) {
    const createdAt = order.created_at?.toDate ? order.created_at.toDate() : new Date(order.created_at);
    
    return [
        order.id || '',
        createdAt.toLocaleString('ar-EG'),
        order.customer_name || '',
        order.customer_phone || '',
        order.customer_email || '',
        order.product || '',
        order.price || 0,
        order.cost || 0,
        order.profit || 0,
        order.payment_status || 'unpaid',
        order.amount_paid || 0,
        order.amount_remaining || 0,
        order.status || 'pending',
        order.order_type || 'new',
        getShiftFromDate(createdAt),
        order.subscription_status || '',
        order.account_email || '',
        order.notes || ''
    ];
}

/**
 * إرسال أوردر إلى Google Sheets
 * @param {object} order - بيانات الأوردر
 * @returns {Promise<boolean>} نجاح العملية
 */
export async function sendOrderToGoogleSheets(order) {
    if (!GOOGLE_SHEETS_CONFIG.enabled) {
        console.log('Google Sheets integration is disabled');
        return false;
    }
    
    if (!GOOGLE_SHEETS_CONFIG.webAppUrl) {
        console.error('Google Sheets Web App URL is not configured');
        return false;
    }
    
    try {
        const row = orderToSheetRow(order);
        
        const response = await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'addRow',
                sheetName: GOOGLE_SHEETS_CONFIG.sheetName,
                data: row
            })
        });
        
        console.log('Order sent to Google Sheets successfully');
        return true;
    } catch (error) {
        console.error('Error sending order to Google Sheets:', error);
        return false;
    }
}

/**
 * تحديث أوردر في Google Sheets
 * @param {object} order - بيانات الأوردر المحدثة
 * @returns {Promise<boolean>} نجاح العملية
 */
export async function updateOrderInGoogleSheets(order) {
    if (!GOOGLE_SHEETS_CONFIG.enabled) {
        console.log('Google Sheets integration is disabled');
        return false;
    }
    
    if (!GOOGLE_SHEETS_CONFIG.webAppUrl) {
        console.error('Google Sheets Web App URL is not configured');
        return false;
    }
    
    try {
        const row = orderToSheetRow(order);
        
        const response = await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateRow',
                sheetName: GOOGLE_SHEETS_CONFIG.sheetName,
                orderId: order.id,
                data: row
            })
        });
        
        console.log('Order updated in Google Sheets successfully');
        return true;
    } catch (error) {
        console.error('Error updating order in Google Sheets:', error);
        return false;
    }
}

/**
 * إرسال دفعة من الأوردرات إلى Google Sheets
 * @param {Array} orders - قائمة الأوردرات
 * @returns {Promise<object>} نتيجة العملية
 */
export async function bulkSendOrdersToGoogleSheets(orders) {
    if (!GOOGLE_SHEETS_CONFIG.enabled) {
        console.log('Google Sheets integration is disabled');
        return { success: false, message: 'Integration disabled' };
    }
    
    if (!GOOGLE_SHEETS_CONFIG.webAppUrl) {
        console.error('Google Sheets Web App URL is not configured');
        return { success: false, message: 'Web App URL not configured' };
    }
    
    try {
        const rows = orders.map(order => orderToSheetRow(order));
        
        const response = await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'bulkAddRows',
                sheetName: GOOGLE_SHEETS_CONFIG.sheetName,
                data: rows
            })
        });
        
        console.log(`${orders.length} orders sent to Google Sheets successfully`);
        return { success: true, count: orders.length };
    } catch (error) {
        console.error('Error bulk sending orders to Google Sheets:', error);
        return { success: false, message: error.message };
    }
}

/**
 * تهيئة Google Sheets (إنشاء الهيدر)
 * @returns {Promise<boolean>} نجاح العملية
 */
export async function initializeGoogleSheets() {
    if (!GOOGLE_SHEETS_CONFIG.enabled) {
        console.log('Google Sheets integration is disabled');
        return false;
    }
    
    if (!GOOGLE_SHEETS_CONFIG.webAppUrl) {
        console.error('Google Sheets Web App URL is not configured');
        return false;
    }
    
    try {
        const headers = [
            'رقم الأوردر',
            'التاريخ',
            'اسم العميل',
            'رقم الهاتف',
            'البريد الإلكتروني',
            'المنتج',
            'السعر',
            'التكلفة',
            'الربح',
            'حالة الدفع',
            'المبلغ المدفوع',
            'المبلغ المتبقي',
            'حالة الأوردر',
            'نوع الأوردر',
            'الشيفت',
            'حالة الاشتراك',
            'الحساب',
            'ملاحظات'
        ];
        
        const response = await fetch(GOOGLE_SHEETS_CONFIG.webAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'initializeSheet',
                sheetName: GOOGLE_SHEETS_CONFIG.sheetName,
                headers: headers
            })
        });
        
        console.log('Google Sheets initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing Google Sheets:', error);
        return false;
    }
}

/**
 * تحديث إعدادات Google Sheets
 * @param {object} config - الإعدادات الجديدة
 */
export function updateGoogleSheetsConfig(config) {
    if (config.spreadsheetId) GOOGLE_SHEETS_CONFIG.spreadsheetId = config.spreadsheetId;
    if (config.sheetName) GOOGLE_SHEETS_CONFIG.sheetName = config.sheetName;
    if (config.webAppUrl) GOOGLE_SHEETS_CONFIG.webAppUrl = config.webAppUrl;
    if (typeof config.enabled !== 'undefined') GOOGLE_SHEETS_CONFIG.enabled = config.enabled;
    
    // حفظ الإعدادات في localStorage
    localStorage.setItem('googleSheetsConfig', JSON.stringify(GOOGLE_SHEETS_CONFIG));
}

/**
 * تحميل إعدادات Google Sheets من localStorage
 */
export function loadGoogleSheetsConfig() {
    const saved = localStorage.getItem('googleSheetsConfig');
    if (saved) {
        const config = JSON.parse(saved);
        updateGoogleSheetsConfig(config);
    }
}

/**
 * الحصول على إعدادات Google Sheets الحالية
 * @returns {object} الإعدادات
 */
export function getGoogleSheetsConfig() {
    return { ...GOOGLE_SHEETS_CONFIG };
}

// تحميل الإعدادات عند بدء التشغيل
loadGoogleSheetsConfig();
