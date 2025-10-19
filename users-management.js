// users-management.js - User Management Module for Admins
import { getFirestore, collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ROLES, getRoleDisplayName, hasPermission, PERMISSIONS } from './auth.js';

let allUsers = [];

export function initUserManagement(db, showNotification) {
    if (!hasPermission(PERMISSIONS.MANAGE_USERS)) {
        return;
    }

    // Create user management modal
    createUserManagementModal();

    // Listen for user management button clicks
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#manage-users-btn')) {
            openUserManagementModal();
        }
        if (e.target.closest('#close-users-modal')) {
            closeUserManagementModal();
        }
        if (e.target.closest('#users-modal-backdrop')) {
            closeUserManagementModal();
        }
    });

    // Listen to users collection
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    onSnapshot(usersQuery, (snapshot) => {
        allUsers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderUsersTable();
    });

    // Handle user actions (edit role, activate/deactivate, delete)
    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-user-action]');
        if (!target) return;

        const action = target.dataset.userAction;
        const userId = target.dataset.userId;
        const user = allUsers.find(u => u.id === userId);

        if (!user) return;

        try {
            switch (action) {
                case 'toggle-active':
                    await updateDoc(doc(db, 'users', userId), {
                        isActive: !user.isActive
                    });
                    showNotification(
                        user.isActive ? 'تم إلغاء تفعيل المستخدم' : 'تم تفعيل المستخدم',
                        'info'
                    );
                    break;

                case 'delete':
                    if (confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟`)) {
                        await deleteDoc(doc(db, 'users', userId));
                        showNotification('تم حذف المستخدم', 'danger');
                    }
                    break;

                case 'change-role':
                    const newRole = target.dataset.newRole;
                    if (newRole && confirm(`هل أنت متأكد من تغيير صلاحية "${user.name}" إلى "${getRoleDisplayName(newRole)}"؟`)) {
                        await updateDoc(doc(db, 'users', userId), {
                            role: newRole,
                            isActive: true // Activate when assigning role
                        });
                        showNotification('تم تحديث الصلاحية بنجاح', 'success');
                    }
                    break;
            }
        } catch (error) {
            console.error('Error managing user:', error);
            showNotification('حدث خطأ في العملية', 'danger');
        }
    });
}

function createUserManagementModal() {
    if (document.getElementById('users-modal')) return;

    const modalHTML = `
        <div id="users-modal-backdrop" class="hidden fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40"></div>
        <div id="users-modal" class="hidden fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-2xl w-[95%] max-w-6xl max-h-[90vh] overflow-hidden">
            <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold"><i class="fas fa-users-cog ml-2"></i>إدارة المستخدمين</h2>
                        <p class="text-indigo-100 text-sm mt-1">إدارة الصلاحيات والمستخدمين في النظام</p>
                    </div>
                    <button id="close-users-modal" class="text-white hover:text-gray-200 text-2xl font-bold">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 100px);">
                <div class="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <h3 class="font-bold text-blue-900 mb-2"><i class="fas fa-info-circle ml-2"></i>معلومات الصلاحيات:</h3>
                    <ul class="text-sm text-blue-800 space-y-1">
                        <li><strong>مدير:</strong> صلاحيات كاملة لإدارة النظام والمستخدمين</li>
                        <li><strong>قائد فريق:</strong> إدارة الفريق والمهام ومراقبة الأداء (لا يمكنه حذف البيانات الحساسة)</li>
                        <li><strong>مشرف:</strong> إدارة العمليات اليومية والتفاعل مع العملاء فقط</li>
                    </ul>
                </div>
                
                <div id="users-table-container"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openUserManagementModal() {
    document.getElementById('users-modal-backdrop').classList.remove('hidden');
    document.getElementById('users-modal').classList.remove('hidden');
    renderUsersTable();
}

function closeUserManagementModal() {
    document.getElementById('users-modal-backdrop').classList.add('hidden');
    document.getElementById('users-modal').classList.add('hidden');
}

function renderUsersTable() {
    const container = document.getElementById('users-table-container');
    if (!container) return;

    if (allUsers.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 text-gray-500">
                <i class="fas fa-users text-4xl mb-4"></i>
                <p>لا يوجد مستخدمون بعد</p>
            </div>
        `;
        return;
    }

    const currentAuth = getAuth();
    const currentUserId = currentAuth.currentUser?.uid;

    const usersHTML = allUsers.map(user => {
        const isCurrentUser = user.id === currentUserId;
        const roleColorClass = {
            [ROLES.ADMIN]: 'bg-red-100 text-red-800',
            [ROLES.TEAM_LEADER]: 'bg-blue-100 text-blue-800',
            [ROLES.MODERATOR]: 'bg-green-100 text-green-800'
        }[user.role] || 'bg-gray-100 text-gray-800';

        const statusBadge = user.isActive
            ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"><i class="fas fa-check-circle ml-1"></i>نشط</span>'
            : '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800"><i class="fas fa-times-circle ml-1"></i>معطل</span>';

        const roleDropdown = isCurrentUser ? `
            <span class="px-3 py-1 text-sm font-semibold rounded-full ${roleColorClass}">
                ${getRoleDisplayName(user.role)} (أنت)
            </span>
        ` : `
            <div class="relative inline-block">
                <select 
                    data-user-action="change-role" 
                    data-user-id="${user.id}"
                    class="appearance-none px-3 py-1 pr-8 text-sm font-semibold rounded-full ${roleColorClass} cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <option value="${user.role}" selected>${getRoleDisplayName(user.role)}</option>
                    ${user.role !== ROLES.ADMIN ? `<option value="${ROLES.ADMIN}">${getRoleDisplayName(ROLES.ADMIN)}</option>` : ''}
                    ${user.role !== ROLES.TEAM_LEADER ? `<option value="${ROLES.TEAM_LEADER}">${getRoleDisplayName(ROLES.TEAM_LEADER)}</option>` : ''}
                    ${user.role !== ROLES.MODERATOR ? `<option value="${ROLES.MODERATOR}">${getRoleDisplayName(ROLES.MODERATOR)}</option>` : ''}
                </select>
                <i class="fas fa-chevron-down absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"></i>
            </div>
        `;

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${isCurrentUser ? 'border-indigo-500 border-2' : ''}">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-800">${user.name} ${isCurrentUser ? '<span class="text-xs text-indigo-600">(أنت)</span>' : ''}</h3>
                            <p class="text-sm text-gray-500">${user.email}</p>
                            <p class="text-xs text-gray-400 mt-1">
                                <i class="fas fa-calendar-alt ml-1"></i>
                                انضم: ${new Date(user.createdAt).toLocaleDateString('ar-EG')}
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3 flex-wrap">
                        ${statusBadge}
                        ${roleDropdown}
                        
                        ${!isCurrentUser ? `
                            <button 
                                data-user-action="toggle-active" 
                                data-user-id="${user.id}"
                                class="px-3 py-1 text-sm font-semibold rounded-md ${user.isActive ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-green-100 text-green-800 hover:bg-green-200'} transition-colors"
                                title="${user.isActive ? 'إلغاء التفعيل' : 'تفعيل'}"
                            >
                                <i class="fas ${user.isActive ? 'fa-ban' : 'fa-check'} ml-1"></i>
                                ${user.isActive ? 'إلغاء التفعيل' : 'تفعيل'}
                            </button>
                            
                            <button 
                                data-user-action="delete" 
                                data-user-id="${user.id}"
                                class="px-3 py-1 text-sm font-semibold rounded-md bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                                title="حذف المستخدم"
                            >
                                <i class="fas fa-trash ml-1"></i>حذف
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="space-y-3">
            ${usersHTML}
        </div>
    `;

    // Add change event listeners to role dropdowns
    container.querySelectorAll('select[data-user-action="change-role"]').forEach(select => {
        select.addEventListener('change', (e) => {
            const userId = e.target.dataset.userId;
            const newRole = e.target.value;
            const user = allUsers.find(u => u.id === userId);
            
            // Create a temporary button to trigger the action
            const btn = document.createElement('button');
            btn.dataset.userAction = 'change-role';
            btn.dataset.userId = userId;
            btn.dataset.newRole = newRole;
            btn.click();
            
            // Reset select to current role if action is cancelled
            setTimeout(() => {
                const updatedUser = allUsers.find(u => u.id === userId);
                if (updatedUser) {
                    e.target.value = updatedUser.role;
                }
            }, 100);
        });
    });
}
