import { build } from "esbuild";
import fs from "fs";

const buildId = fs.readFileSync("dist/.build-id", "utf-8").trim();

await build({
  entryPoints: ["src/server/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/server.js",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  external: [],
});

console.log("Server bundled to dist/server.js");
