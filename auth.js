// auth.js - Authentication and Permission Management Module
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Role definitions
export const ROLES = {
    ADMIN: 'admin',
    TEAM_LEADER: 'team_leader',
    MODERATOR: 'moderator',
    GUEST: 'guest'
};

// Permission definitions
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

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: [
        // Admin has all permissions
        ...Object.values(PERMISSIONS)
    ],
    // Guest mode gets full access in public deployment
    [ROLES.GUEST]: [
        ...Object.values(PERMISSIONS)
    ],
    [ROLES.TEAM_LEADER]: [
        // View permissions
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.VIEW_REPORTS,
        PERMISSIONS.VIEW_SALES,
        PERMISSIONS.VIEW_RENEWALS,
        PERMISSIONS.VIEW_PROBLEMS,
        PERMISSIONS.VIEW_ACCOUNTS,
        PERMISSIONS.VIEW_EXPENSES,
        
        // Action permissions
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
        // View permissions
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.VIEW_SALES,
        PERMISSIONS.VIEW_RENEWALS,
        PERMISSIONS.VIEW_ACCOUNTS,
        
        // Action permissions
        PERMISSIONS.ADD_SALE,
        PERMISSIONS.CONFIRM_SALE,
        PERMISSIONS.MANAGE_RENEWALS
    ]
};

// Current user state
let currentUser = null;
let currentUserData = null;

// Initialize authentication
export async function initAuth(auth, db) {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            try {
                if (!user) {
                    // No user authenticated - redirect to login
                    currentUser = null;
                    currentUserData = null;
                    if (window.location.pathname !== '/login.html') {
                        window.location.href = 'login.html';
                    }
                    reject(new Error('User not authenticated'));
                    return;
                }

                currentUser = user;
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                if (!userDoc.exists()) {
                    // User document doesn't exist - show error and redirect
                    showNoRoleMessage();
                    await signOut(auth);
                    window.location.href = 'login.html';
                    reject(new Error('User document not found'));
                    return;
                }

                currentUserData = userDoc.data();

                // Check if user is inactive
                if (!currentUserData.isActive) {
                    showAccountInactiveMessage();
                    await signOut(auth);
                    window.location.href = 'login.html';
                    reject(new Error('Account inactive'));
                    return;
                }

                // Check if user has a role assigned
                if (!currentUserData.role) {
                    showNoRoleMessage();
                    await signOut(auth);
                    window.location.href = 'login.html';
                    reject(new Error('No role assigned'));
                    return;
                }

                resolve(currentUserData);
            } catch (error) {
                // On any error, reject and redirect to login
                console.error('Authentication error:', error);
                currentUser = null;
                currentUserData = null;
                if (window.location.pathname !== '/login.html') {
                    window.location.href = 'login.html';
                }
                reject(error);
            }
        });
    });
}

// Show account inactive message
function showAccountInactiveMessage() {
    const message = 'حسابك غير مفعل. يرجى التواصل مع المدير لتفعيل حسابك.';
    if (typeof showNotification === 'function') {
        showNotification(message, 'danger');
    } else {
        alert(message);
    }
}

// Show no role assigned message
function showNoRoleMessage() {
    const message = 'لم يتم تعيين صلاحيات لك بعد. يرجى التواصل مع المدير.';
    if (typeof showNotification === 'function') {
        showNotification(message, 'danger');
    } else {
        alert(message);
    }
}

// Check if user has a specific permission
export function hasPermission(permission) {
    if (!currentUserData || !currentUserData.role) {
        return false;
    }

    const userPermissions = ROLE_PERMISSIONS[currentUserData.role] || [];
    return userPermissions.includes(permission);
}

// Check if user has a specific role
export function hasRole(role) {
    return currentUserData && currentUserData.role === role;
}

// Get current user data
export function getCurrentUser() {
    return currentUserData;
}

// Get current user role
export function getCurrentRole() {
    return currentUserData ? currentUserData.role : null;
}

