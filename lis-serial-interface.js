const { SerialPort } = require("serialport");
const EventEmitter = require("events");

class LISSerialInterface extends EventEmitter {
  constructor(portPath, options = {}) {
    super();

    this.portPath = portPath;
    this.options = {
      baudRate: options.baudRate || 115200, // ✅ protocol default
      dataBits: options.dataBits || 8, // ✅ protocol default
      stopBits: options.stopBits || 1,
      parity: options.parity || "none",
      rtscts: false, // ✅ REQUIRED (hardware flow control)
      logCommunications: options.logCommunications ?? true,
      debugMode: options.debugMode ?? false,
    };

    // Streaming state
    this.port = null;
    this.state = "IDLE"; // IDLE → RECEIVING
    this.messageBuffer = "";
    this.lastByteAt = null;
  }

  // --------------------------------------------------
  // Static: list ports
  // --------------------------------------------------
  static async listPorts() {
    return SerialPort.list();
  }

  // --------------------------------------------------
  // Start connection
  // --------------------------------------------------
  start() {
    this.port = new SerialPort({
      path: this.portPath,
      baudRate: this.options.baudRate,
      dataBits: this.options.dataBits,
      stopBits: this.options.stopBits,
      parity: this.options.parity,
      rtscts: this.options.rtscts,
      autoOpen: false,
    });

    this.port.open((err) => {
      if (err) {
        this.emit("error", err);
        return;
      }

      console.log(`🔌 Connected on ${this.portPath}`);
      console.log(`⚙️  ${this.options.baudRate}-8-N-1 | RTS/CTS: ON`);
      this.emit("connected");
    });

    this.port.on("data", (data) => this._onData(data));
    this.port.on("error", (err) => this.emit("error", err));
    this.port.on("close", () => this.emit("disconnected"));
  }

  // --------------------------------------------------
  // Core streaming handler (STATE MACHINE)
  // --------------------------------------------------
  _onData(data) {
    this.lastByteAt = Date.now();
    const ascii = data.toString("utf8");

    if (this.options.debugMode) {
      console.log("⬇ HEX :", data.toString("hex"));
      console.log("⬇ ASCII :", ascii);
    }

    if (this.options.logCommunications) {
      const printable = ascii.replace(
        /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g,
        (c) => `[0x${c.charCodeAt(0).toString(16)}]`
      );
      console.log("📨", printable);
    }

    // STREAM SAFE parsing
    for (const char of ascii) {
      this._consumeChar(char);
    }
  }

  // --------------------------------------------------
  // Character-level protocol parsing
  // --------------------------------------------------
  _consumeChar(char) {
    this.messageBuffer += char;

    // Detect START
    if (this.state === "IDLE" && this.messageBuffer.includes("<SEND>")) {
      this.state = "RECEIVING";
      this.messageBuffer = "<SEND>";
      return;
    }

    // Detect END
    if (this.state === "RECEIVING" && this.messageBuffer.includes("</SEND>")) {
      const fullMessage = this.messageBuffer;
      this.state = "IDLE";
      this.messageBuffer = "";

      this._handleCompleteMessage(fullMessage);
    }

    // Safety: prevent runaway memory
    if (this.messageBuffer.length > 100_000) {
      console.warn("⚠ Buffer overflow protection triggered");
      this.state = "IDLE";
      this.messageBuffer = "";
    }
  }

  // --------------------------------------------------
  // Handle full protocol message
  // --------------------------------------------------
  _handleCompleteMessage(message) {
    console.log(`✉️  Complete LIS message received (${message.length} chars)`);

    try {
      const parsed = this.parseProtocol(message);
      this.emit("results", parsed);
    } catch (err) {
      this.emit("error", err);
    }
  }

  // --------------------------------------------------
  // PROTOCOL PARSER (GLUQUANT HBA1C HPLC)
  // --------------------------------------------------
  parseProtocol(raw) {
    const result = {
      machineInfo: {},
      sampleInfo: {},
      results: {},
      raw,
      receivedAt: new Date().toISOString(),
    };

    const clean = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // -------- Machine info <M>
    const m = clean.match(/<M>(.*?)<\/M>/);
    if (m) {
      const [model, serial] = m[1].split("|");
      result.machineInfo = {
        model: model?.trim(),
        serialNumber: serial?.trim(),
      };
    }

    // -------- Sample info <I>
    const i = clean.match(/<I>\s*([\s\S]*?)\s*<\/I>/);
    if (i) {
      const parts = i[1].trim().split("|");

      const typeMap = {
        0: "whole_blood",
        1: "quality_control",
        2: "calibration",
        3: "diluted",
      };

      result.sampleInfo = {
        recordType: parts[0],
        analysisTime: parts[1],
        sampleId: parts[2],
        samplePosition: parts[3],
        sampleTypeCode: Number(parts[4]),
        sampleType: typeMap[Number(parts[4])] || "unknown",
      };
    }

    // -------- Results <R>
    const r = clean.match(/<R>\s*([\s\S]*?)\s*<\/R>/);
    if (r) {
      r[1]
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((line) => {
          const [key, val] = line.split("|");
          if (!key || !val) return;

          result.results[key] = {
            value: parseFloat(val),
            unit: "%",
          };
        });
    }

    // -------- Clinical interpretation
    if (result.results.HbA1c) {
      const v = result.results.HbA1c.value;
      result.results.HbA1c.interpretation =
        v < 5.7 ? "Normal" : v < 6.5 ? "Prediabetes" : "Diabetes";
    }

    return result;
  }

  // --------------------------------------------------
  // Close
  // --------------------------------------------------
  close() {
    return new Promise((resolve) => {
      if (!this.port?.isOpen) return resolve();
      this.port.close(resolve);
    });
  }
}

module.exports = LISSerialInterface;
