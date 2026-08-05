/**
 * Generates fake-camera video fixtures for the scanner browser tests.
 *   node tests/fixtures/make-camera-fixtures.cjs
 *
 * Writes (gitignored, ~7MB each):
 *   barcode.y4m — 1280x720 frames showing a real, checksum-valid EAN-13
 *   blank.y4m   — plain white frames (camera opens but never decodes)
 *
 * Y4M is raw YUV, so no encoder is needed. Chromium plays these through
 * --use-file-for-fake-video-capture, looping automatically.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const L = {0:'0001101',1:'0011001',2:'0010011',3:'0111101',4:'0100011',5:'0110001',6:'0101111',7:'0111011',8:'0110111',9:'0001011'};
const G = {0:'0100111',1:'0110011',2:'0011011',3:'0100001',4:'0011101',5:'0111001',6:'0000101',7:'0010001',8:'0001001',9:'0010111'};
const R = {};
for (const k of Object.keys(L)) R[k] = L[k].split('').map(c => c === '0' ? '1' : '0').join('');
const PARITY = {0:'LLLLLL',1:'LLGLGG',2:'LLGGLG',3:'LLGGGL',4:'LGLLGG',5:'LGGLLG',6:'LGGGLL',7:'LGLGLG',8:'LGLGGL',9:'LGGLGL'};

function checkDigit(d12) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(d12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (s % 10)) % 10);
}
function ean13Bits(code) {
  const first = code[0], left = code.slice(1, 7), right = code.slice(7);
  let bits = '101';
  for (let i = 0; i < 6; i++) bits += (PARITY[first][i] === 'L' ? L[left[i]] : G[left[i]]);
  bits += '01010';
  for (const d of right) bits += R[d];
  return bits + '101';
}

const W = 1280, H = 720, FRAMES = 5;
const HEADER = Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420\n`);
const CHROMA = Buffer.alloc((W / 2) * (H / 2), 128);
const WHITE = 235, BLACK = 16;

function write(file, luma) {
  const out = fs.createWriteStream(file);
  out.write(HEADER);
  for (let i = 0; i < FRAMES; i++) { out.write(Buffer.from('FRAME\n')); out.write(luma); out.write(CHROMA); out.write(CHROMA); }
  out.end();
}

const base = '400638133393';
const code = base + checkDigit(base);
const bits = ean13Bits(code);
const MOD = 8, X0 = Math.floor((W - bits.length * MOD) / 2), TOP = 200, BAR_H = 320;

const barcode = Buffer.alloc(W * H, WHITE);
for (let i = 0; i < bits.length; i++) {
  if (bits[i] !== '1') continue;
  for (let x = X0 + i * MOD; x < X0 + (i + 1) * MOD; x++) {
    for (let y = TOP; y < TOP + BAR_H; y++) barcode[y * W + x] = BLACK;
  }
}

const dir = __dirname;
write(path.join(dir, 'barcode.y4m'), barcode);
write(path.join(dir, 'blank.y4m'), Buffer.alloc(W * H, WHITE));
fs.writeFileSync(path.join(dir, 'barcode.txt'), code);
console.log('Wrote barcode.y4m / blank.y4m for EAN-13 ' + code);
