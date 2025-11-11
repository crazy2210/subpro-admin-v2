# 🧪 SubPro Dashboard Testing Checklist

Use this checklist to verify all functionality is working correctly.

---

## ✅ Pre-Testing Setup

- [ ] Open the dashboard in a modern browser (Chrome, Firefox, Edge)
- [ ] Ensure internet connection is stable
- [ ] Open browser console (F12) to check for errors
- [ ] Clear browser cache if needed
- [ ] Have test data ready (products, accounts, etc.)

---

## 1️⃣ الرئيسية (Home Dashboard)

### Display Tests
- [ ] Dashboard loads without errors
- [ ] All stat cards are visible
- [ ] Numbers are calculated correctly
- [ ] Gradient colors display properly
- [ ] Cards have hover effects

### Functionality Tests
- [ ] Date range filter works
- [ ] Clear filter button works
- [ ] Statistics update when filter is applied
- [ ] Real-time updates work (add a sale and see if dashboard updates)
- [ ] Monthly growth rate displays with correct icon (up/down)

---

## 2️⃣ سجل المبيعات (Orders Log)

### Create (Add Order)
- [ ] "إضافة أوردر" button opens form
- [ ] Form shows all required fields
- [ ] Product dropdown populates correctly
- [ ] Available accounts dropdown populates
- [ ] Manual sale checkbox toggles fields correctly
- [ ] Form validation works (try submitting empty form)
- [ ] Order is added to Firestore
- [ ] Success notification appears
- [ ] Form resets after submission
- [ ] New order appears in table immediately

### Read (View Orders)
- [ ] All orders display in table
- [ ] Order details are correct
- [ ] Date format is correct (Arabic)
- [ ] Confirmed/unconfirmed badge shows correctly
- [ ] Profit calculation is accurate
- [ ] Copy-to-clipboard works for contact info

### Update (Edit Order)
- [ ] Edit button opens modal
- [ ] Modal populates with current data
- [ ] Changes save correctly
- [ ] Success notification appears
- [ ] Table updates immediately

### Delete (Remove Order)
- [ ] Delete button shows confirmation
- [ ] Order is deleted from Firestore
- [ ] Order removes from table immediately
- [ ] Success notification appears

### Filtering
- [ ] Product filter buttons work
- [ ] Status filter (confirmed/unconfirmed) works
- [ ] Date range filter works
- [ ] Search box filters results
- [ ] Multiple filters work together

### Other Features
- [ ] Confirm button marks order as confirmed
- [ ] Confirm button disappears after confirming
- [ ] Export to Excel works
- [ ] Exported file contains correct data
- [ ] Account inventory decrements when order is added

---

## 3️⃣ إحصائيات المنتجات (Product Statistics)

### Display Tests
- [ ] Product statistics section loads
- [ ] Each product has its own card
- [ ] All stat mini-cards display correctly
- [ ] Icons show properly

### Data Accuracy
- [ ] Total sales count is correct
- [ ] Total revenue matches sum of all sales
- [ ] Total profit = revenue - cost
- [ ] Current month sales count is accurate
- [ ] Growth rate calculation is correct (current vs previous month)
- [ ] Growth indicator (up/down arrow) shows correctly
- [ ] Renewal count is accurate

### Real-time Updates
- [ ] Adding a sale updates product statistics immediately
- [ ] Statistics recalculate correctly

---

## 4️⃣ التجديدات (Renewals)

### Display Tests
- [ ] Renewals section loads
- [ ] Badge counter shows in navigation tab
- [ ] Only relevant subscriptions show (< 7 days remaining)
- [ ] Lifetime subscriptions don't appear
- [ ] Already renewed subscriptions don't appear

### Data Accuracy
- [ ] Days remaining is calculated correctly
- [ ] Expiry date calculation is accurate:
  - [ ] 1 Month = +30 days
  - [ ] 3 Months = +90 days
  - [ ] 6 Months = +180 days
  - [ ] 1 Year = +365 days
