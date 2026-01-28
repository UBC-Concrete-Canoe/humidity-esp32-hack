#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEClient.h>
#include "esp_eap_client.h"
#include "esp_wifi.h"

// --- UBCsecure CONFIGURATION ---
const char* WIFI_SSID = "ubcsecure"; // Use lowercase as seen in your scan
const char* EAP_USERNAME = "cwluser"; 
const char* EAP_PASSWORD = "cwlpwd";

const char* SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyY5nwZ_yyBdIP1OV4Jo8v6AosNzE-olYpODDp_PWHGXoHtnQD8smuHqzGe2edAUUDprQ/exec";

// Sleep Time (Seconds)
#define TIME_TO_SLEEP  300 

static BLEUUID serviceUUID("00010203-0405-0607-0809-0a0b0c0d1910");
static BLEUUID charUUID("00010203-0405-0607-0809-0a0b0c0d2b10");
const char* targetMACStr = "f2:52:e0:a2:b9:8b"; 

// --- GLOBALS ---
RTC_DATA_ATTR int bootCount = 0;
float tempVal = 0;
float humVal = 0;
volatile bool dataReceived = false;
volatile bool sensorFound = false;

BLEClient* pClient = nullptr;
BLEAdvertisedDevice* myDevice = nullptr;

// --- CALLBACKS ---
void notifyCallback(BLERemoteCharacteristic* pChar, uint8_t* pData, size_t length, bool isNotify) {
  if (length >= 6) {
    int16_t rawTemp = pData[3] | (pData[4] << 8);
    tempVal = rawTemp / 10.0;
    humVal = pData[5];
    dataReceived = true;
  }
}

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    String scannedAddr = advertisedDevice.getAddress().toString().c_str();
    if (scannedAddr == targetMACStr) {
      Serial.println("   >>> TARGET MATCHED! <<<");
      
      // 1. CRITICAL: SET THE FLAG FIRST!
      sensorFound = true; 
      
      // 2. SAVE THE DEVICE
      if (myDevice) delete myDevice;
      myDevice = new BLEAdvertisedDevice(advertisedDevice);
      
      // 3. STOP THE SCAN LAST (This unblocks the main loop)
      BLEDevice::getScan()->stop();
    }
  }
};

void runProcess() {
  Serial.println("\n[1/3] Starting BLE Scan...");
  
  sensorFound = false;
  dataReceived = false;

  BLEDevice::init("");
  pClient = BLEDevice::createClient();
  BLEScan* pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
  pBLEScan->setActiveScan(true); 
  pBLEScan->setInterval(100);     
  pBLEScan->setWindow(99);        
  
  // Scan
  pBLEScan->start(20, false);
  
  // Small safety delay to let the callback finish
  delay(100);

  if (!sensorFound) {
    Serial.println("FAIL: Target sensor not found.");
    return; 
  }

  Serial.println(" Connecting...");
  if (pClient->connect(myDevice)) {
    BLERemoteService* pRemoteService = pClient->getService(serviceUUID);
    if (pRemoteService) {
      BLERemoteCharacteristic* pRemoteChar = pRemoteService->getCharacteristic(charUUID);
      if (pRemoteChar && pRemoteChar->canNotify()) {
        pRemoteChar->registerForNotify(notifyCallback);
        long start = millis();
        while (!dataReceived && millis() - start < 10000) delay(10);
      }
    }
    pClient->disconnect();
  }
  
  delete pClient;
  BLEDevice::deinit(true); 
  delay(500);

  if (!dataReceived) {
    Serial.println("FAIL: Connected but no data received.");
    return;
  }

  Serial.println("[2/3] Connecting to ubcsecure...");
  
  // 1. Force a clean state
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);
  delay(100);

  // 2. Set credentials using the basic client functions
  // These functions usually exist even if the config struct is hidden
  esp_eap_client_set_username((uint8_t *)EAP_USERNAME, strlen(EAP_USERNAME));
  esp_eap_client_set_password((uint8_t *)EAP_PASSWORD, strlen(EAP_PASSWORD));

  // 3. Enable Enterprise with the legacy-compatible call
  // Passing no arguments tells the driver to use the credentials set above
  esp_wifi_sta_enterprise_enable(); 

  WiFi.begin(WIFI_SSID);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 60) {
      delay(500);
      Serial.print(".");
      retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure *client = new WiFiClientSecure;
    client->setInsecure(); 
    HTTPClient https;
    
    if (https.begin(*client, SCRIPT_URL)) {
      https.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
      https.addHeader("Content-Type", "application/json");
      String payload = "{\"temperature\":" + String(tempVal, 1) + ",\"humidity\":" + String(humVal, 1) + "}";
      
      int code = https.POST(payload);
      Serial.printf("UPLOAD SUCCESS: %d\n", code);
      https.end();
    }
    delete client;
  }
  
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

void setup() {
  Serial.begin(115200);
  delay(1000); 
  
  ++bootCount;
  Serial.println("Boot number: " + String(bootCount));

  runProcess();

  Serial.println("Going to sleep for 5 minutes...");
  Serial.flush(); 
  esp_sleep_enable_timer_wakeup(TIME_TO_SLEEP * 1000000ULL);
  esp_deep_sleep_start();
}

void loop() {
}