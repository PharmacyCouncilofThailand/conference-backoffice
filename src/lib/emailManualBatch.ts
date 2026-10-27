// Email Manual sends recipients in small sequential chunks so each API
// request stays short (the API waits 700ms after every email).
export const EMAIL_MANUAL_CHUNK_SIZE = 20;

export function chunkIds(ids: number[], size: number): number[][] {
  if (size < 1) throw new RangeError('chunk size must be at least 1');
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

/** Rough wall-clock estimate: provider call plus the 700ms gap per email. */
export function estimateSendSeconds(count: number): number {
  return Math.ceil(count * 1.5);
}
