// src/server/ble-bridge.ts
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const PIXEL_SERVICE_UUID    = "a0f10001000000000000000000000000";
const PIXEL_CHAR_UUID       = "a0f10002000000000000000000000000";
const AGENT_CHAR_UUID       = "a0f10003000000000000000000000000";
const DEVICE_NAME           = "AgentOffice";

interface BleState {
  bodyColors: number[];    // 50 RGB values
  slotStates: number[];    // 4 slot states (0=off, 1=amber, 2=white)
  hirstState: number;      // 0=off, 1=in, 2=running, 3=out
}

let bleno: any = null;
let pixelChar: any = null;
let agentChar: any = null;
let subscribedPixel = false;
let subscribedAgent = false;
let started = false;

function encodePixels(state: BleState): Buffer {
  // Compact binary: 1 byte reserved + 150 bytes RGB = 151 bytes
  const buf = Buffer.alloc(151);
  buf[0] = 0; // reserved
  for (let i = 0; i < 50; i++) {
    const c = state.bodyColors[i] || 0;
    buf[1 + i * 3]     = (c >> 16) & 0xFF; // R
    buf[1 + i * 3 + 1] = (c >> 8) & 0xFF;  // G
    buf[1 + i * 3 + 2] = c & 0xFF;         // B
  }
  return buf;
}

function encodeAgents(state: BleState): Buffer {
  // 4 bytes slot states + 1 byte hirst = 5 bytes
  const buf = Buffer.alloc(5);
  for (let i = 0; i < 4; i++) {
    buf[i] = state.slotStates[i] || 0;
  }
  buf[4] = state.hirstState;
  return buf;
}

export function startBleBridge(): void {
  if (started) return;

  try {
    const blenoLib = require("@stoprocent/bleno");
    bleno = blenoLib.withBindings("mac");
  } catch (err: any) {
    console.log("[ble] bleno not available:", err.message);
    return;
  }

  const BlenoPrimaryService = bleno.PrimaryService;
  const BlenoCharacteristic = bleno.Characteristic;

  pixelChar = new BlenoCharacteristic({
    uuid: PIXEL_CHAR_UUID,
    properties: ["notify"],
    onSubscribe: (maxValueSize: number, updateValueCallback: any) => {
      console.log("[ble] pixel subscriber connected");
      subscribedPixel = true;
      pixelChar._updateValueCallback = updateValueCallback;
    },
    onUnsubscribe: () => {
      console.log("[ble] pixel subscriber disconnected");
      subscribedPixel = false;
      pixelChar._updateValueCallback = null;
    },
  });

  agentChar = new BlenoCharacteristic({
    uuid: AGENT_CHAR_UUID,
    properties: ["notify"],
    onSubscribe: (maxValueSize: number, updateValueCallback: any) => {
      console.log("[ble] agent subscriber connected");
      subscribedAgent = true;
      agentChar._updateValueCallback = updateValueCallback;
    },
    onUnsubscribe: () => {
      console.log("[ble] agent subscriber disconnected");
      subscribedAgent = false;
      agentChar._updateValueCallback = null;
    },
  });

  const service = new BlenoPrimaryService({
    uuid: PIXEL_SERVICE_UUID,
    characteristics: [pixelChar, agentChar],
  });

  bleno.on("stateChange", (state: string) => {
    console.log("[ble] state:", state);
    if (state === "poweredOn") {
      bleno.startAdvertising(DEVICE_NAME, [PIXEL_SERVICE_UUID], (err: any) => {
        if (err) console.error("[ble] advertising error:", err);
        else console.log("[ble] advertising as", DEVICE_NAME);
      });
    } else {
      bleno.stopAdvertising();
    }
  });

  bleno.on("advertisingStart", (err: any) => {
    if (err) return;
    bleno.setServices([service]);
  });

  started = true;
  console.log("[ble] bridge starting...");
}

export function updateBleState(state: BleState): void {
  if (subscribedPixel && pixelChar?._updateValueCallback) {
    try {
      pixelChar._updateValueCallback(encodePixels(state));
    } catch {}
  }
  if (subscribedAgent && agentChar?._updateValueCallback) {
    try {
      agentChar._updateValueCallback(encodeAgents(state));
    } catch {}
  }
}

export function isBleConnected(): boolean {
  return subscribedPixel || subscribedAgent;
}
