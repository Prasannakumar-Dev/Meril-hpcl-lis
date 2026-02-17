const LISSerialInterface = require("./lis-serial-interface");

console.log("=".repeat(70));
console.log("  GLUQUANT HBA1C HPLC - LIS Interface Server");
console.log("=".repeat(70));

// List available serial ports
LISSerialInterface.listPorts().then((ports) => {
  console.log("\n📍 Available ports:");
  ports.forEach((port) => {
    console.log(
      `  - ${port.path} (${port.manufacturer || "Unknown"}) [${
        port.serialNumber || "N/A"
      }]`,
    );
  });
  console.log("");
});

// =====================
// ✅ CORRECT CONFIG
// =====================
const PORT = "/dev/ttyUSB1";
const CONFIG = {
  baudRate: 9600, // ✅ MUST match analyzer
  dataBits: 8, // ✅ MUST be 8
  stopBits: 1,
  parity: "none",
  logCommunications: true,
  debugMode: true, // ✅ ENABLE during testing
};

console.log("⚙️  Configuration:");
console.log(`   Port: ${PORT}`);
console.log(`   Baud Rate: ${CONFIG.baudRate}`);
console.log(`   Data Bits: ${CONFIG.dataBits}`);
console.log(`   Stop Bits: ${CONFIG.stopBits}`);
console.log(`   Parity: ${CONFIG.parity}`);
console.log(`   Debug Mode: ${CONFIG.debugMode ? "ON" : "OFF"}`);
console.log("");

// Create interface
const server = new LISSerialInterface(PORT, CONFIG);

server.on("connected", () => {
  console.log("✅ Connected to analyzer");
  console.log("📡 Waiting for LIS upload from analyzer...");
  console.log("💡 Accept result on analyzer and press UPLOAD / LIS");
  console.log("=".repeat(70));
});

server.on("results", (data) => {
  console.log("\n" + "=".repeat(70));
  console.log("🔬 RESULT RECEIVED");
  console.log("=".repeat(70));

  console.log("\n📋 Machine Information:");
  console.log(`   Model: ${data.machineInfo.model}`);
  console.log(`   Serial: ${data.machineInfo.serialNumber}`);

  console.log("\n📋 Sample Information:");
  console.log(`   Sample ID: ${data.sampleInfo.sampleId}`);
  console.log(`   Analysis Time: ${data.sampleInfo.analysisTime}`);
  console.log(`   Sample Type: ${data.sampleInfo.sampleType}`);
  console.log(`   Position: ${data.sampleInfo.samplePosition}`);

  console.log("\n🩸 Results:");
  Object.entries(data.results).forEach(([key, result]) => {
    const interpretation = result.interpretation
      ? ` (${result.interpretation})`
      : "";
    console.log(`   ${key}: ${result.value}${result.unit}${interpretation}`);
  });

  console.log("\n📄 Full JSON:");
  console.log(JSON.stringify(data, null, 2));

  console.log("\n📡 Waiting for next sample...");
  console.log("=".repeat(70));
});

server.on("error", (err) => {
  console.error("\n❌ ERROR:", err.message);
  console.error("=".repeat(70));
});

server.on("disconnected", () => {
  console.log("\n⚠️  Disconnected from analyzer");
  console.log("=".repeat(70));
});

// Start the server
server.start();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⏹️  Shutting down...");
  await server.close();
  console.log("✅ Server stopped");
  process.exit(0);
});
