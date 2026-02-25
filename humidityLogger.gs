// --- CONFIGURATION ---
const ALERT_EMAIL = "YOUREMAILHERE@email.com";
const TEMP_MIN = 15;
const TEMP_MAX = 25;
const HUM_MIN = 90;
const HUM_MAX = 100;
const MAX_INACTIVITY_MINUTES = 60; 

// NEW: Cooldown for BOTH Temp and Humidity (in hours)
const ALERT_COOLDOWN_HOURS = 2; 
// ----------------------

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const now = new Date();
  
  // Parse the incoming JSON
  const data = JSON.parse(e.postData.contents);

  // CONVERT TO NUMBERS
  const temp = parseFloat(data.temperature);
  const hum = parseFloat(data.humidity);
  
  // Determine status for logging (Sheet always records the true status)
  let status = "NORMAL";
  if (temp < TEMP_MIN || temp > TEMP_MAX) status = "TEMP ALERT";
  if (hum < HUM_MIN || hum > HUM_MAX) status = "HUMIDITY ALERT";

  // APPEND TO SHEET
  sheet.appendRow([now, temp, hum, status]);

  // 1. PROCESS TEMPERATURE
  if (temp < TEMP_MIN || temp > TEMP_MAX) {
    // Check cooldown and send email if ready
    processAlert("Temperature", temp, TEMP_MIN, TEMP_MAX, "°C");
  }

  // 2. PROCESS HUMIDITY
  if (hum < HUM_MIN || hum > HUM_MAX) {
    // Check cooldown and send email if ready
    processAlert("Humidity", hum, HUM_MIN, HUM_MAX, "%");
  }

  return ContentService.createTextOutput("OK")
    .setMimeType(ContentService.MimeType.TEXT);
}

// --- HELPER FUNCTIONS ---

// Generic function to handle the cooldown check and email sending
function processAlert(type, value, min, max, unit) {
  const props = PropertiesService.getScriptProperties();
  
  // We create a unique ID for the property, e.g., "LAST_ALERT_Temperature" or "LAST_ALERT_Humidity"
  const propKey = `LAST_ALERT_${type}`; 
  const lastAlertTime = props.getProperty(propKey);
  const now = new Date();
  
  let shouldSend = true;

  // Check Cooldown
  if (lastAlertTime) {
    const lastTime = new Date(parseInt(lastAlertTime));
    const diffInHours = (now - lastTime) / (1000 * 60 * 60);

    if (diffInHours < ALERT_COOLDOWN_HOURS) {
      shouldSend = false;
      console.log(`${type} alert skipped. Last alert was ${diffInHours.toFixed(2)} hours ago.`);
    }
  }

  // Send Email if allowed
  if (shouldSend) {
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: `ESP32 Alert: ${type} Out of Range`,
      body: `Alert! Received ${type.toLowerCase()} of ${value}${unit} (Range: ${min}-${max}).`
    });

    // Update the timestamp for this specific type
    props.setProperty(propKey, now.getTime().toString());
  }
}

// 3. HEARTBEAT CHECK
function checkHeartbeat() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return; 

  const lastTimestamp = new Date(sheet.getRange(lastRow, 1).getValue());
  const now = new Date();
  const diffInMinutes = (now - lastTimestamp) / 1000 / 60;

  if (diffInMinutes > MAX_INACTIVITY_MINUTES) {
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: "ESP32 Alert: Board Offline",
      body: `The board has not reported data in ${Math.round(diffInMinutes)} minutes. Last check-in: ${lastTimestamp}.`
    });
  }
}

// UTILITIES
function testEmail() {
  MailApp.sendEmail(ALERT_EMAIL, "Test Subject", "If you see this, permissions are correct!");
}

function resetAllTimers() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('LAST_ALERT_Temperature');
  props.deleteProperty('LAST_ALERT_Humidity');
  console.log("All cooldown timers have been reset.");
}
