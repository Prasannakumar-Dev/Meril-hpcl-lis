// simple-listener.js
const { SerialPort } = require("serialport");

console.log("=".repeat(70));
console.log("  SIMPLE RAW DATA LISTENER");
console.log("=".repeat(70));

// Use the manual's default settings
const port = new SerialPort({
  path: "/dev/ttyUSB1",
  baudRate: 115200, // Manual default
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  autoOpen: false,
});

let bytesReceived = 0;
let startTime = null;

port.open((err) => {
  if (err) {
    console.error("❌ Failed to open port:", err.message);
    process.exit(1);
  }

  startTime = Date.now();
  console.log("\n✅ Port COM4 opened successfully");
  console.log("⚙️  Settings: 115200 baud, 8 data bits, no parity, 1 stop bit");
  console.log("\n📡 Listening for ANY data...");
  console.log("⏰ Started at:", new Date().toLocaleTimeString());
  console.log("\n" + "=".repeat(70));
  console.log("🎯 NOW: Export/Send a report from your analyzer!");
  console.log("=".repeat(70));
  console.log("\nWaiting for data... (This will run for 60 seconds)");
  console.log("Press Ctrl+C to stop early\n");
});

port.on("data", (data) => {
  bytesReceived += data.length;
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "🎉".repeat(35));
  console.log(`✅ DATA RECEIVED after ${elapsedSeconds} seconds!`);
  console.log("🎉".repeat(35));

  console.log(
    `\n📦 Received ${data.length} bytes (Total: ${bytesReceived} bytes)`,
  );

  console.log("\n🔢 RAW BYTES (decimal):");
  console.log(Array.from(data).join(", "));

  console.log("\n🔤 HEX:");
  const hex = data.toString("hex").match(/.{1,2}/g) || [];
  for (let i = 0; i < hex.length; i += 16) {
    const chunk = hex.slice(i, i + 16);
    const offset = i.toString(16).padStart(4, "0");
    console.log(`${offset}:  ${chunk.join(" ")}`);
  }

  console.log("\n📄 ASCII (raw):");
  console.log(data.toString("utf8"));

  console.log("\n📄 ASCII (with control characters visible):");
  const readable = data.toString("utf8").replace(/[\x00-\x1F\x7F]/g, (c) => {
    const code = c.charCodeAt(0);
    if (code === 0x0d) return "[CR]";
    if (code === 0x0a) return "[LF]";
    if (code === 0x09) return "[TAB]";
    return `[0x${code.toString(16).padStart(2, "0").toUpperCase()}]`;
  });
  console.log(readable);

  console.log("\n" + "─".repeat(70));
  console.log("Continuing to listen for more data...\n");
});

port.on("error", (err) => {
  console.error("\n❌ Serial port error:", err.message);
});

port.on("close", () => {
  console.log("\n🔌 Port closed");
});

// Auto-close after 60 seconds if no data
const timeout = setTimeout(() => {
  console.log("\n" + "=".repeat(70));
  if (bytesReceived === 0) {
    console.log("⏱️  60 seconds elapsed - NO DATA RECEIVED");
    console.log("=".repeat(70));
    console.log("\n❌ PROBLEM IDENTIFIED: Analyzer is not sending data");
    console.log("\n🔍 CHECKLIST:");
    console.log("   ❓ Did you press the 'Export' or 'Send to LIS' button?");
    console.log(
      "   ❓ Is the analyzer in 'Manual Upload' or 'Auto Upload' mode?",
    );
    console.log("   ❓ Is the correct COM port selected?");
    console.log("   ❓ Is the cable properly connected?");
    console.log("   ❓ Does the analyzer show any error messages?");
    console.log("\n💡 TRY:");
    console.log(
      "   1. Check analyzer manual for 'Data Upload' or 'LIS Communication' section",
    );
    console.log(
      "   2. Look for a setting to enable 'Send to Computer' or 'External System'",
    );
    console.log(
      "   3. Try running: node test-raw-data.js (tests multiple baud rates)",
    );
    console.log("   4. Verify cable with a loopback test (connect TX to RX)");
  } else {
    console.log(`✅ Received ${bytesReceived} total bytes`);
    console.log("=".repeat(70));
  }
  port.close();
  process.exit(bytesReceived === 0 ? 1 : 0);
}, 60000);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n⏹️  Interrupted by user");
  clearTimeout(timeout);
  port.close();
  process.exit(0);
});

// Show periodic status
let lastStatus = Date.now();
setInterval(() => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (bytesReceived === 0 && elapsed % 10 === 0) {
    console.log(
      `⏳ ${elapsed}s elapsed, ${bytesReceived} bytes received - still waiting...`,
    );
  }
}, 1000);