- [ ] Color coding works (red for expired, yellow for urgent)

### Functionality
- [ ] "تم التنبيه" button updates status
- [ ] "جدد" button marks as renewed
- [ ] "لم يجدد" button marks as not renewed
- [ ] Subscription disappears after status change
- [ ] Badge counter updates correctly
- [ ] Customer info copy works

---

## 5️⃣ إدارة الأكونتات (Accounts Management)

### Create (Add Account)
- [ ] "إضافة أكونت" button opens form
- [ ] Single account can be added
- [ ] Bulk add (multiple emails/passwords) works
- [ ] Product selection required
- [ ] Validation works
- [ ] Account added to Firestore
- [ ] Success notification appears
- [ ] Account appears in table immediately

### Read (View Accounts)
- [ ] All accounts display in table
- [ ] Email and password show correctly
- [ ] Usage bar displays correctly
- [ ] Status badges show accurately:
  - [ ] Available (green)
  - [ ] In Use (blue)
  - [ ] Near Full (orange, >80%)
  - [ ] Completed (red, 100%)
  - [ ] Inactive (gray)
- [ ] Purchase price displays
- [ ] Trader name shows

### Update (Edit Account)
- [ ] Edit button opens modal
- [ ] All fields populate correctly
- [ ] Changes save to Firestore
- [ ] Table updates immediately
- [ ] Usage tracking updates

### Delete (Remove Account)
- [ ] Delete button shows confirmation
- [ ] Cannot delete if linked to order
- [ ] Account deletes if not linked
- [ ] Success notification appears

### Filtering
- [ ] Product filter works
- [ ] Status filter works (available/unavailable/inactive/completed)
- [ ] Search box works (by email or trader)
- [ ] Multiple filters work together

### Other Features
- [ ] Export accounts to Excel works
- [ ] Exported file has correct data
- [ ] "كشف المشاكل" button works
- [ ] Duplicate detection works
- [ ] Inactive account detection works

---

## 6️⃣ المصروفات (Expenses)

### Create (Add Expense)
- [ ] "إضافة مصروف" button opens form
- [ ] All expense types available
- [ ] Category field works
- [ ] Amount validation works
- [ ] Custom date picker works
- [ ] Expense added to Firestore
- [ ] Success notification appears
- [ ] Expense appears in table

### Read (View Expenses)
- [ ] All expenses display in table
- [ ] Date format is correct
- [ ] Type badges show with correct colors:
  - [ ] إعلان (red)
  - [ ] اشتراكات تطبيقات (blue)
  - [ ] مصاريف أخرى (yellow)
- [ ] Amount displays correctly
- [ ] Description shows

### Update (Edit Expense)
- [ ] Edit button opens modal
- [ ] Fields populate correctly
- [ ] Changes save
- [ ] Table updates

### Delete (Remove Expense)
- [ ] Delete button shows confirmation
- [ ] Expense deletes
- [ ] Success notification appears

### Filtering
- [ ] Type filter works
- [ ] Date range filter works
- [ ] Both filters work together

### Other Features
- [ ] Total calculation at footer is correct
- [ ] Total updates when filters change
- [ ] Export functionality works

---

## 7️⃣ إدارة الإعلانات (Ads Management)

### Create (Add Campaign)
- [ ] "إضافة حملة إعلانية" button opens form
- [ ] Product dropdown populates
- [ ] Platform selection works (Facebook, Instagram, etc.)
- [ ] Amount field validates
- [ ] Start date picker works
- [ ] End date picker works (optional)
- [ ] Status selection works
- [ ] Campaign added to Firestore
- [ ] Success notification appears
- [ ] Campaign appears in table

### Read (View Campaigns)
- [ ] Summary cards display correctly:
  - [ ] Total ad spend
  - [ ] Active campaigns count
  - [ ] Overall ROAS
  - [ ] Net profit
