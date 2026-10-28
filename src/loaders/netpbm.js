/**
 * Netpbm image decoder written from scratch (PBM family).
 *
 * The game stores its textures as PPM/PGM/PAM so no browser image decoding
 * (HTMLImageElement, canvas 2D, createImageBitmap) is needed.
 *
 * Supported formats:
 *   P2 / P5  grayscale (ASCII / binary)        -> 1 channel
 *   P3 / P6  RGB (ASCII / binary)              -> 3 channels
 *   P7       PAM with DEPTH 1..4 (e.g. RGBA)   -> DEPTH channels
 * 16-bit samples (MAXVAL > 255) are converted to 8 bits.
 *
 * Returns { width, height, channels, data: Uint8Array } with the first row
 * at the top of the image.
 */

export function parseNetpbm(buffer) {
  const bytes = new Uint8Array(buffer);
  let pos = 0;

  const isSpace = (c) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0b || c === 0x0c;

  const skipSpaceAndComments = () => {
    while (pos < bytes.length) {
      if (bytes[pos] === 0x23) { // '#'
        while (pos < bytes.length && bytes[pos] !== 0x0a) pos++;
      } else if (isSpace(bytes[pos])) {
        pos++;
      } else {
        break;
      }
    }
  };

  const readToken = () => {
    skipSpaceAndComments();
    const start = pos;
    while (pos < bytes.length && !isSpace(bytes[pos]) && bytes[pos] !== 0x23) pos++;
    let token = '';
    for (let i = start; i < pos; i++) token += String.fromCharCode(bytes[i]);
    return token;
  };

  // fast path for the ASCII rasters (P2 / P3): digits straight to integers
  const readInt = () => {
    skipSpaceAndComments();
    let value = 0;
    while (pos < bytes.length && bytes[pos] >= 0x30 && bytes[pos] <= 0x39) value = value * 10 + bytes[pos++] - 0x30;
    return value;
  };

  const readLine = () => {
    let line = '';
    while (pos < bytes.length && bytes[pos] !== 0x0a) line += String.fromCharCode(bytes[pos++]);
    pos++;
    return line.trim();
  };

  const magic = readToken();
  let width;
  let height;
  let maxVal;
  let channels;
  let binary = true;

  if (magic === 'P7') {
    readLine();
    const header = {};
    for (;;) {
      if (pos >= bytes.length) throw new Error('PAM: unterminated header');
      const line = readLine();
      if (!line || line.startsWith('#')) continue;
      if (line === 'ENDHDR') break;
      const [key, ...rest] = line.split(/\s+/);
      header[key] = rest.join(' ');
    }
    width = parseInt(header.WIDTH, 10);
    height = parseInt(header.HEIGHT, 10);
    channels = parseInt(header.DEPTH, 10);
    maxVal = parseInt(header.MAXVAL, 10);
  } else if (magic === 'P2' || magic === 'P3' || magic === 'P5' || magic === 'P6') {
    width = parseInt(readToken(), 10);
    height = parseInt(readToken(), 10);
    maxVal = parseInt(readToken(), 10);
    channels = magic === 'P2' || magic === 'P5' ? 1 : 3;
    binary = magic === 'P5' || magic === 'P6';
    if (binary) pos++; // exactly one whitespace byte separates header and raster
  } else {
    throw new Error(`Netpbm: unsupported format "${magic}"`);
  }

  if (!(width > 0 && height > 0 && channels > 0 && maxVal > 0)) {
    throw new Error('Netpbm: invalid header');
  }

  const sampleCount = width * height * channels;
  const data = new Uint8Array(sampleCount);
  const scale = 255 / maxVal;

  if (binary) {
    const bytesPerSample = maxVal > 255 ? 2 : 1;
    if (pos + sampleCount * bytesPerSample > bytes.length) throw new Error('Netpbm: truncated raster');
    if (bytesPerSample === 1 && maxVal === 255) {
      data.set(bytes.subarray(pos, pos + sampleCount));
    } else {
      for (let i = 0; i < sampleCount; i++) {
        const raw = bytesPerSample === 2
          ? (bytes[pos + i * 2] << 8) | bytes[pos + i * 2 + 1] // big-endian
          : bytes[pos + i];
        data[i] = Math.round(raw * scale);
      }
    }
  } else {
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.round(readInt() * scale);
    }
  }

  return { width, height, channels, data };
}
