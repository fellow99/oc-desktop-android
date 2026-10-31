/**
 * lib/png.mjs —— 极简 PNG 解码（纯 Node，零三方依赖）。
 * 裁剪自 oc-desktop-hos/scripts/lib/branding.mjs（同作者流水线）：只支持 8bit 非隔行
 * PNG（Chrome headless 与父工程 logo.png 的输出格式），供品牌物料逐像素自证使用。
 */
import { inflateSync } from 'node:zlib'

function requireBool(condition, message) {
  if (!condition) throw new Error(message)
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** 解码 PNG → { width, height, rgba }；只支持 8bit 非隔行，其余一律硬失败（绝不产出错图） */
export function decodePng(bytes, label = '<buffer>') {
  requireBool(bytes.length > 8 && bytes.subarray(0, 8).equals(PNG_SIGNATURE), `不是 PNG（签名不符）: ${label}`);
  let header = null;
  let palette = null;
  let transparency = null;
  const idat = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') transparency = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  requireBool(header, `PNG 缺少 IHDR: ${label}`);
  requireBool(header.interlace === 0, `不支持隔行 PNG（interlace=${header.interlace}）: ${label}`);
  requireBool(header.compression === 0 && header.filter === 0, `PNG 压缩/过滤方法不支持: ${label}`);
  requireBool(
    header.bitDepth === 8,
    `仅支持 8bit PNG（bitDepth=${header.bitDepth}，colorType=${header.colorType}）: ${label}`,
  );
  requireBool(PNG_CHANNELS[header.colorType] !== undefined, `不支持的 PNG colorType=${header.colorType}: ${label}`);
  requireBool(idat.length > 0, `PNG 缺少 IDAT: ${label}`);
  const pixels = unfilter(inflateSync(Buffer.concat(idat)), header, label);
  return { width: header.width, height: header.height, rgba: toRgba(pixels, header, palette, transparency, label) };
}

function unfilter(raw, header, label) {
  const channels = PNG_CHANNELS[header.colorType];
  const stride = header.width * channels;
  requireBool(
    raw.length >= (stride + 1) * header.height,
    `PNG 像素数据不完整: ${label}（期望 ≥ ${(stride + 1) * header.height}，实际 ${raw.length}）`,
  );
  const out = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const at = y * stride;
    const prev = at - stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? out[at + x - channels] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = y > 0 && x >= channels ? out[prev + x - channels] : 0;
      let value = src[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      else requireBool(filter === 0, `不支持的 PNG 行过滤器 ${filter}: ${label}（行 ${y}）`);
      out[at + x] = value & 0xff;
    }
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function toRgba(pixels, header, palette, transparency, label) {
  const count = header.width * header.height;
  const out = Buffer.alloc(count * 4);
  if (header.colorType === 6) {
    pixels.copy(out);
    return out;
  }
  if (header.colorType === 2) {
    const key = transparency && transparency.length >= 6 ? [transparency.readUInt16BE(0), transparency.readUInt16BE(2), transparency.readUInt16BE(4)] : null;
    for (let i = 0; i < count; i += 1) {
      const r = pixels[i * 3];
      const g = pixels[i * 3 + 1];
      const b = pixels[i * 3 + 2];
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = key && r === key[0] && g === key[1] && b === key[2] ? 0 : 255;
    }
    return out;
  }
  if (header.colorType === 0) {
    const key = transparency && transparency.length >= 2 ? transparency.readUInt16BE(0) : null;
    for (let i = 0; i < count; i += 1) {
      const v = pixels[i];
      out[i * 4] = v;
      out[i * 4 + 1] = v;
      out[i * 4 + 2] = v;
      out[i * 4 + 3] = key !== null && v === key ? 0 : 255;
    }
    return out;
  }
  if (header.colorType === 4) {
    for (let i = 0; i < count; i += 1) {
      const v = pixels[i * 2];
      out[i * 4] = v;
      out[i * 4 + 1] = v;
      out[i * 4 + 2] = v;
      out[i * 4 + 3] = pixels[i * 2 + 1];
    }
    return out;
  }
  if (header.colorType === 3) {
    requireBool(palette, `调色板 PNG 缺少 PLTE: ${label}`);
    const size = palette.length / 3;
    requireBool(Number.isInteger(size), `PNG PLTE 长度非法: ${label}`);
    for (let i = 0; i < count; i += 1) {
      const index = pixels[i];
      requireBool(index < size, `调色板索引越界（${index} ≥ ${size}）: ${label}`);
      out[i * 4] = palette[index * 3];
      out[i * 4 + 1] = palette[index * 3 + 1];
      out[i * 4 + 2] = palette[index * 3 + 2];
      out[i * 4 + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    }
    return out;
  }
  throw new Error(`不支持的 PNG colorType=${header.colorType}: ${label}`);
}

