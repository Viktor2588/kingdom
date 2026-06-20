/* Remove a flat magenta image-generation background with a soft alpha edge.
   Developer utility only; requires pngjs in /tmp/imagegen-tools. */
'use strict';
var fs = require('fs');
var PNG = require('/tmp/imagegen-tools/node_modules/pngjs').PNG;
var input = process.argv[2], output = process.argv[3];
if (!input || !output) throw new Error('usage: node dev/remove-chroma.js INPUT OUTPUT');
var png = PNG.sync.read(fs.readFileSync(input));
var key = [0, 0, 0], samples = 0;
function sample(x, y) {
  var at = (y * png.width + x) * 4;
  key[0] += png.data[at]; key[1] += png.data[at + 1]; key[2] += png.data[at + 2]; samples++;
}
for (var sx = 0; sx < png.width; sx++) { sample(sx, 0); sample(sx, png.height - 1); }
for (var sy = 1; sy < png.height - 1; sy++) { sample(0, sy); sample(png.width - 1, sy); }
key = key.map(function (v) { return v / samples; });
for (var i = 0; i < png.data.length; i += 4) {
  var r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
  var distance = Math.sqrt(Math.pow(key[0] - r, 2) + Math.pow(key[1] - g, 2) + Math.pow(key[2] - b, 2));
  var alpha = Math.max(0, Math.min(1, (distance - 38) / 151));
  if (alpha <= 0.001) {
    png.data[i] = png.data[i + 1] = png.data[i + 2] = png.data[i + 3] = 0;
    continue;
  }
  if (alpha < 0.999) {
    // Reverse the chroma-key blend to suppress pink edge spill.
    png.data[i] = Math.max(0, Math.min(255, Math.round((r - key[0] * (1 - alpha)) / alpha)));
    png.data[i + 1] = Math.max(0, Math.min(255, Math.round((g - key[1] * (1 - alpha)) / alpha)));
    png.data[i + 2] = Math.max(0, Math.min(255, Math.round((b - key[2] * (1 - alpha)) / alpha)));
  }
  png.data[i + 3] = Math.round(alpha * 255);
}
fs.writeFileSync(output, PNG.sync.write(png));