- [ ] All campaigns display in table
- [ ] Platform badges show with correct colors
- [ ] Start and end dates display correctly
- [ ] Status badges show correctly
- [ ] ROAS calculates correctly per campaign
- [ ] ROAS color codes correctly:
  - [ ] Green (≥2x)
  - [ ] Blue (≥1x)
  - [ ] Red (<1x)

### Delete (Remove Campaign)
- [ ] Delete button shows confirmation
- [ ] Campaign deletes
- [ ] Success notification appears

### Filtering
- [ ] Product filter buttons work
- [ ] Filtered data updates summary cards
- [ ] Table updates with filter

### Charts
- [ ] "إنفاق الإعلانات حسب المنصة" chart displays
- [ ] Chart shows correct data
- [ ] "العائد على الإعلانات" chart displays
- [ ] ROAS chart shows correct values

---

## 8️⃣ المشاكل (Issues)

### Create (Report Problem)
- [ ] "الإبلاغ عن مشكلة" button opens form
- [ ] Order dropdown populates with confirmed orders
- [ ] Replacement account dropdown populates
- [ ] Description field accepts text
- [ ] Problem added to Firestore
- [ ] Success notification appears
- [ ] Problem appears in list

### Read (View Problems)
- [ ] All problems display as cards
- [ ] Original order info shows
- [ ] Original account details show
- [ ] Replacement account details show
- [ ] Description displays
- [ ] Date and time show correctly

---

## 9️⃣ إحصائيات الشيفتات (Shift Reports)

### Display Tests
- [ ] Shift statistics section loads (in Reports tab)
- [ ] Date picker shows today by default
- [ ] Three shift cards display:
  - [ ] Night (12ص - 8ص)
  - [ ] Morning (8ص - 4م)
  - [ ] Evening (4م - 12ص)

### Data Accuracy
- [ ] Daily summary shows correct totals
- [ ] Each shift shows correct order count
- [ ] Revenue calculation is accurate
- [ ] Profit calculation is accurate
- [ ] Percentage of day is calculated correctly
- [ ] Average profit per order is correct
- [ ] Orders are assigned to correct shift based on time

### Functionality
- [ ] Date picker changes shift data
- [ ] Historical data loads correctly
- [ ] Order list shows for each shift
- [ ] Order details are accurate

### Export
- [ ] Export shift report button works
- [ ] Excel file downloads
- [ ] File contains:
  - [ ] Shift summary
  - [ ] Order details
  - [ ] Accounts used
- [ ] Export daily summary works
- [ ] Daily summary includes all three shifts

---

## 🔟 التقارير (Reports)

### Charts Display
- [ ] "الأداء المالي الشهري" chart displays
- [ ] Chart shows revenue, cost, profit lines
- [ ] Data is accurate
- [ ] "المنتجات الأكثر ربحية" chart displays
- [ ] Product profit bars are correct
- [ ] "توزيع المصروفات" pie chart displays
- [ ] Expense categories are correct
- [ ] "تحليل المبيعات حسب المصدر" chart displays
- [ ] Contact methods (WhatsApp, Facebook, etc.) are shown
- [ ] "تحليل تكلفة التجار" chart displays
- [ ] Trader costs are accurate

### Export Functions
- [ ] "نسخة احتياطية شاملة" button works
- [ ] Backup includes all data sheets:
  - [ ] Sales
  - [ ] Accounts
  - [ ] Expenses
  - [ ] Products
- [ ] Individual shift export buttons work
- [ ] Shift reports contain correct data

---

## 🔐 Security & Permissions

### Authentication
- [ ] Login page redirects if not authenticated
- [ ] User info displays in header
- [ ] Role badge shows correctly
- [ ] Logout button works
- [ ] Redirects to login after logout

### Permissions (Test with different roles)
- [ ] Admin sees all features
- [ ] Team Leader has appropriate access
- [ ] Moderator has limited access
- [ ] Guest can view but not edit
- [ ] Unauthorized actions show error message
- [ ] Buttons hide based on permissions

