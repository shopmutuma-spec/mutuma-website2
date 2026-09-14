import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync("css/storefront-light.css", "utf8");
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[a-f0-9]{6})`, "i"))[1];
function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(first, second) {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const name of ["action-primary", "action-hover", "action-pressed", "text", "muted", "state-success", "state-error", "state-warning"]) {
    assert.ok(contrast(token(name), "#ffffff") >= 4.5, `${name} must pass AA on white`);
}
assert.ok(contrast(token("muted"), token("surface-soft")) >= 4.5);
assert.ok(contrast(token("control-border"), "#ffffff") >= 3);
console.log(`Colour tokens pass AA; white on primary button: ${contrast(token("action-primary"), "#ffffff").toFixed(2)}:1.`);
