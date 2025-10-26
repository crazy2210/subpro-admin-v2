// auth.js - Link-based Access Management (no Firebase Auth)

// Link roles
export const ROLES = {
    OWNER: 'owner',
    TEAM_LEADER: 'team_leader',
    MODERATOR: 'moderator',
    VIEWER: 'viewer'
};

// Permission definitions (unchanged)
export const PERMISSIONS = {
    // View permissions
    VIEW_DASHBOARD: 'view_dashboard',
    VIEW_REPORTS: 'view_reports',
    VIEW_SALES: 'view_sales',
    VIEW_RENEWALS: 'view_renewals',
    VIEW_PROBLEMS: 'view_problems',
    VIEW_ACCOUNTS: 'view_accounts',
    VIEW_EXPENSES: 'view_expenses',
    VIEW_USERS: 'view_users',
    
    // Action permissions
    ADD_SALE: 'add_sale',
    EDIT_SALE: 'edit_sale',
    DELETE_SALE: 'delete_sale',
    CONFIRM_SALE: 'confirm_sale',
    EXPORT_DATA: 'export_data',
    
    ADD_ACCOUNT: 'add_account',
    EDIT_ACCOUNT: 'edit_account',
    DELETE_ACCOUNT: 'delete_account',
    
    ADD_EXPENSE: 'add_expense',
    EDIT_EXPENSE: 'edit_expense',
    DELETE_EXPENSE: 'delete_expense',
    
    ADD_PRODUCT: 'add_product',
    DELETE_PRODUCT: 'delete_product',
    
    ADD_PROBLEM: 'add_problem',
    
    MANAGE_USERS: 'manage_users',
    MANAGE_RENEWALS: 'manage_renewals'
};

// Role-based permissions mapping for link roles
const ROLE_PERMISSIONS = {
    [ROLES.OWNER]: [
        ...Object.values(PERMISSIONS)
    ],
    [ROLES.TEAM_LEADER]: [
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_SALES,
        PERMISSIONS.VIEW_RENEWALS,
        PERMISSIONS.VIEW_PROBLEMS,
        PERMISSIONS.VIEW_ACCOUNTS,
        PERMISSIONS.VIEW_EXPENSES,
        PERMISSIONS.ADD_SALE,
        PERMISSIONS.EDIT_SALE,
        PERMISSIONS.CONFIRM_SALE,
        PERMISSIONS.EXPORT_DATA,
        PERMISSIONS.ADD_ACCOUNT,
        PERMISSIONS.EDIT_ACCOUNT,
        PERMISSIONS.ADD_EXPENSE,
        PERMISSIONS.EDIT_EXPENSE,
        PERMISSIONS.ADD_PRODUCT,
        PERMISSIONS.ADD_PROBLEM,
        PERMISSIONS.MANAGE_RENEWALS
    ],
    [ROLES.MODERATOR]: [
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.VIEW_SALES,
        PERMISSIONS.VIEW_RENEWALS,
        PERMISSIONS.VIEW_ACCOUNTS,
        PERMISSIONS.ADD_SALE,
        PERMISSIONS.CONFIRM_SALE,
        PERMISSIONS.MANAGE_RENEWALS
    ],
    [ROLES.VIEWER]: [
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_SALES,
        PERMISSIONS.VIEW_RENEWALS,
        PERMISSIONS.VIEW_PROBLEMS,
        PERMISSIONS.VIEW_ACCOUNTS,
        PERMISSIONS.VIEW_EXPENSES
    ]
};

let currentAccessRole = null;

function parseAccessRoleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const access = (params.get('access') || '').toLowerCase().trim();
    if (!access) return ROLES.VIEWER; // default open as viewer
    if (['owner', 'admin', 'boss'].includes(access)) return ROLES.OWNER;
    if (['team_leader', 'team', 'lead', 'tl'].includes(access)) return ROLES.TEAM_LEADER;
    if (['moderator', 'mod'].includes(access)) return ROLES.MODERATOR;
    if (['viewer', 'view', 'read'].includes(access)) return ROLES.VIEWER;
    return ROLES.VIEWER;
}

// Initialize link-based access (no redirects)
export async function initAccess() {
    currentAccessRole = parseAccessRoleFromUrl();
    // Update header badge
    addAccessInfoToHeader();
    return currentAccessRole;
}

// Permission checks
export function hasPermission(permission) {
    const permissions = ROLE_PERMISSIONS[currentAccessRole] || [];
    return permissions.includes(permission);
}

export function hasRole(role) {
    return currentAccessRole === role;
}

export function getCurrentRole() {
    return currentAccessRole;
}

export function getRoleDisplayName(role) {
    const roleNames = {
        [ROLES.OWNER]: 'صاحب الشغل',
        [ROLES.TEAM_LEADER]: 'قائد فريق',
        [ROLES.MODERATOR]: 'مشرف',
        [ROLES.VIEWER]: 'عرض فقط'
    };
    return roleNames[role] || 'غير محدد';
}

