// --- CONFIGURATION ---
const ALERT_EMAIL = ""; // CHANGE THIS
const TEMP_MIN = 10;
const TEMP_MAX = 30;
const HUM_MIN = 70;
const HUM_MAX = 100;
const MAX_INACTIVITY_MINUTES = 60;
// ----------------------

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const now = new Date();

  // Parse the incoming JSON
  const data = JSON.parse(e.postData.contents);

  // CONVERT TO NUMBERS (Crucial for math/comparisons)
  const temp = parseFloat(data.temperature);
  const hum = parseFloat(data.humidity);

  // Determine status for debugging
  let status = "NORMAL";
  if (temp < TEMP_MIN || temp > TEMP_MAX) status = "TEMP ALERT";
  if (hum < HUM_MIN || hum > HUM_MAX) status = "HUMIDITY ALERT";

  // APPEND TO SHEET (Only once!)
  // Columns: Time, Temp, Humidity, Status
  sheet.appendRow([now, temp, hum, status]);

  // 1. TEMPERATURE EMAIL CHECK
  if (temp < TEMP_MIN || temp > TEMP_MAX) {
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: "ESP32 Alert: Temperature Out of Range",
      body: `Alert! Received temperature of ${temp}°C (Range: ${TEMP_MIN}-${TEMP_MAX}).`,
    });
  }

  // 2. HUMIDITY EMAIL CHECK
  if (hum < HUM_MIN || hum > HUM_MAX) {
    MailApp.sendEmail({
      to: ALERT_EMAIL,
      subject: "ESP32 Alert: Humidity Out of Range",
      body: `Alert! Received humidity of ${hum}% (Range: ${HUM_MIN}-${HUM_MAX}).`,
    });
  }

  return ContentService.createTextOutput("OK").setMimeType(
    ContentService.MimeType.TEXT,
  );
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
      body: `The board has not reported data in ${Math.round(diffInMinutes)} minutes. Last check-in: ${lastTimestamp}.`,
    });
  }
}

function testEmail() {
  MailApp.sendEmail(
    ALERT_EMAIL,
    "Test Subject",
    "If you see this, permissions are correct!",
  );
  console.log("Email sent. Check your inbox.");
}
