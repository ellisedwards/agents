import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AppConfig {
  clawHost: string;
  clawHostFallback: string;
  clawPort: number;
  port: number;
}

const CONFIG_DIR = path.join(os.homedir(), ".agent-office");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULTS: AppConfig = {
  clawHost: "192.168.50.40",
  clawHostFallback: "100.93.11.10",
  clawPort: 9999,
  port: 4747,
};

export function loadConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    // Create default config file if it doesn't exist
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULTS, null, 2));
    } catch {}
    return DEFAULTS;
  }
}

export function clawBaseUrl(config: AppConfig): string {
  return `http://${config.clawHost}:${config.clawPort}`;
}
