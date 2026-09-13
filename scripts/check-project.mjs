import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import "./validate-project.mjs";
function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
}
const sources = ["js", "netlify", "scripts", "tests"].flatMap(files).filter((file) => /\.(js|mjs)$/.test(file));
for (const file of sources) {
    const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`${file}: ${result.error?.message || "syntax check failed"}`);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)) {
        if (!existsSync(resolve(dirname(file), match[1].split("?")[0]))) throw new Error(`Broken local import in ${file}: ${match[1]}`);
    }
}
console.log(`Checked syntax and local imports in ${sources.length} JavaScript files. No TypeScript sources are configured.`);
