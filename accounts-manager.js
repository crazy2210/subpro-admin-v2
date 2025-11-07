// accounts-manager.js - Enhanced Accounts Management System
import { doc, updateDoc, addDoc, deleteDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { exportAccountsToExcel } from './export-manager.js';

// Account status definitions
export const ACCOUNT_STATUS = {
    ACTIVE: { id: 'active', label: 'نشط', color: 'bg-green-100 text-green-800', icon: 'fa-check-circle' },
    IN_USE: { id: 'in_use', label: 'قيد الاستخدام', color: 'bg-blue-100 text-blue-800', icon: 'fa-clock' },
    EXPIRED: { id: 'expired', label: 'منتهي', color: 'bg-red-100 text-red-800', icon: 'fa-times-circle' },
    BLOCKED: { id: 'blocked', label: 'محظور', color: 'bg-gray-100 text-gray-800', icon: 'fa-ban' },
    PENDING: { id: 'pending', label: 'في انتظار التجديد', color: 'bg-yellow-100 text-yellow-800', icon: 'fa-hourglass-half' }
};

/**
 * Get account status based on current state
 */
export function getAccountStatus(account) {
    if (!account.is_active) {
        return ACCOUNT_STATUS.BLOCKED;
    }
    
    if (account.current_uses >= account.allowed_uses && account.allowed_uses !== Infinity) {
        return ACCOUNT_STATUS.EXPIRED;
    }
    
    if (account.current_uses > 0) {
        return ACCOUNT_STATUS.IN_USE;
    }
    
    return ACCOUNT_STATUS.ACTIVE;
}

/**
 * Generate unique account ID
 */
export function generateAccountId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 7);
    return `ACC-${timestamp}-${randomStr}`.toUpperCase();
}

/**
 * Render enhanced account card with inline editing
 */
export function renderAccountCard(account, index) {
    const status = getAccountStatus(account);
    const usagePercent = account.allowed_uses === Infinity ? 0 : 
        Math.min(100, (account.current_uses / account.allowed_uses) * 100);
    
    const isAvailable = account.is_active && account.current_uses < account.allowed_uses;
    const needsReplacement = !account.is_active || account.current_uses >= account.allowed_uses;
    
    return `
        <div class="account-card bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-5 border-l-4 ${
            isAvailable ? 'border-green-500' : 'border-red-500'
        }" data-account-id="${account.id}">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="px-3 py-1 rounded-full text-xs font-bold ${status.color}">
                            <i class="fas ${status.icon} mr-1"></i>${status.label}
                        </span>
                        <span class="text-xs text-gray-500">#${index + 1}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800">${account.productName || 'غير محدد'}</h3>
                    <p class="text-xs text-gray-500">ID: ${account.accountId || account.id}</p>
                </div>
                
                <div class="flex gap-2">
                    ${needsReplacement ? `
                        <button 
                            class="quick-replace-btn px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-md text-xs font-bold hover:shadow-lg transition-all"
                            data-account-id="${account.id}"
                            title="استبدال سريع"
                        >
                            <i class="fas fa-sync-alt mr-1"></i>استبدال
                        </button>
                    ` : ''}
                    <button 
                        class="delete-account-btn px-3 py-1 bg-red-500 text-white rounded-md text-xs hover:bg-red-600"
                        data-account-id="${account.id}"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <!-- Account Details - Inline Editable -->
            <div class="space-y-3">
                <!-- Email -->
                <div class="flex items-center gap-2">
                    <i class="fas fa-envelope text-gray-400 w-5"></i>
                    <input 
                        type="email" 
                        class="account-email-input flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        value="${account.email || ''}"
                        data-account-id="${account.id}"
                        data-field="email"
                        placeholder="البريد الإلكتروني"
                    />
                    <button 
                        class="copy-btn px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-xs"
                        data-copy="${account.email || ''}"
                        title="نسخ"
                    >
                        <i class="fas fa-copy"></i>
                    </button>
                </div>

                <!-- Password -->
                <div class="flex items-center gap-2">
                    <i class="fas fa-key text-gray-400 w-5"></i>
                    <input 
                        type="text" 
                        class="account-password-input flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        value="${account.password || ''}"
                        data-account-id="${account.id}"
                        data-field="password"
                        placeholder="كلمة المرور"
                    />
                    <button 
                        class="copy-btn px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-xs"
                        data-copy="${account.password || ''}"
                        title="نسخ"
                    >
                        <i class="fas fa-copy"></i>
                    </button>
                </div>

                <!-- Usage Progress -->
                <div>
                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                        <span>الاستخدام</span>
                        <span>${account.current_uses || 0} / ${account.allowed_uses === Infinity ? '∞' : account.allowed_uses}</span>
                    </div>
                    ${account.allowed_uses !== Infinity ? `
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                class="h-2 rounded-full transition-all ${
                                    usagePercent < 50 ? 'bg-green-500' : 
                                    usagePercent < 80 ? 'bg-yellow-500' : 'bg-red-500'
                                }"
                                style="width: ${usagePercent}%"
                            ></div>
                        </div>
                    ` : `
                        <p class="text-xs text-gray-500 italic">استخدام غير محدود</p>
                    `}
                </div>

                <!-- Notes -->
                <div>
                    <textarea 
                        class="account-notes-input w-full px-3 py-2 border border-gray-200 rounded-md text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        data-account-id="${account.id}"
                        data-field="notes"
                        placeholder="ملاحظات..."
                        rows="2"
                    >${account.notes || ''}</textarea>
                </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">
                <span>
                    <i class="fas fa-calendar mr-1"></i>
                    ${account.createdAt ? new Date(account.createdAt).toLocaleDateString('ar-EG') : 'غير محدد'}
                </span>
                <button 
                    class="toggle-active-btn px-3 py-1 rounded-md ${
                        account.is_active ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }"
                    data-account-id="${account.id}"
                    data-current-status="${account.is_active}"
                >
                    <i class="fas ${account.is_active ? 'fa-ban' : 'fa-check'} mr-1"></i>
                    ${account.is_active ? 'تعطيل' : 'تفعيل'}
                </button>
            </div>
        </div>
    `;
}

