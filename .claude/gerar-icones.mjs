/* Gera os ícones PNG do PWA sem dependência externa (zlib do próprio Node).
   Desenho: fundo branco-leite, uma flor de 5 pétalas em rosa-antigo com miolo
   dourado — o mesmo 🌸 da saudação, em forma de marca.
   Uso: node .claude/gerar-icones.mjs                                        */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

const COR_FUNDO   = [253, 251, 252];
const COR_PETALA  = [246, 203, 217];
const COR_BORDA   = [210, 100, 139];
const COR_MIOLO   = [227, 192, 138];

function crc32(buf) {
  let c, tabela = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = tabela[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}

function png(largura, altura, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // RGB
  const linhas = [];
  for (let y = 0; y < altura; y++) {
    linhas.push(Buffer.from([0]));
    linhas.push(pixels.subarray(y * largura * 3, (y + 1) * largura * 3));
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(linhas), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Amostragem 3×3 por pixel pra suavizar as bordas da flor. */
function desenhar(N) {
  const px = Buffer.alloc(N * N * 3);
  const c = N / 2;
  const rPetala = N * 0.185;      // raio de cada pétala
  const dPetala = N * 0.19;       // distância do centro até o centro da pétala
  const rMiolo  = N * 0.078;
  const AA = 3;

  const centros = [];
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    centros.push([c + Math.cos(a) * dPetala, c + Math.sin(a) * dPetala]);
  }

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < AA; sy++) {
        for (let sx = 0; sx < AA; sx++) {
          const px0 = x + (sx + 0.5) / AA;
          const py0 = y + (sy + 0.5) / AA;
          let cor = COR_FUNDO;

          for (const [cx, cy] of centros) {
            const d = Math.hypot(px0 - cx, py0 - cy);
            if (d <= rPetala) { cor = d > rPetala - N * 0.014 ? COR_BORDA : COR_PETALA; break; }
          }
          if (Math.hypot(px0 - c, py0 - c) <= rMiolo) cor = COR_MIOLO;

          acc[0] += cor[0]; acc[1] += cor[1]; acc[2] += cor[2];
        }
      }
      const n = AA * AA, i = (y * N + x) * 3;
      px[i] = Math.round(acc[0] / n);
      px[i + 1] = Math.round(acc[1] / n);
      px[i + 2] = Math.round(acc[2] / n);
    }
  }
  return px;
}

mkdirSync('icons', { recursive: true });
for (const [arq, N] of [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180]]) {
  writeFileSync(arq, png(N, N, desenhar(N)));
  console.log('ok', arq);
}
