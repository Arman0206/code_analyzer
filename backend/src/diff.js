function diff(oldCode, newCode) {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  let output = "--- original\n+++ formatted\n";
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) output += `- ${oldLines[i]}\n`;
      if (newLines[i] !== undefined) output += `+ ${newLines[i]}\n`;
    }
  }
  return output;
}
module.exports = diff;