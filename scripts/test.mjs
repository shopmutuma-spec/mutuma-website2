import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
for (const name of readdirSync("tests").filter((name) => name.endsWith(".test.mjs")).sort()) {
    const result = spawnSync(process.execPath, [`tests/${name}`], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
}
