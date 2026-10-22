// A write's binary body. The binding takes any typed array or DataView as the
// bytes it views; a bare ArrayBuffer becomes a Buffer over the same memory,
// without a copy. The binding copies the bytes when the call starts, after
// this client's Store is open, so the caller must not change them until the
// call settles. Memory another thread can change (SharedArrayBuffer) and a
// transferred (detached) ArrayBuffer are refused. Other values pass unchanged.
import { types } from "node:util";
import { LayerFSError } from "../errors.js";

const refused = (what) => new LayerFSError("InvalidInput", `write bytes ${what} are not accepted`, null);

/** `value` checked when it is binary, an ArrayBuffer as a Buffer. */
export function body(value) {
  const view = ArrayBuffer.isView(value);
  if (!view && !types.isAnyArrayBuffer(value)) return value;
  const memory = view ? value.buffer : value;
  if (types.isSharedArrayBuffer(memory)) throw refused("in shared memory (SharedArrayBuffer)");
  if (memory.detached) throw refused("in a detached ArrayBuffer");
  if (view) return value;
  try {
    return Buffer.from(memory);
  } catch {
    // Node 20 has no `detached` flag; a detached ArrayBuffer throws here.
    throw refused("in a detached ArrayBuffer");
  }
}

/** One `fs.apply` change with its write body as `fs.write` sends it: binary
 * `content` travels as `bytes`. */
export function change(c) {
  if (c?.op !== "write") return c;
  if (c.content !== undefined && typeof c.content !== "string" && c.bytes === undefined) {
    const { content, ...rest } = c;
    return { ...rest, bytes: body(content) };
  }
  return c.bytes === undefined ? c : { ...c, bytes: body(c.bytes) };
}