// Get role display name in Arabic
export function getRoleDisplayName(role) {
    const roleNames = {
        [ROLES.ADMIN]: 'مدير',
        [ROLES.TEAM_LEADER]: 'قائد فريق',
        [ROLES.MODERATOR]: 'مشرف'
    };
    return roleNames[role] || 'غير محدد';
}

// Apply UI restrictions based on permissions
export function applyUIRestrictions() {
    if (!currentUserData) return;

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

    // Hide delete buttons if no permission
    if (!hasPermission(PERMISSIONS.DELETE_SALE)) {
        document.body.classList.add('hide-delete-sale-buttons');
    }

    if (!hasPermission(PERMISSIONS.DELETE_ACCOUNT)) {
        document.body.classList.add('hide-delete-account-buttons');
    }

    if (!hasPermission(PERMISSIONS.DELETE_EXPENSE)) {
        document.body.classList.add('hide-delete-expense-buttons');
    }

    // Hide edit buttons based on permissions
    if (!hasPermission(PERMISSIONS.EDIT_SALE)) {
        document.body.classList.add('hide-edit-sale-buttons');
    }

    if (!hasPermission(PERMISSIONS.EDIT_ACCOUNT)) {
        document.body.classList.add('hide-edit-account-buttons');
    }

    if (!hasPermission(PERMISSIONS.EDIT_EXPENSE)) {
        document.body.classList.add('hide-edit-expense-buttons');
    }

    // Hide add buttons based on permissions
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

    // Hide confirm buttons if no permission
    if (!hasPermission(PERMISSIONS.CONFIRM_SALE)) {
        document.body.classList.add('hide-confirm-sale-buttons');
    }

    // Hide renewal management if no permission
    if (!hasPermission(PERMISSIONS.MANAGE_RENEWALS)) {
        document.body.classList.add('hide-renewal-management');
    }

    // Add user info to header
    addUserInfoToHeader();
}

// Add user info and logout button to header
function addUserInfoToHeader() {
    const header = document.querySelector('header .p-4');
    if (!header || !currentUserData) return;

    // Check if user info already exists
    if (document.getElementById('user-info-container')) return;

    const userInfoDiv = document.createElement('div');
    userInfoDiv.id = 'user-info-container';
    userInfoDiv.className = 'flex items-center gap-4 mt-4 sm:mt-0';
    
    const roleColorClass = {
        [ROLES.ADMIN]: 'bg-red-100 text-red-800',
        [ROLES.TEAM_LEADER]: 'bg-blue-100 text-blue-800',
        [ROLES.MODERATOR]: 'bg-green-100 text-green-800'
    }[currentUserData.role] || 'bg-gray-100 text-gray-800';

    userInfoDiv.innerHTML = `
        <div class="text-right hidden sm:block">
            <p class="text-sm font-bold text-gray-800">${currentUserData.name}</p>
            <p class="text-xs text-gray-500">${currentUserData.email}</p>
        </div>
        <span class="px-3 py-1 text-xs font-semibold rounded-full ${roleColorClass}">
            ${getRoleDisplayName(currentUserData.role)}
        </span>
        ${hasPermission(PERMISSIONS.MANAGE_USERS) ? `
        <button id="manage-users-btn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-sm transition-colors">
            <i class="fas fa-users-cog ml-2"></i>إدارة المستخدمين
        </button>` : ''}
        <button id="logout-btn" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md text-sm transition-colors">
            <i class="fas fa-sign-out-alt ml-2"></i>تسجيل الخروج
        </button>
    `;

    header.appendChild(userInfoDiv);
}

// Check if user has access to a specific section
export function checkSectionAccess(sectionName) {
    if (!currentUserData) return false;

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
    if (!requiredPermissions) return true; // Allow access to unknown sections

    return requiredPermissions.some(permission => hasPermission(permission));
}

// Show unauthorized access message
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
    const message = `ليس لديك صلاحية للوصول إلى ${sectionDisplayName}. يرجى التواصل مع المدير.`;
    
    if (typeof showNotification === 'function') {
        showNotification(message, 'danger');
    } else {
        alert(message);
    }
}

// Logout function
export async function logout(auth) {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        await signOut(auth);
        window.location.href = 'login.html';
    }
}
