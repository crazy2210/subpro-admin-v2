# Quick Setup Guide - RBAC System for SubPro Dashboard

## 🚀 Quick Start (5 Minutes)

### Step 1: Enable Firebase Authentication
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `subpro-v2`
3. Navigate to **Authentication** → **Sign-in method**
4. Enable **Email/Password** provider
5. Click **Save**

### Step 2: Update Firestore Security Rules
1. In Firebase Console, go to **Firestore Database** → **Rules**
2. Replace with the following rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - only authenticated users can read their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // All other collections - authenticated users with active status
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isActive == true;
    }
  }
}
```

3. Click **Publish**

### Step 3: Create Your First Admin User

#### Option A: Sign up through the app
1. Open `login.html` in your browser
2. Click "إنشاء حساب جديد" (Create New Account)
3. Fill in your details and create account
4. **Go to Firebase Console → Firestore Database → users collection**
5. Find your user document and manually set:
   ```
   role: "admin"
   isActive: true
   ```
6. Refresh the page and log in

#### Option B: Create directly in Firestore
1. Go to Firestore Database → users collection
2. Click "Add document"
3. Set Document ID to your Firebase Auth UID
4. Add fields:
   ```
   uid: "your-firebase-auth-uid"
   name: "Your Name"
   email: "your@email.com"
   role: "admin"
   isActive: true
   createdAt: (current timestamp)
   ```

### Step 4: Start Using the System
1. Open `login.html` and log in with your admin credentials
2. You should see the "إدارة المستخدمين" (Manage Users) button
3. Create and manage team members from there!

## 📋 Role Permissions Summary

### 🔴 Admin (مدير)
- **Everything**: Full access to all features

### 🔵 Team Leader (قائد فريق)
- Can view all data and reports
- Can add/edit sales, expenses, accounts
- Cannot delete sales or expenses
- Cannot manage users

### 🟢 Moderator (مشرف)
- Can view sales, accounts, renewals
- Can add new sales and confirm orders
- Cannot access expenses or reports
- Cannot edit/delete data
- Cannot export data

## 📁 New Files Created

1. **login.html** - Login and signup page
2. **auth.js** - Authentication and permissions module
3. **users-management.js** - User management interface
4. **RBAC_DOCUMENTATION.md** - Full Arabic documentation
5. **QUICK_SETUP_GUIDE.md** - This file

## 🔧 Modified Files

- **app.js** - Integrated authentication and permission checks
- **styles.css** - Added role-based UI hiding styles
- **index.html** - No changes needed!

## ✅ Testing Checklist

- [ ] Can create new account
- [ ] First admin user created and role assigned in Firestore
- [ ] Can log in with admin account
- [ ] "Manage Users" button appears for admin
- [ ] Can assign roles to other users
- [ ] Team Leader role restrictions work correctly
- [ ] Moderator role restrictions work correctly
- [ ] Logout functionality works
- [ ] Unauthorized users redirected to login

## 🐛 Troubleshooting

**Can't log in?**
- Check Firebase Authentication is enabled
- Verify email/password are correct
- Ensure user has `isActive: true` in Firestore

**"Not authorized" message?**
- Check user has a role assigned (`role` field in Firestore)
- Verify `isActive: true`
- Refresh the page after making changes in Firestore

**Buttons not hiding?**
- Clear browser cache
- Check browser console for errors
- Verify user role is correctly set

## 📞 Need Help?

Check the detailed Arabic documentation in `RBAC_DOCUMENTATION.md`

---

## 🎉 That's it! Your role-based system is ready to use!