---

## 🌐 General UI/UX Tests

### Navigation
- [ ] All tabs are visible
- [ ] Clicking tabs switches sections correctly
- [ ] Active tab is highlighted
- [ ] Badge counter shows on renewals tab

### Responsiveness
- [ ] Dashboard works on desktop (>1024px)
- [ ] Dashboard works on tablet (768-1024px)
- [ ] Dashboard works on mobile (<768px)
- [ ] Tables become card view on mobile
- [ ] Forms are usable on mobile

### Performance
- [ ] Page loads within 3 seconds
- [ ] No console errors
- [ ] Real-time updates are fast
- [ ] Filters apply quickly
- [ ] Charts render smoothly

### Visual Design
- [ ] Colors match design (gradients, badges, etc.)
- [ ] Arabic text displays correctly (RTL)
- [ ] Icons show properly
- [ ] Hover effects work
- [ ] Animations are smooth
- [ ] Dark mode toggle works (if available)

### Notifications
- [ ] Success notifications appear (green)
- [ ] Error notifications appear (red)
- [ ] Info notifications appear (blue)
- [ ] Notifications auto-dismiss after 3 seconds
- [ ] Notification messages are clear

---

## 🔄 Real-Time Synchronization Tests

### Multi-User Test (if possible)
- [ ] Open dashboard in two browsers
- [ ] Add order in browser 1
- [ ] Order appears in browser 2 without refresh
- [ ] Edit in browser 1, updates in browser 2
- [ ] Delete in browser 1, removes in browser 2

### Offline Test
- [ ] Disconnect internet
- [ ] Connection status indicator shows offline
- [ ] Cached data still visible
- [ ] Reconnect internet
- [ ] Data syncs automatically
- [ ] Connection status shows online

---

## 📤 Export Functionality Tests

### Excel Exports
- [ ] All export buttons work
- [ ] Files download successfully
- [ ] File names are descriptive with dates
- [ ] Data in files is complete and accurate
- [ ] Arabic text renders correctly in Excel
- [ ] Multiple sheets work (where applicable)
- [ ] Headers and footers are formatted

---

## 🐛 Error Handling Tests

### Form Validation
- [ ] Empty required fields show error
- [ ] Invalid email format rejected
- [ ] Negative numbers rejected for prices
- [ ] Invalid dates rejected

### Network Errors
- [ ] Graceful handling of connection loss
- [ ] Error messages are user-friendly
- [ ] Retry mechanisms work

### Data Errors
- [ ] Missing data handled gracefully
- [ ] Invalid data doesn't crash app
- [ ] Empty states display correctly

---

## ✅ Final Checks

### Functionality
- [ ] All CRUD operations work
- [ ] All filters work
- [ ] All exports work
- [ ] All charts render
- [ ] All real-time updates work

### Data Integrity
- [ ] Account usage increments correctly
- [ ] Calculations are accurate
- [ ] Dates are handled correctly
- [ ] No data loss on operations

### User Experience
- [ ] Interface is intuitive
- [ ] Loading states show appropriately
- [ ] Error messages are helpful
- [ ] Success feedback is clear
- [ ] Navigation is smooth

---

## 📝 Bug Reporting Template

If you find any issues, report them using this format:

```
**Section:** [Section Name]
**Issue:** [Brief description]
**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:** [What should happen]
**Actual Behavior:** [What actually happens]
**Console Errors:** [Any errors in browser console]
**Browser:** [Chrome/Firefox/Safari/Edge + version]
**Device:** [Desktop/Tablet/Mobile]
```

---

## 🎉 Testing Complete!

Once all items are checked:
- [ ] All features are functional
- [ ] No critical bugs found
- [ ] Performance is acceptable
- [ ] UI/UX is smooth
- [ ] Data integrity maintained
- [ ] Security is enforced

**Dashboard Status: Ready for Production! ✅**

---

**Last Updated:** 2025-11-11
**Version:** 4.0