// Apply UI restrictions based on link role
export function applyUIRestrictions() {
    // Hide tabs based on permissions
    if (!hasPermission(PERMISSIONS.VIEW_REPORTS)) {
        const reportsTab = document.querySelector('[data-tab="reports"]');
        if (reportsTab) reportsTab.style.display = 'none';
    }
    if (!hasPermission(PERMISSIONS.VIEW_EXPENSES)) {
        const expensesTab = document.querySelector('[data-tab="expenses"]');
        if (expensesTab) expensesTab.style.display = 'none';
    }
    if (!hasPermission(PERMISSIONS.VIEW_PROBLEMS)) {
        const problemsTab = document.querySelector('[data-tab="problems"]');
        if (problemsTab) problemsTab.style.display = 'none';
    }
    if (!hasPermission(PERMISSIONS.VIEW_ACCOUNTS)) {
        const accountsTab = document.querySelector('[data-tab="accounts"]');
        if (accountsTab) accountsTab.style.display = 'none';
    }

    // Hide export button if no permission
    if (!hasPermission(PERMISSIONS.EXPORT_DATA)) {
        const exportBtn = document.getElementById('export-sales-btn');
        if (exportBtn) exportBtn.style.display = 'none';
    }

    // Hide destructive or restricted actions through CSS flags
    if (!hasPermission(PERMISSIONS.DELETE_SALE)) document.body.classList.add('hide-delete-sale-buttons');
    if (!hasPermission(PERMISSIONS.DELETE_ACCOUNT)) document.body.classList.add('hide-delete-account-buttons');
    if (!hasPermission(PERMISSIONS.DELETE_EXPENSE)) document.body.classList.add('hide-delete-expense-buttons');
    if (!hasPermission(PERMISSIONS.EDIT_SALE)) document.body.classList.add('hide-edit-sale-buttons');
    if (!hasPermission(PERMISSIONS.EDIT_ACCOUNT)) document.body.classList.add('hide-edit-account-buttons');
    if (!hasPermission(PERMISSIONS.EDIT_EXPENSE)) document.body.classList.add('hide-edit-expense-buttons');
    if (!hasPermission(PERMISSIONS.CONFIRM_SALE)) document.body.classList.add('hide-confirm-sale-buttons');
    if (!hasPermission(PERMISSIONS.MANAGE_RENEWALS)) document.body.classList.add('hide-renewal-management');

    // Hide add buttons if not allowed
    if (!hasPermission(PERMISSIONS.ADD_ACCOUNT)) {
        const addAccountBtn = document.getElementById('toggle-add-account-form');
        if (addAccountBtn) addAccountBtn.style.display = 'none';
    }
    if (!hasPermission(PERMISSIONS.ADD_EXPENSE)) {
        const addExpenseBtn = document.getElementById('toggle-add-expense-form');
        if (addExpenseBtn) addExpenseBtn.style.display = 'none';
    }
    if (!hasPermission(PERMISSIONS.ADD_PROBLEM)) {
        const addProblemBtn = document.getElementById('toggle-add-problem-form');
        if (addProblemBtn) addProblemBtn.style.display = 'none';
    }
    if (!hasPermission(PERMISSIONS.ADD_PRODUCT)) {
        const addProductForm = document.getElementById('add-product-form');
        if (addProductForm) addProductForm.style.display = 'none';
    }
    if (!hasPermission(PERMISSIONS.ADD_SALE)) {
        const addSaleBtn = document.getElementById('toggle-add-sale-form');
        if (addSaleBtn) addSaleBtn.style.display = 'none';
    }
}

// Add simple role badge to header
function addAccessInfoToHeader() {
    const header = document.querySelector('header .p-4');
    if (!header) return;
    if (document.getElementById('access-info-container')) return;

    const roleColorClass = {
        [ROLES.OWNER]: 'bg-red-100 text-red-800',
        [ROLES.TEAM_LEADER]: 'bg-blue-100 text-blue-800',
        [ROLES.MODERATOR]: 'bg-green-100 text-green-800',
        [ROLES.VIEWER]: 'bg-gray-100 text-gray-800'
    }[currentAccessRole] || 'bg-gray-100 text-gray-800';

    const div = document.createElement('div');
    div.id = 'access-info-container';
    div.className = 'flex items-center gap-3 mt-4 sm:mt-0';
    const currentUrl = new URL(window.location.href);
    div.innerHTML = `
        <span class="px-3 py-1 text-xs font-semibold rounded-full ${roleColorClass}">
            ${getRoleDisplayName(currentAccessRole)}
        </span>
        ${hasPermission(PERMISSIONS.MANAGE_USERS) ? `
        <button id="manage-users-btn" class="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-md text-xs transition-colors">
            إدارة المستخدمين
        </button>
        ` : ''}
        <button id="copy-link-btn" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-xs transition-colors">
            نسخ الرابط الحالي
        </button>
    `;
    header.appendChild(div);
    document.getElementById('copy-link-btn')?.addEventListener('click', () => {
        try {
            navigator.clipboard.writeText(currentUrl.toString());
            if (typeof showNotification === 'function') showNotification('تم نسخ الرابط', 'info');
        } catch (e) {
            alert('تعذر نسخ الرابط');
        }
    });
}

// Section access helpers (unchanged signature)
export function checkSectionAccess(sectionName) {
    const sectionPermissions = {
        'dashboard': [PERMISSIONS.VIEW_DASHBOARD],
        'reports': [PERMISSIONS.VIEW_REPORTS],
        'sales': [PERMISSIONS.VIEW_SALES],
        'renewals': [PERMISSIONS.MANAGE_RENEWALS],
        'problems': [PERMISSIONS.VIEW_PROBLEMS],
        'accounts': [PERMISSIONS.VIEW_ACCOUNTS],
        'expenses': [PERMISSIONS.VIEW_EXPENSES]
    };
    const requiredPermissions = sectionPermissions[sectionName];
    if (!requiredPermissions) return true;
    return requiredPermissions.some(p => hasPermission(p));
}

export function showUnauthorizedAccessMessage(sectionName) {
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
    const message = `ليس لديك صلاحية للوصول إلى ${sectionDisplayName}.`;
    if (typeof showNotification === 'function') showNotification(message, 'danger');
    else alert(message);
}
