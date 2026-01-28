
# How to Use

## 1. Hardware Setup
- Obtain an **ESP32** device and a **BLE-based humidity/temperature sensor**.
- Using a mobile device, open **nRF Connect** and verify:
  - You can connect to the sensor
  - You can subscribe to its notifications
  - You can correctly identify which bytes correspond to temperature and humidity

## 2. ESP32 Configuration
- Open the Arduino sketch.
- Update **all lines marked `CHANGE ME`** with values specific to your setup:
  - WiFi credentials
  - BLE service and characteristic UUIDs
  - Any sensor-specific parsing logic

## 3. Google Sheets Setup
- Create a new **Google Sheet**.
- Navigate to **Extensions → Apps Script**.
- Paste in the provided Apps Script code.
- Modify the script as needed for your spreadsheet layout.

## 4. Deployment
- Deploy the Apps Script as a **Web App** and copy the deployment URL.
- Upload the Arduino sketch to your ESP32.
- Power the ESP32 and confirm data appears in the Google Sheet.
