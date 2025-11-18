/**
 * Google Apps Script للربط مع SubPro Dashboard
 * 
 * خطوات الإعداد:
 * 1. افتح Google Sheets الخاص بك
 * 2. Extensions > Apps Script
 * 3. انسخ هذا الكود والصقه
 * 4. Deploy > New deployment > Web app
 * 5. Execute as: Me
 * 6. Who has access: Anyone
 * 7. انسخ Web App URL وضعه في google-sheets-integration.js
 */

/**
 * معالجة طلبات POST
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch (action) {
      case 'initializeSheet':
        return initializeSheet(data.sheetName, data.headers);
      
      case 'addRow':
        return addRow(data.sheetName, data.data);
      
      case 'updateRow':
        return updateRow(data.sheetName, data.orderId, data.data);
      
      case 'bulkAddRows':
        return bulkAddRows(data.sheetName, data.data);
      
      default:
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Unknown action'
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * معالجة طلبات GET
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'SubPro Google Sheets Integration is active'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * تهيئة الشيت بالهيدر
 */
function initializeSheet(sheetName, headers) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    
    // إنشاء الشيت إذا لم يكن موجوداً
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // التحقق من وجود الهيدر
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      
      // تنسيق الهيدر
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4CAF50');
      headerRange.setFontColor('#FFFFFF');
      
      // تجميد الصف الأول
      sheet.setFrozenRows(1);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Sheet initialized successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * إضافة صف جديد
 */
function addRow(sheetName, rowData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    sheet.appendRow(rowData);
    
    // تنسيق الصف الجديد
    const lastRow = sheet.getLastRow();
    const range = sheet.getRange(lastRow, 1, 1, rowData.length);
    
    // ألوان حسب حالة الأوردر
    const status = rowData[12]; // حالة الأوردر
    if (status === 'completed') {
      range.setBackground('#E8F5E9');
    } else if (status === 'pending') {
      range.setBackground('#FFF9C4');
    } else if (status === 'cancelled') {
      range.setBackground('#FFEBEE');
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Row added successfully',
      row: lastRow
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * تحديث صف موجود
 */
function updateRow(sheetName, orderId, rowData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // البحث عن الصف بناءً على رقم الأوردر
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === orderId) {
        rowIndex = i + 1; // +1 لأن الصفوف تبدأ من 1
        break;
      }
    }
    
    if (rowIndex === -1) {
      // إذا لم يتم العثور على الصف، أضف صف جديد
      return addRow(sheetName, rowData);
    }
    
    // تحديث الصف
    const range = sheet.getRange(rowIndex, 1, 1, rowData.length);
    range.setValues([rowData]);
    
    // تنسيق الصف
    const status = rowData[12]; // حالة الأوردر
    if (status === 'completed') {
      range.setBackground('#E8F5E9');
    } else if (status === 'pending') {
      range.setBackground('#FFF9C4');
    } else if (status === 'cancelled') {
      range.setBackground('#FFEBEE');
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Row updated successfully',
      row: rowIndex
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * إضافة عدة صفوف دفعة واحدة
 */
function bulkAddRows(sheetName, rowsData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const startRow = sheet.getLastRow() + 1;
    const numRows = rowsData.length;
    const numCols = rowsData[0].length;
    
    // إضافة جميع الصفوف دفعة واحدة
    const range = sheet.getRange(startRow, 1, numRows, numCols);
    range.setValues(rowsData);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `${numRows} rows added successfully`,
      startRow: startRow,
      endRow: startRow + numRows - 1
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