/**
 * Initialize enhanced accounts management
 */
export function initEnhancedAccountsManagement(container, db, allAccounts, allProducts, showNotification) {
    let filteredAccounts = [...allAccounts];
    let currentProductFilter = 'all';
    let currentStatusFilter = 'all';
    let searchQuery = '';

    // Render main UI
    function renderUI() {
        container.innerHTML = `
            <div class="mb-6">
                <h2 class="text-3xl font-bold text-gray-800 mb-2">🔐 إدارة الأكونتات المتقدمة</h2>
                <p class="text-gray-600">إدارة شاملة مع تعديل مباشر واستبدال سريع</p>
            </div>

            <!-- Quick Stats -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                    <p class="text-xs opacity-90">إجمالي الأكونتات</p>
                    <p class="text-3xl font-bold">${allAccounts.length}</p>
                </div>
                <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
                    <p class="text-xs opacity-90">متاحة</p>
                    <p class="text-3xl font-bold">${allAccounts.filter(a => a.is_active && a.current_uses < a.allowed_uses).length}</p>
                </div>
                <div class="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-4 text-white">
                    <p class="text-xs opacity-90">قيد الاستخدام</p>
                    <p class="text-3xl font-bold">${allAccounts.filter(a => a.current_uses > 0 && a.current_uses < a.allowed_uses).length}</p>
                </div>
                <div class="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-4 text-white">
                    <p class="text-xs opacity-90">منتهية</p>
                    <p class="text-3xl font-bold">${allAccounts.filter(a => a.current_uses >= a.allowed_uses && a.allowed_uses !== Infinity).length}</p>
                </div>
                <div class="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg p-4 text-white">
                    <p class="text-xs opacity-90">معطلة</p>
                    <p class="text-3xl font-bold">${allAccounts.filter(a => !a.is_active).length}</p>
                </div>
            </div>

            <!-- Filters and Actions -->
            <div class="bg-white rounded-lg shadow-md p-4 mb-6">
                <div class="flex flex-wrap gap-3 mb-4">
                    <!-- Search -->
                    <input 
                        type="text" 
                        id="account-search-input"
                        class="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="🔍 البحث بالإيميل أو المنتج..."
                        value="${searchQuery}"
                    />

                    <!-- Product Filter -->
                    <select 
                        id="account-product-filter"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                    >
                        <option value="all">جميع المنتجات</option>
                        ${allProducts.map(p => `
                            <option value="${p.name}" ${currentProductFilter === p.name ? 'selected' : ''}>
                                ${p.name}
                            </option>
                        `).join('')}
                    </select>

                    <!-- Status Filter -->
                    <select 
                        id="account-status-filter"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="available" ${currentStatusFilter === 'available' ? 'selected' : ''}>متاحة فقط</option>
                        <option value="in_use" ${currentStatusFilter === 'in_use' ? 'selected' : ''}>قيد الاستخدام</option>
                        <option value="expired" ${currentStatusFilter === 'expired' ? 'selected' : ''}>منتهية</option>
                        <option value="blocked" ${currentStatusFilter === 'blocked' ? 'selected' : ''}>معطلة</option>
                    </select>
                </div>

                <div class="flex flex-wrap gap-2">
                    <button 
                        id="export-accounts-btn"
                        class="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all"
                    >
                        <i class="fas fa-file-excel mr-2"></i>تصدير Excel
                    </button>
                    <button 
                        id="export-filtered-accounts-btn"
                        class="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
                    >
                        <i class="fas fa-filter mr-2"></i>تصدير المفلترة
                    </button>
                    <button 
                        id="bulk-replace-expired-btn"
                        class="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all"
                    >
                        <i class="fas fa-sync-alt mr-2"></i>استبدال جماعي للمنتهية
                    </button>
                </div>
            </div>

            <!-- Accounts Grid -->
            <div id="accounts-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${renderAccountsGrid()}
            </div>
        `;

        attachEventListeners();
    }

    // Render accounts grid
    function renderAccountsGrid() {
        if (filteredAccounts.length === 0) {
            return `
                <div class="col-span-full text-center py-10 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>لا توجد أكونتات مطابقة</p>
                </div>
            `;
        }

        return filteredAccounts.map((account, index) => renderAccountCard(account, index)).join('');
    }

    // Apply filters
    function applyFilters() {
        filteredAccounts = allAccounts.filter(account => {
            // Product filter
            if (currentProductFilter !== 'all' && account.productName !== currentProductFilter) {
                return false;
            }

            // Status filter
            if (currentStatusFilter !== 'all') {
                const status = getAccountStatus(account);
                if (currentStatusFilter === 'available' && 
                    !(account.is_active && account.current_uses < account.allowed_uses)) {
                    return false;
                }
                if (currentStatusFilter === 'in_use' && status.id !== 'in_use') {
                    return false;
                }
                if (currentStatusFilter === 'expired' && status.id !== 'expired') {
                    return false;
                }
                if (currentStatusFilter === 'blocked' && status.id !== 'blocked') {
                    return false;
                }
            }

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    (account.email || '').toLowerCase().includes(query) ||
                    (account.productName || '').toLowerCase().includes(query) ||
                    (account.accountId || '').toLowerCase().includes(query)
                );
            }

            return true;
        });

        // Re-render grid
        const grid = document.getElementById('accounts-grid');
        if (grid) {
            grid.innerHTML = renderAccountsGrid();
        }
    }

    // Attach event listeners
    function attachEventListeners() {
        // Search
        const searchInput = document.getElementById('account-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                applyFilters();
            });
        }

        // Product filter
        const productFilter = document.getElementById('account-product-filter');
        if (productFilter) {
            productFilter.addEventListener('change', (e) => {
                currentProductFilter = e.target.value;
                applyFilters();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('account-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                currentStatusFilter = e.target.value;
                applyFilters();
            });
        }

        // Export buttons
        document.getElementById('export-accounts-btn')?.addEventListener('click', () => {
            exportAccountsToExcel(allAccounts, `all_accounts`);
            showNotification('تم تصدير جميع الأكونتات', 'success');
        });

        document.getElementById('export-filtered-accounts-btn')?.addEventListener('click', () => {
            exportAccountsToExcel(filteredAccounts, `filtered_accounts`);
            showNotification(`تم تصدير ${filteredAccounts.length} أكونت`, 'success');
        });

        // Inline editing - email and password
        container.addEventListener('blur', async (e) => {
            if (e.target.classList.contains('account-email-input') || 
                e.target.classList.contains('account-password-input') ||
                e.target.classList.contains('account-notes-input')) {
                
                const accountId = e.target.dataset.accountId;
                const field = e.target.dataset.field;
                const newValue = e.target.value.trim();

                try {
                    await updateDoc(doc(db, 'accounts', accountId), {
                        [field]: newValue,
                        updated_at: serverTimestamp()
                    });
                    showNotification(`تم تحديث ${field === 'email' ? 'الإيميل' : field === 'password' ? 'كلمة المرور' : 'الملاحظات'}`, 'success');
                } catch (error) {
                    console.error('Error updating account:', error);
                    showNotification('فشل التحديث', 'danger');
                }
            }
        }, true);

        // Copy buttons
        container.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.copy-btn');
            if (copyBtn) {
                const textToCopy = copyBtn.dataset.copy;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showNotification('تم النسخ', 'info');
                });
            }
        });

        // Quick replace buttons
        container.addEventListener('click', async (e) => {
            const replaceBtn = e.target.closest('.quick-replace-btn');
            if (replaceBtn) {
                const accountId = replaceBtn.dataset.accountId;
                await quickReplaceAccount(accountId);
            }
        });

        // Toggle active status
        container.addEventListener('click', async (e) => {
            const toggleBtn = e.target.closest('.toggle-active-btn');
            if (toggleBtn) {
                const accountId = toggleBtn.dataset.accountId;
                const currentStatus = toggleBtn.dataset.currentStatus === 'true';
                
                try {
                    await updateDoc(doc(db, 'accounts', accountId), {
                        is_active: !currentStatus,
                        updated_at: serverTimestamp()
                    });
                    showNotification(`تم ${currentStatus ? 'تعطيل' : 'تفعيل'} الحساب`, 'success');
                } catch (error) {
                    showNotification('فشل التحديث', 'danger');
                }
            }
        });

        // Delete account
        container.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-account-btn');
            if (deleteBtn) {
                const accountId = deleteBtn.dataset.accountId;
                if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
                    try {
                        await deleteDoc(doc(db, 'accounts', accountId));
                        showNotification('تم حذف الحساب', 'success');
                    } catch (error) {
                        showNotification('فشل الحذف', 'danger');
                    }
                }
            }
        });
    }

    // Quick replace account
    async function quickReplaceAccount(oldAccountId) {
        const oldAccount = allAccounts.find(a => a.id === oldAccountId);
        if (!oldAccount) return;

        const email = prompt('أدخل الإيميل الجديد:');
        if (!email) return;

        const password = prompt('أدخل كلمة المرور الجديدة:');
        if (!password) return;

        try {
            // Deactivate old account
            await updateDoc(doc(db, 'accounts', oldAccountId), {
                is_active: false,
                notes: (oldAccount.notes || '') + `\n[تم الاستبدال في ${new Date().toLocaleString('ar-EG')}]`,
                updated_at: serverTimestamp()
            });

            // Create new account
            await addDoc(collection(db, 'accounts'), {
                accountId: generateAccountId(),
                productName: oldAccount.productName,
                email,
                password,
                is_active: true,
                current_uses: 0,
                allowed_uses: oldAccount.allowed_uses,
                createdAt: new Date().toISOString(),
                notes: `بديل للحساب: ${oldAccount.accountId || oldAccountId}`,
                replaced_account_id: oldAccountId
            });

            showNotification('تم استبدال الحساب بنجاح', 'success');
        } catch (error) {
            console.error('Error replacing account:', error);
            showNotification('فشل الاستبدال', 'danger');
        }
    }

    // Initial render
    renderUI();

    // Return public API
    return {
        refresh: renderUI,
        applyFilters
    };
}
