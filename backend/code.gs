/**
 * --------------------------------------------------------
 * PREORDER ADMIN PANEL - ULTIMATE BACKEND
 * --------------------------------------------------------
 */

function doGet(e) { 
  // IMPORTANT: In a real GAS deployment, you would typically 
  // use HtmlService.createTemplateFromFile to include css/js.
  // Since we are simulating a separation for your local dev:
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Preorder Admin Panel')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(5000); 

  try {
    var action = e.parameter.action;
    var payload = null;

    if (e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        if (body.action) action = body.action;
        if (body.payload) payload = body.payload;
      } catch (err) {}
    }

    var result;

    switch (action) {
      case "getData":
        result = getData();
        break;
      case "updateOrder":
        result = updateOrder(payload); 
        break;
      case "getRecentLogs":
        result = getRecentLogs();
        break;
      case "getCsvData":
        result = getCsvData();
        break;
      case "serverPing":
        result = "Active";
        break;
      default:
        result = { error: "Invalid Action" };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/* -------------------- 1. OPTIMIZED DATA FETCH -------------------- */
function getData() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return []; 

    // Batch read Cols A to S (1 to 19)
    const data = sheet.getRange(2, 1, lastRow - 1, 19).getDisplayValues(); 

    return data.map((row, index) => {
      if (!row[0]) return null;
      return {
        id:           String(row[0]).trim(),       
        reviewer:     row[2]  || "N/A",            
        product:      row[3]  || "N/A",            
        dealType:     row[4]  || "General",        
        total:        parseCurrency(row[5]),       
        deducted:     parseCurrency(row[6]),       
        commission:   parseCurrency(row[7]),       
        refundable:   parseCurrency(row[8]),       
        deliveryDate: row[9]  || "",               
        filledDate:   row[10] || "",
        refundDate:   row[11] || "",               
        paidDate:     row[12] || "",               
        remarks:      row[13] || "",               
        formLink:     row[14] || "",               
        mediator:     row[15] || "N/A",            
        phone:        row[16] || "",               
        status:       (row[18] || "").toUpperCase().trim(),
        rowIndex:     index + 2 
      };
    }).filter(item => item !== null); 

  } catch (e) {
    Logger.log("Error in getData: " + e);
    return []; 
  }
}

/* -------------------- 2. HIGH PERFORMANCE UPDATE & LOGGING -------------------- */
function updateOrder(inputData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const lastRow = sheet.getLastRow();

  try {
    var formData = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
    if (!formData || !formData.id) return "DATA_MISSING";

    const idList = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    const targetId = String(formData.id).trim();
    const rowOffset = idList.findIndex(id => String(id).trim() === targetId);

    if (rowOffset === -1) return "ID_NOT_FOUND";

    const rowIndex = rowOffset + 2; 
    const currentRowValues = sheet.getRange(rowIndex, 1, 1, 19).getValues()[0];
    
    const changes = [];
    const timestamp = new Date().toLocaleString("en-IN");

    function checkAndUpdate(colIndex, key, label) {
      const oldVal = String(currentRowValues[colIndex - 1]); 
      const newVal = String(formData[key]);
      
      if (formData[key] !== undefined && oldVal !== newVal) {
        sheet.getRange(rowIndex, colIndex).setValue(formData[key]);
        changes.push(`${label}: [${oldVal}] -> [${newVal}]`);
      }
    }

    checkAndUpdate(19, 'status', 'Status');
    checkAndUpdate(11, 'filledDate', 'Filled Date');
    checkAndUpdate(13, 'paidDate', 'Paid Date');
    checkAndUpdate(14, 'remarks', 'Remarks');

    if (changes.length > 0) {
      const logEntry = [timestamp, formData.id, changes.join(" | "), "Admin", "EDIT"];
      sheet.getRange(sheet.getLastRow() + 1, 27, 1, 5).setValues([logEntry]);
    }

    SpreadsheetApp.flush(); 
    return "SUCCESS";

  } catch (e) {
    return "ERROR: " + e.toString();
  }
}

/* -------------------- 3. RECENT LOGS -------------------- */
function getRecentLogs() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    const logRange = sheet.getRange("AA2:AC" + lastRow).getValues();
    const logs = logRange
      .filter(r => r[0] !== "" && r[1] !== "")
      .map(r => [r[0], r[1], r[2]]) 
      .reverse()
      .slice(0, 30); 
      
    return logs;
  } catch(e) { return []; }
}

/* -------------------- 4. CSV EXPORT -------------------- */
function getCsvData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getRange(1, 1, sheet.getLastRow(), 19).getDisplayValues();
  
  const csvContent = data.map(row => 
    row.map(cell => {
      let str = String(cell).replace(/"/g, '""'); 
      return `"${str}"`;
    }).join(",")
  ).join("\n");
  
  return csvContent;
}

function parseCurrency(val) { return parseFloat(String(val).replace(/[^0-9.-]+/g,"")) || 0; }