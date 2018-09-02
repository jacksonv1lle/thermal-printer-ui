#include <SoftwareSerial.h>
#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <WiFiManager.h>          //https://github.com/tzapu/WiFiManager WiFi Configuration Magic
#include <ArduinoJson.h>
#include "Adafruit_Thermal.h"
#include "app.h"
#define DTR_PIN 5 // labeled DTR on printer

Adafruit_Thermal printer(&Serial, DTR_PIN);

ESP8266WebServer server(80);

const int led = 13;

void handlePrint(){
  if (server.hasArg("data")== false){ //Check if content received
    server.send(400, "text/plain", "{\"code\": 400}");
  } else {
    String content = server.arg("data");
    const size_t bufferSize = JSON_ARRAY_SIZE(480) + JSON_OBJECT_SIZE(1) + 1850;
    DynamicJsonBuffer jsonBuffer(bufferSize);
    JsonObject&  parsed= jsonBuffer.parseObject(content);
    int size = 480;
    uint8_t adalogo_data[size];
    for(int i=0;i<size;i++){
      adalogo_data[i] = (uint8_t)parsed["data"][i];
    }
    if( printer.hasPaper() ) {
      printer.printBitmap(384, 10, adalogo_data, false);
      delay(200);
      server.send(200, "text/plain", "{\"code\": 200}"); 
    } else {
      server.send(503, "text/plain", "{\"code\": 503}");
    }
  }
}
void handleConfig(){
  if (server.hasArg("data")== false){ //Check if content received
    server.send(400, "text/plain", "No config...");
  } else {
    String content = server.arg("data");
    const size_t bufferSize = JSON_OBJECT_SIZE(4) + 70;
    DynamicJsonBuffer jsonBuffer(bufferSize);
    JsonObject&  parsed= jsonBuffer.parseObject(content);

    int heatTime = parsed["heatTime"];
    int heatInterval = parsed["heatInterval"];
    char printDensity = parsed["printDensity"];
    char printBreakTime = parsed["printBreakTime"];

    initPrinter(heatTime, heatInterval, printDensity, printBreakTime);
    
    server.send(200, "text/plain", "Done");
  }
  digitalWrite(led, 1);
  digitalWrite(led, 0);
}
void handleRoot() {
  digitalWrite(led, 1);
  String content = "";
  content += FPSTR(app_html);
  server.send(200, "text/html", content);
  digitalWrite(led, 0);
}

void handleNotFound(){
  digitalWrite(led, 1);
  String message = "File Not Found\n\n";
  message += "URI: ";
  message += server.uri();
  message += "\nMethod: ";
  message += (server.method() == HTTP_GET)?"GET":"POST";
  message += "\nArguments: ";
  message += server.args();
  message += "\n";
  for (uint8_t i=0; i<server.args(); i++){
    message += " " + server.argName(i) + ": " + server.arg(i) + "\n";
  }
  server.send(404, "text/plain", message);
  digitalWrite(led, 0);
}
void initPrinter(int &heatTime, int &heatInterval, char &printDensity, char &printBreakTime){
 //Modify the print speed and heat
 printer.write(27);
 printer.write(55);
 printer.write(7); //Default 64 dots = 8*('7'+1)
 printer.write(heatTime); //Default 80 or 800us
 printer.write(heatInterval); //Default 2 or 20us
 //Modify the print density and timeout
 printer.write(18);
 printer.write(35);
 int printSetting = (printDensity<<4) | printBreakTime;
 printer.write(printSetting); //Combination of printDensity and printBreakTime
}
void setup(void){
  Serial.begin(9600);
  int heatTime = 125;
  int heatInterval = 40;
  char printDensity = 20; 
  char printBreakTime = 2;
  

  printer.begin();
  initPrinter(heatTime, heatInterval, printDensity, printBreakTime);
  pinMode(led, OUTPUT);
  digitalWrite(led, 0);


  WiFiManager wifiManager;
  wifiManager.setDebugOutput(false);
  wifiManager.autoConnect("Printer");

  digitalWrite(led, 1);

  server.on("/", handleRoot);

  server.on("/print", handlePrint);
  
  server.on("/config", handleConfig);

  server.onNotFound(handleNotFound);

  server.begin();
}

void loop(void){
  server.handleClient();
}
