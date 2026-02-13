function De(t, i = "utf8") {
    return new TextDecoder(i).decode(t);
}
const kn = new TextEncoder();
function En(t) {
    return kn.encode(t);
}
const An = 1024 * 8, vn = (() => {
    const t = new Uint8Array(4), i = new Uint32Array(t.buffer);
    return !((i[0] = 1) & t[0]);
})(), Qt = {
    int8: globalThis.Int8Array,
    uint8: globalThis.Uint8Array,
    int16: globalThis.Int16Array,
    uint16: globalThis.Uint16Array,
    int32: globalThis.Int32Array,
    uint32: globalThis.Uint32Array,
    uint64: globalThis.BigUint64Array,
    int64: globalThis.BigInt64Array,
    float32: globalThis.Float32Array,
    float64: globalThis.Float64Array
};
class At {
    /**
     * Reference to the internal ArrayBuffer object.
     */
    buffer;
    /**
     * Byte length of the internal ArrayBuffer.
     */
    byteLength;
    /**
     * Byte offset of the internal ArrayBuffer.
     */
    byteOffset;
    /**
     * Byte length of the internal ArrayBuffer.
     */
    length;
    /**
     * The current offset of the buffer's pointer.
     */
    offset;
    lastWrittenByte;
    littleEndian;
    _data;
    _mark;
    _marks;
    /**
     * Create a new IOBuffer.
     * @param data - The data to construct the IOBuffer with.
     * If data is a number, it will be the new buffer's length<br>
     * If data is `undefined`, the buffer will be initialized with a default length of 8Kb<br>
     * If data is an ArrayBuffer, SharedArrayBuffer, an ArrayBufferView (Typed Array), an IOBuffer instance,
     * or a Node.js Buffer, a view will be created over the underlying ArrayBuffer.
     * @param options - An object for the options.
     * @returns A new IOBuffer instance.
     */
    constructor(i = An, e = {}) {
        let n = !1;
        typeof i == "number" ? i = new ArrayBuffer(i) : (n = !0, this.lastWrittenByte = i.byteLength);
        const r = e.offset ? e.offset >>> 0 : 0, a = i.byteLength - r;
        let h = r;
        (ArrayBuffer.isView(i) || i instanceof At) && (i.byteLength !== i.buffer.byteLength && (h = i.byteOffset + r), i = i.buffer), n ? this.lastWrittenByte = a : this.lastWrittenByte = 0, this.buffer = i, this.length = a, this.byteLength = a, this.byteOffset = h, this.offset = 0, this.littleEndian = !0, this._data = new DataView(this.buffer, h, a), this._mark = 0, this._marks = [];
    }
    /**
     * Checks if the memory allocated to the buffer is sufficient to store more
     * bytes after the offset.
     * @param byteLength - The needed memory in bytes.
     * @returns `true` if there is sufficient space and `false` otherwise.
     */
    available(i = 1) {
        return this.offset + i <= this.length;
    }
    /**
     * Check if little-endian mode is used for reading and writing multi-byte
     * values.
     * @returns `true` if little-endian mode is used, `false` otherwise.
     */
    isLittleEndian() {
        return this.littleEndian;
    }
    /**
     * Set little-endian mode for reading and writing multi-byte values.
     * @returns This.
     */
    setLittleEndian() {
        return this.littleEndian = !0, this;
    }
    /**
     * Check if big-endian mode is used for reading and writing multi-byte values.
     * @returns `true` if big-endian mode is used, `false` otherwise.
     */
    isBigEndian() {
        return !this.littleEndian;
    }
    /**
     * Switches to big-endian mode for reading and writing multi-byte values.
     * @returns This.
     */
    setBigEndian() {
        return this.littleEndian = !1, this;
    }
    /**
     * Move the pointer n bytes forward.
     * @param n - Number of bytes to skip.
     * @returns This.
     */
    skip(i = 1) {
        return this.offset += i, this;
    }
    /**
     * Move the pointer n bytes backward.
     * @param n - Number of bytes to move back.
     * @returns This.
     */
    back(i = 1) {
        return this.offset -= i, this;
    }
    /**
     * Move the pointer to the given offset.
     * @param offset - The offset to move to.
     * @returns This.
     */
    seek(i) {
        return this.offset = i, this;
    }
    /**
     * Store the current pointer offset.
     * @see {@link IOBuffer#reset}
     * @returns This.
     */
    mark() {
        return this._mark = this.offset, this;
    }
    /**
     * Move the pointer back to the last pointer offset set by mark.
     * @see {@link IOBuffer#mark}
     * @returns This.
     */
    reset() {
        return this.offset = this._mark, this;
    }
    /**
     * Push the current pointer offset to the mark stack.
     * @see {@link IOBuffer#popMark}
     * @returns This.
     */
    pushMark() {
        return this._marks.push(this.offset), this;
    }
    /**
     * Pop the last pointer offset from the mark stack, and set the current
     * pointer offset to the popped value.
     * @see {@link IOBuffer#pushMark}
     * @returns This.
     */
    popMark() {
        const i = this._marks.pop();
        if (i === void 0)
            throw new Error("Mark stack empty");
        return this.seek(i), this;
    }
    /**
     * Move the pointer offset back to 0.
     * @returns This.
     */
    rewind() {
        return this.offset = 0, this;
    }
    /**
     * Make sure the buffer has sufficient memory to write a given byteLength at
     * the current pointer offset.
     * If the buffer's memory is insufficient, this method will create a new
     * buffer (a copy) with a length that is twice (byteLength + current offset).
     * @param byteLength - The needed memory in bytes.
     * @returns This.
     */
    ensureAvailable(i = 1) {
        if (!this.available(i)) {
            const n = (this.offset + i) * 2, r = new Uint8Array(n);
            r.set(new Uint8Array(this.buffer)), this.buffer = r.buffer, this.length = n, this.byteLength = n, this._data = new DataView(this.buffer);
        }
        return this;
    }
    /**
     * Read a byte and return false if the byte's value is 0, or true otherwise.
     * Moves pointer forward by one byte.
     * @returns The read boolean.
     */
    readBoolean() {
        return this.readUint8() !== 0;
    }
    /**
     * Read a signed 8-bit integer and move pointer forward by 1 byte.
     * @returns The read byte.
     */
    readInt8() {
        return this._data.getInt8(this.offset++);
    }
    /**
     * Read an unsigned 8-bit integer and move pointer forward by 1 byte.
     * @returns The read byte.
     */
    readUint8() {
        return this._data.getUint8(this.offset++);
    }
    /**
     * Alias for {@link IOBuffer#readUint8}.
     * @returns The read byte.
     */
    readByte() {
        return this.readUint8();
    }
    /**
     * Read `n` bytes and move pointer forward by `n` bytes.
     * @param n - Number of bytes to read.
     * @returns The read bytes.
     */
    readBytes(i = 1) {
        return this.readArray(i, "uint8");
    }
    /**
     * Creates an array of corresponding to the type `type` and size `size`.
     * For example, type `uint8` will create a `Uint8Array`.
     * @param size - size of the resulting array
     * @param type - number type of elements to read
     * @returns The read array.
     */
    readArray(i, e) {
        const n = Qt[e].BYTES_PER_ELEMENT * i, r = this.byteOffset + this.offset, a = this.buffer.slice(r, r + n);
        if (this.littleEndian === vn && e !== "uint8" && e !== "int8") {
            const o = new Uint8Array(this.buffer.slice(r, r + n));
            o.reverse();
            const d = new Qt[e](o.buffer);
            return this.offset += n, d.reverse(), d;
        }
        const h = new Qt[e](a);
        return this.offset += n, h;
    }
    /**
     * Read a 16-bit signed integer and move pointer forward by 2 bytes.
     * @returns The read value.
     */
    readInt16() {
        const i = this._data.getInt16(this.offset, this.littleEndian);
        return this.offset += 2, i;
    }
    /**
     * Read a 16-bit unsigned integer and move pointer forward by 2 bytes.
     * @returns The read value.
     */
    readUint16() {
        const i = this._data.getUint16(this.offset, this.littleEndian);
        return this.offset += 2, i;
    }
    /**
     * Read a 32-bit signed integer and move pointer forward by 4 bytes.
     * @returns The read value.
     */
    readInt32() {
        const i = this._data.getInt32(this.offset, this.littleEndian);
        return this.offset += 4, i;
    }
    /**
     * Read a 32-bit unsigned integer and move pointer forward by 4 bytes.
     * @returns The read value.
     */
    readUint32() {
        const i = this._data.getUint32(this.offset, this.littleEndian);
        return this.offset += 4, i;
    }
    /**
     * Read a 32-bit floating number and move pointer forward by 4 bytes.
     * @returns The read value.
     */
    readFloat32() {
        const i = this._data.getFloat32(this.offset, this.littleEndian);
        return this.offset += 4, i;
    }
    /**
     * Read a 64-bit floating number and move pointer forward by 8 bytes.
     * @returns The read value.
     */
    readFloat64() {
        const i = this._data.getFloat64(this.offset, this.littleEndian);
        return this.offset += 8, i;
    }
    /**
     * Read a 64-bit signed integer number and move pointer forward by 8 bytes.
     * @returns The read value.
     */
    readBigInt64() {
        const i = this._data.getBigInt64(this.offset, this.littleEndian);
        return this.offset += 8, i;
    }
    /**
     * Read a 64-bit unsigned integer number and move pointer forward by 8 bytes.
     * @returns The read value.
     */
    readBigUint64() {
        const i = this._data.getBigUint64(this.offset, this.littleEndian);
        return this.offset += 8, i;
    }
    /**
     * Read a 1-byte ASCII character and move pointer forward by 1 byte.
     * @returns The read character.
     */
    readChar() {
        return String.fromCharCode(this.readInt8());
    }
    /**
     * Read `n` 1-byte ASCII characters and move pointer forward by `n` bytes.
     * @param n - Number of characters to read.
     * @returns The read characters.
     */
    readChars(i = 1) {
        let e = "";
        for (let n = 0; n < i; n++)
            e += this.readChar();
        return e;
    }
    /**
     * Read the next `n` bytes, return a UTF-8 decoded string and move pointer
     * forward by `n` bytes.
     * @param n - Number of bytes to read.
     * @returns The decoded string.
     */
    readUtf8(i = 1) {
        return De(this.readBytes(i));
    }
    /**
     * Read the next `n` bytes, return a string decoded with `encoding` and move pointer
     * forward by `n` bytes.
     * If no encoding is passed, the function is equivalent to @see {@link IOBuffer#readUtf8}
     * @param n - Number of bytes to read.
     * @param encoding - The encoding to use. Default is 'utf8'.
     * @returns The decoded string.
     */
    decodeText(i = 1, e = "utf8") {
        return De(this.readBytes(i), e);
    }
    /**
     * Write 0xff if the passed value is truthy, 0x00 otherwise and move pointer
     * forward by 1 byte.
     * @param value - The value to write.
     * @returns This.
     */
    writeBoolean(i) {
        return this.writeUint8(i ? 255 : 0), this;
    }
    /**
     * Write `value` as an 8-bit signed integer and move pointer forward by 1 byte.
     * @param value - The value to write.
     * @returns This.
     */
    writeInt8(i) {
        return this.ensureAvailable(1), this._data.setInt8(this.offset++, i), this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as an 8-bit unsigned integer and move pointer forward by 1
     * byte.
     * @param value - The value to write.
     * @returns This.
     */
    writeUint8(i) {
        return this.ensureAvailable(1), this._data.setUint8(this.offset++, i), this._updateLastWrittenByte(), this;
    }
    /**
     * An alias for {@link IOBuffer#writeUint8}.
     * @param value - The value to write.
     * @returns This.
     */
    writeByte(i) {
        return this.writeUint8(i);
    }
    /**
     * Write all elements of `bytes` as uint8 values and move pointer forward by
     * `bytes.length` bytes.
     * @param bytes - The array of bytes to write.
     * @returns This.
     */
    writeBytes(i) {
        this.ensureAvailable(i.length);
        for (let e = 0; e < i.length; e++)
            this._data.setUint8(this.offset++, i[e]);
        return this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 16-bit signed integer and move pointer forward by 2
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeInt16(i) {
        return this.ensureAvailable(2), this._data.setInt16(this.offset, i, this.littleEndian), this.offset += 2, this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 16-bit unsigned integer and move pointer forward by 2
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeUint16(i) {
        return this.ensureAvailable(2), this._data.setUint16(this.offset, i, this.littleEndian), this.offset += 2, this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 32-bit signed integer and move pointer forward by 4
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeInt32(i) {
        return this.ensureAvailable(4), this._data.setInt32(this.offset, i, this.littleEndian), this.offset += 4, this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 32-bit unsigned integer and move pointer forward by 4
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeUint32(i) {
        return this.ensureAvailable(4), this._data.setUint32(this.offset, i, this.littleEndian), this.offset += 4, this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 32-bit floating number and move pointer forward by 4
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeFloat32(i) {
        return this.ensureAvailable(4), this._data.setFloat32(this.offset, i, this.littleEndian), this.offset += 4, this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 64-bit floating number and move pointer forward by 8
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeFloat64(i) {
        return this.ensureAvailable(8), this._data.setFloat64(this.offset, i, this.littleEndian), this.offset += 8, this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 64-bit signed bigint and move pointer forward by 8
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeBigInt64(i) {
        return this.ensureAvailable(8), this._data.setBigInt64(this.offset, i, this.littleEndian), this.offset += 8, this._updateLastWrittenByte(), this;
    }
    /**
     * Write `value` as a 64-bit unsigned bigint and move pointer forward by 8
     * bytes.
     * @param value - The value to write.
     * @returns This.
     */
    writeBigUint64(i) {
        return this.ensureAvailable(8), this._data.setBigUint64(this.offset, i, this.littleEndian), this.offset += 8, this._updateLastWrittenByte(), this;
    }
    /**
     * Write the charCode of `str`'s first character as an 8-bit unsigned integer
     * and move pointer forward by 1 byte.
     * @param str - The character to write.
     * @returns This.
     */
    writeChar(i) {
        return this.writeUint8(i.charCodeAt(0));
    }
    /**
     * Write the charCodes of all `str`'s characters as 8-bit unsigned integers
     * and move pointer forward by `str.length` bytes.
     * @param str - The characters to write.
     * @returns This.
     */
    writeChars(i) {
        for (let e = 0; e < i.length; e++)
            this.writeUint8(i.charCodeAt(e));
        return this;
    }
    /**
     * UTF-8 encode and write `str` to the current pointer offset and move pointer
     * forward according to the encoded length.
     * @param str - The string to write.
     * @returns This.
     */
    writeUtf8(i) {
        return this.writeBytes(En(i));
    }
    /**
     * Export a Uint8Array view of the internal buffer.
     * The view starts at the byte offset and its length
     * is calculated to stop at the last written byte or the original length.
     * @returns A new Uint8Array view.
     */
    toArray() {
        return new Uint8Array(this.buffer, this.byteOffset, this.lastWrittenByte);
    }
    /**
     *  Get the total number of bytes written so far, regardless of the current offset.
     * @returns - Total number of bytes.
     */
    getWrittenByteLength() {
        return this.lastWrittenByte - this.byteOffset;
    }
    /**
     * Update the last written byte offset
     * @private
     */
    _updateLastWrittenByte() {
        this.offset > this.lastWrittenByte && (this.lastWrittenByte = this.offset);
    }
}
/*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */
const mn = 4, Ne = 0, Ce = 1, Sn = 2;
function _t(t) {
    let i = t.length;
    for (; --i >= 0; )
        t[i] = 0;
}
const Un = 0, vi = 1, Tn = 2, On = 3, Rn = 258, me = 29, Nt = 256, vt = Nt + 1 + me, ft = 30, Se = 19, mi = 2 * vt + 1, tt = 15, te = 16, Dn = 7, Ue = 256, Si = 16, Ui = 17, Ti = 18, pe = (
    /* extra bits for each length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
), Pt = (
    /* extra bits for each distance code */
    new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
), Nn = (
    /* extra bits for each bit length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
), Oi = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]), Cn = 512, W = new Array((vt + 2) * 2);
_t(W);
const xt = new Array(ft * 2);
_t(xt);
const mt = new Array(Cn);
_t(mt);
const St = new Array(Rn - On + 1);
_t(St);
const Te = new Array(me);
_t(Te);
const Wt = new Array(ft);
_t(Wt);
function ee(t, i, e, n, r) {
    this.static_tree = t, this.extra_bits = i, this.extra_base = e, this.elems = n, this.max_length = r, this.has_stree = t && t.length;
}
let Ri, Di, Ni;
function ie(t, i) {
    this.dyn_tree = t, this.max_code = 0, this.stat_desc = i;
}
const Ci = (t) => t < 256 ? mt[t] : mt[256 + (t >>> 7)], Ut = (t, i) => {
    t.pending_buf[t.pending++] = i & 255, t.pending_buf[t.pending++] = i >>> 8 & 255;
}, z = (t, i, e) => {
    t.bi_valid > te - e ? (t.bi_buf |= i << t.bi_valid & 65535, Ut(t, t.bi_buf), t.bi_buf = i >> te - t.bi_valid, t.bi_valid += e - te) : (t.bi_buf |= i << t.bi_valid & 65535, t.bi_valid += e);
}, F = (t, i, e) => {
    z(
        t,
        e[i * 2],
        e[i * 2 + 1]
        /*.Len*/
    );
}, Ii = (t, i) => {
    let e = 0;
    do
        e |= t & 1, t >>>= 1, e <<= 1;
    while (--i > 0);
    return e >>> 1;
}, In = (t) => {
    t.bi_valid === 16 ? (Ut(t, t.bi_buf), t.bi_buf = 0, t.bi_valid = 0) : t.bi_valid >= 8 && (t.pending_buf[t.pending++] = t.bi_buf & 255, t.bi_buf >>= 8, t.bi_valid -= 8);
}, zn = (t, i) => {
    const e = i.dyn_tree, n = i.max_code, r = i.stat_desc.static_tree, a = i.stat_desc.has_stree, h = i.stat_desc.extra_bits, o = i.stat_desc.extra_base, d = i.stat_desc.max_length;
    let s, l, u, c, f, p, U = 0;
    for (c = 0; c <= tt; c++)
        t.bl_count[c] = 0;
    for (e[t.heap[t.heap_max] * 2 + 1] = 0, s = t.heap_max + 1; s < mi; s++)
        l = t.heap[s], c = e[e[l * 2 + 1] * 2 + 1] + 1, c > d && (c = d, U++), e[l * 2 + 1] = c, !(l > n) && (t.bl_count[c]++, f = 0, l >= o && (f = h[l - o]), p = e[l * 2], t.opt_len += p * (c + f), a && (t.static_len += p * (r[l * 2 + 1] + f)));
    if (U !== 0) {
        do {
            for (c = d - 1; t.bl_count[c] === 0; )
                c--;
            t.bl_count[c]--, t.bl_count[c + 1] += 2, t.bl_count[d]--, U -= 2;
        } while (U > 0);
        for (c = d; c !== 0; c--)
            for (l = t.bl_count[c]; l !== 0; )
                u = t.heap[--s], !(u > n) && (e[u * 2 + 1] !== c && (t.opt_len += (c - e[u * 2 + 1]) * e[u * 2], e[u * 2 + 1] = c), l--);
    }
}, zi = (t, i, e) => {
    const n = new Array(tt + 1);
    let r = 0, a, h;
    for (a = 1; a <= tt; a++)
        r = r + e[a - 1] << 1, n[a] = r;
    for (h = 0; h <= i; h++) {
        let o = t[h * 2 + 1];
        o !== 0 && (t[h * 2] = Ii(n[o]++, o));
    }
}, Ln = () => {
    let t, i, e, n, r;
    const a = new Array(tt + 1);
    for (e = 0, n = 0; n < me - 1; n++)
        for (Te[n] = e, t = 0; t < 1 << pe[n]; t++)
            St[e++] = n;
    for (St[e - 1] = n, r = 0, n = 0; n < 16; n++)
        for (Wt[n] = r, t = 0; t < 1 << Pt[n]; t++)
            mt[r++] = n;
    for (r >>= 7; n < ft; n++)
        for (Wt[n] = r << 7, t = 0; t < 1 << Pt[n] - 7; t++)
            mt[256 + r++] = n;
    for (i = 0; i <= tt; i++)
        a[i] = 0;
    for (t = 0; t <= 143; )
        W[t * 2 + 1] = 8, t++, a[8]++;
    for (; t <= 255; )
        W[t * 2 + 1] = 9, t++, a[9]++;
    for (; t <= 279; )
        W[t * 2 + 1] = 7, t++, a[7]++;
    for (; t <= 287; )
        W[t * 2 + 1] = 8, t++, a[8]++;
    for (zi(W, vt + 1, a), t = 0; t < ft; t++)
        xt[t * 2 + 1] = 5, xt[t * 2] = Ii(t, 5);
    Ri = new ee(W, pe, Nt + 1, vt, tt), Di = new ee(xt, Pt, 0, ft, tt), Ni = new ee(new Array(0), Nn, 0, Se, Dn);
}, Li = (t) => {
    let i;
    for (i = 0; i < vt; i++)
        t.dyn_ltree[i * 2] = 0;
    for (i = 0; i < ft; i++)
        t.dyn_dtree[i * 2] = 0;
    for (i = 0; i < Se; i++)
        t.bl_tree[i * 2] = 0;
    t.dyn_ltree[Ue * 2] = 1, t.opt_len = t.static_len = 0, t.sym_next = t.matches = 0;
}, Bi = (t) => {
    t.bi_valid > 8 ? Ut(t, t.bi_buf) : t.bi_valid > 0 && (t.pending_buf[t.pending++] = t.bi_buf), t.bi_buf = 0, t.bi_valid = 0;
}, Ie = (t, i, e, n) => {
    const r = i * 2, a = e * 2;
    return t[r] < t[a] || t[r] === t[a] && n[i] <= n[e];
}, ne = (t, i, e) => {
    const n = t.heap[e];
    let r = e << 1;
    for (; r <= t.heap_len && (r < t.heap_len && Ie(i, t.heap[r + 1], t.heap[r], t.depth) && r++, !Ie(i, n, t.heap[r], t.depth)); )
        t.heap[e] = t.heap[r], e = r, r <<= 1;
    t.heap[e] = n;
}, ze = (t, i, e) => {
    let n, r, a = 0, h, o;
    if (t.sym_next !== 0)
        do
            n = t.pending_buf[t.sym_buf + a++] & 255, n += (t.pending_buf[t.sym_buf + a++] & 255) << 8, r = t.pending_buf[t.sym_buf + a++], n === 0 ? F(t, r, i) : (h = St[r], F(t, h + Nt + 1, i), o = pe[h], o !== 0 && (r -= Te[h], z(t, r, o)), n--, h = Ci(n), F(t, h, e), o = Pt[h], o !== 0 && (n -= Wt[h], z(t, n, o)));
        while (a < t.sym_next);
    F(t, Ue, i);
}, we = (t, i) => {
    const e = i.dyn_tree, n = i.stat_desc.static_tree, r = i.stat_desc.has_stree, a = i.stat_desc.elems;
    let h, o, d = -1, s;
    for (t.heap_len = 0, t.heap_max = mi, h = 0; h < a; h++)
        e[h * 2] !== 0 ? (t.heap[++t.heap_len] = d = h, t.depth[h] = 0) : e[h * 2 + 1] = 0;
    for (; t.heap_len < 2; )
        s = t.heap[++t.heap_len] = d < 2 ? ++d : 0, e[s * 2] = 1, t.depth[s] = 0, t.opt_len--, r && (t.static_len -= n[s * 2 + 1]);
    for (i.max_code = d, h = t.heap_len >> 1; h >= 1; h--)
        ne(t, e, h);
    s = a;
    do
        h = t.heap[
            1
            /*SMALLEST*/
            ], t.heap[
            1
            /*SMALLEST*/
            ] = t.heap[t.heap_len--], ne(
            t,
            e,
            1
            /*SMALLEST*/
        ), o = t.heap[
            1
            /*SMALLEST*/
            ], t.heap[--t.heap_max] = h, t.heap[--t.heap_max] = o, e[s * 2] = e[h * 2] + e[o * 2], t.depth[s] = (t.depth[h] >= t.depth[o] ? t.depth[h] : t.depth[o]) + 1, e[h * 2 + 1] = e[o * 2 + 1] = s, t.heap[
            1
            /*SMALLEST*/
            ] = s++, ne(
            t,
            e,
            1
            /*SMALLEST*/
        );
    while (t.heap_len >= 2);
    t.heap[--t.heap_max] = t.heap[
        1
        /*SMALLEST*/
        ], zn(t, i), zi(e, d, t.bl_count);
}, Le = (t, i, e) => {
    let n, r = -1, a, h = i[1], o = 0, d = 7, s = 4;
    for (h === 0 && (d = 138, s = 3), i[(e + 1) * 2 + 1] = 65535, n = 0; n <= e; n++)
        a = h, h = i[(n + 1) * 2 + 1], !(++o < d && a === h) && (o < s ? t.bl_tree[a * 2] += o : a !== 0 ? (a !== r && t.bl_tree[a * 2]++, t.bl_tree[Si * 2]++) : o <= 10 ? t.bl_tree[Ui * 2]++ : t.bl_tree[Ti * 2]++, o = 0, r = a, h === 0 ? (d = 138, s = 3) : a === h ? (d = 6, s = 3) : (d = 7, s = 4));
}, Be = (t, i, e) => {
    let n, r = -1, a, h = i[1], o = 0, d = 7, s = 4;
    for (h === 0 && (d = 138, s = 3), n = 0; n <= e; n++)
        if (a = h, h = i[(n + 1) * 2 + 1], !(++o < d && a === h)) {
            if (o < s)
                do
                    F(t, a, t.bl_tree);
                while (--o !== 0);
            else a !== 0 ? (a !== r && (F(t, a, t.bl_tree), o--), F(t, Si, t.bl_tree), z(t, o - 3, 2)) : o <= 10 ? (F(t, Ui, t.bl_tree), z(t, o - 3, 3)) : (F(t, Ti, t.bl_tree), z(t, o - 11, 7));
            o = 0, r = a, h === 0 ? (d = 138, s = 3) : a === h ? (d = 6, s = 3) : (d = 7, s = 4);
        }
}, Bn = (t) => {
    let i;
    for (Le(t, t.dyn_ltree, t.l_desc.max_code), Le(t, t.dyn_dtree, t.d_desc.max_code), we(t, t.bl_desc), i = Se - 1; i >= 3 && t.bl_tree[Oi[i] * 2 + 1] === 0; i--)
        ;
    return t.opt_len += 3 * (i + 1) + 5 + 5 + 4, i;
}, Mn = (t, i, e, n) => {
    let r;
    for (z(t, i - 257, 5), z(t, e - 1, 5), z(t, n - 4, 4), r = 0; r < n; r++)
        z(t, t.bl_tree[Oi[r] * 2 + 1], 3);
    Be(t, t.dyn_ltree, i - 1), Be(t, t.dyn_dtree, e - 1);
}, Zn = (t) => {
    let i = 4093624447, e;
    for (e = 0; e <= 31; e++, i >>>= 1)
        if (i & 1 && t.dyn_ltree[e * 2] !== 0)
            return Ne;
    if (t.dyn_ltree[18] !== 0 || t.dyn_ltree[20] !== 0 || t.dyn_ltree[26] !== 0)
        return Ce;
    for (e = 32; e < Nt; e++)
        if (t.dyn_ltree[e * 2] !== 0)
            return Ce;
    return Ne;
};
let Me = !1;
const $n = (t) => {
    Me || (Ln(), Me = !0), t.l_desc = new ie(t.dyn_ltree, Ri), t.d_desc = new ie(t.dyn_dtree, Di), t.bl_desc = new ie(t.bl_tree, Ni), t.bi_buf = 0, t.bi_valid = 0, Li(t);
}, Mi = (t, i, e, n) => {
    z(t, (Un << 1) + (n ? 1 : 0), 3), Bi(t), Ut(t, e), Ut(t, ~e), e && t.pending_buf.set(t.window.subarray(i, i + e), t.pending), t.pending += e;
}, Fn = (t) => {
    z(t, vi << 1, 3), F(t, Ue, W), In(t);
}, Hn = (t, i, e, n) => {
    let r, a, h = 0;
    t.level > 0 ? (t.strm.data_type === Sn && (t.strm.data_type = Zn(t)), we(t, t.l_desc), we(t, t.d_desc), h = Bn(t), r = t.opt_len + 3 + 7 >>> 3, a = t.static_len + 3 + 7 >>> 3, a <= r && (r = a)) : r = a = e + 5, e + 4 <= r && i !== -1 ? Mi(t, i, e, n) : t.strategy === mn || a === r ? (z(t, (vi << 1) + (n ? 1 : 0), 3), ze(t, W, xt)) : (z(t, (Tn << 1) + (n ? 1 : 0), 3), Mn(t, t.l_desc.max_code + 1, t.d_desc.max_code + 1, h + 1), ze(t, t.dyn_ltree, t.dyn_dtree)), Li(t), n && Bi(t);
}, Pn = (t, i, e) => (t.pending_buf[t.sym_buf + t.sym_next++] = i, t.pending_buf[t.sym_buf + t.sym_next++] = i >> 8, t.pending_buf[t.sym_buf + t.sym_next++] = e, i === 0 ? t.dyn_ltree[e * 2]++ : (t.matches++, i--, t.dyn_ltree[(St[e] + Nt + 1) * 2]++, t.dyn_dtree[Ci(i) * 2]++), t.sym_next === t.sym_end);
var Kn = $n, Wn = Mi, Yn = Hn, Gn = Pn, Xn = Fn, jn = {
    _tr_init: Kn,
    _tr_stored_block: Wn,
    _tr_flush_block: Yn,
    _tr_tally: Gn,
    _tr_align: Xn
};
const Vn = (t, i, e, n) => {
    let r = t & 65535 | 0, a = t >>> 16 & 65535 | 0, h = 0;
    for (; e !== 0; ) {
        h = e > 2e3 ? 2e3 : e, e -= h;
        do
            r = r + i[n++] | 0, a = a + r | 0;
        while (--h);
        r %= 65521, a %= 65521;
    }
    return r | a << 16 | 0;
};
var Tt = Vn;
const qn = () => {
    let t, i = [];
    for (var e = 0; e < 256; e++) {
        t = e;
        for (var n = 0; n < 8; n++)
            t = t & 1 ? 3988292384 ^ t >>> 1 : t >>> 1;
        i[e] = t;
    }
    return i;
}, Jn = new Uint32Array(qn()), Qn = (t, i, e, n) => {
    const r = Jn, a = n + e;
    t ^= -1;
    for (let h = n; h < a; h++)
        t = t >>> 8 ^ r[(t ^ i[h]) & 255];
    return t ^ -1;
};
var N = Qn, nt = {
    2: "need dictionary",
    /* Z_NEED_DICT       2  */
    1: "stream end",
    /* Z_STREAM_END      1  */
    0: "",
    /* Z_OK              0  */
    "-1": "file error",
    /* Z_ERRNO         (-1) */
    "-2": "stream error",
    /* Z_STREAM_ERROR  (-2) */
    "-3": "data error",
    /* Z_DATA_ERROR    (-3) */
    "-4": "insufficient memory",
    /* Z_MEM_ERROR     (-4) */
    "-5": "buffer error",
    /* Z_BUF_ERROR     (-5) */
    "-6": "incompatible version"
    /* Z_VERSION_ERROR (-6) */
}, Xt = {
    /* Allowed flush values; see deflate() and inflate() below for details */
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    /* Return codes for the compression/decompression functions. Negative values
    * are errors, positive values are used for special but normal events.
    */
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN: 2,
    /* The deflate compression method */
    Z_DEFLATED: 8
    //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
const { _tr_init: ta, _tr_stored_block: ge, _tr_flush_block: ea, _tr_tally: V, _tr_align: ia } = jn, {
    Z_NO_FLUSH: q,
    Z_PARTIAL_FLUSH: na,
    Z_FULL_FLUSH: aa,
    Z_FINISH: M,
    Z_BLOCK: Ze,
    Z_OK: C,
    Z_STREAM_END: $e,
    Z_STREAM_ERROR: H,
    Z_DATA_ERROR: ra,
    Z_BUF_ERROR: ae,
    Z_DEFAULT_COMPRESSION: sa,
    Z_FILTERED: oa,
    Z_HUFFMAN_ONLY: Bt,
    Z_RLE: ha,
    Z_FIXED: la,
    Z_DEFAULT_STRATEGY: fa,
    Z_UNKNOWN: da,
    Z_DEFLATED: jt
} = Xt, ca = 9, _a = 15, ua = 8, pa = 29, wa = 256, be = wa + 1 + pa, ga = 30, ba = 19, xa = 2 * be + 1, ya = 15, A = 3, j = 258, P = j + A + 1, ka = 32, dt = 42, Oe = 57, xe = 69, ye = 73, ke = 91, Ee = 103, et = 113, gt = 666, I = 1, ut = 2, at = 3, pt = 4, Ea = 3, it = (t, i) => (t.msg = nt[i], i), Fe = (t) => t * 2 - (t > 4 ? 9 : 0), G = (t) => {
    let i = t.length;
    for (; --i >= 0; )
        t[i] = 0;
}, Aa = (t) => {
    let i, e, n, r = t.w_size;
    i = t.hash_size, n = i;
    do
        e = t.head[--n], t.head[n] = e >= r ? e - r : 0;
    while (--i);
    i = r, n = i;
    do
        e = t.prev[--n], t.prev[n] = e >= r ? e - r : 0;
    while (--i);
};
let va = (t, i, e) => (i << t.hash_shift ^ e) & t.hash_mask, J = va;
const L = (t) => {
    const i = t.state;
    let e = i.pending;
    e > t.avail_out && (e = t.avail_out), e !== 0 && (t.output.set(i.pending_buf.subarray(i.pending_out, i.pending_out + e), t.next_out), t.next_out += e, i.pending_out += e, t.total_out += e, t.avail_out -= e, i.pending -= e, i.pending === 0 && (i.pending_out = 0));
}, B = (t, i) => {
    ea(t, t.block_start >= 0 ? t.block_start : -1, t.strstart - t.block_start, i), t.block_start = t.strstart, L(t.strm);
}, S = (t, i) => {
    t.pending_buf[t.pending++] = i;
}, wt = (t, i) => {
    t.pending_buf[t.pending++] = i >>> 8 & 255, t.pending_buf[t.pending++] = i & 255;
}, Ae = (t, i, e, n) => {
    let r = t.avail_in;
    return r > n && (r = n), r === 0 ? 0 : (t.avail_in -= r, i.set(t.input.subarray(t.next_in, t.next_in + r), e), t.state.wrap === 1 ? t.adler = Tt(t.adler, i, r, e) : t.state.wrap === 2 && (t.adler = N(t.adler, i, r, e)), t.next_in += r, t.total_in += r, r);
}, Zi = (t, i) => {
    let e = t.max_chain_length, n = t.strstart, r, a, h = t.prev_length, o = t.nice_match;
    const d = t.strstart > t.w_size - P ? t.strstart - (t.w_size - P) : 0, s = t.window, l = t.w_mask, u = t.prev, c = t.strstart + j;
    let f = s[n + h - 1], p = s[n + h];
    t.prev_length >= t.good_match && (e >>= 2), o > t.lookahead && (o = t.lookahead);
    do
        if (r = i, !(s[r + h] !== p || s[r + h - 1] !== f || s[r] !== s[n] || s[++r] !== s[n + 1])) {
            n += 2, r++;
            do
                ;
            while (s[++n] === s[++r] && s[++n] === s[++r] && s[++n] === s[++r] && s[++n] === s[++r] && s[++n] === s[++r] && s[++n] === s[++r] && s[++n] === s[++r] && s[++n] === s[++r] && n < c);
            if (a = j - (c - n), n = c - j, a > h) {
                if (t.match_start = i, h = a, a >= o)
                    break;
                f = s[n + h - 1], p = s[n + h];
            }
        }
    while ((i = u[i & l]) > d && --e !== 0);
    return h <= t.lookahead ? h : t.lookahead;
}, ct = (t) => {
    const i = t.w_size;
    let e, n, r;
    do {
        if (n = t.window_size - t.lookahead - t.strstart, t.strstart >= i + (i - P) && (t.window.set(t.window.subarray(i, i + i - n), 0), t.match_start -= i, t.strstart -= i, t.block_start -= i, t.insert > t.strstart && (t.insert = t.strstart), Aa(t), n += i), t.strm.avail_in === 0)
            break;
        if (e = Ae(t.strm, t.window, t.strstart + t.lookahead, n), t.lookahead += e, t.lookahead + t.insert >= A)
            for (r = t.strstart - t.insert, t.ins_h = t.window[r], t.ins_h = J(t, t.ins_h, t.window[r + 1]); t.insert && (t.ins_h = J(t, t.ins_h, t.window[r + A - 1]), t.prev[r & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = r, r++, t.insert--, !(t.lookahead + t.insert < A)); )
                ;
    } while (t.lookahead < P && t.strm.avail_in !== 0);
}, $i = (t, i) => {
    let e = t.pending_buf_size - 5 > t.w_size ? t.w_size : t.pending_buf_size - 5, n, r, a, h = 0, o = t.strm.avail_in;
    do {
        if (n = 65535, a = t.bi_valid + 42 >> 3, t.strm.avail_out < a || (a = t.strm.avail_out - a, r = t.strstart - t.block_start, n > r + t.strm.avail_in && (n = r + t.strm.avail_in), n > a && (n = a), n < e && (n === 0 && i !== M || i === q || n !== r + t.strm.avail_in)))
            break;
        h = i === M && n === r + t.strm.avail_in ? 1 : 0, ge(t, 0, 0, h), t.pending_buf[t.pending - 4] = n, t.pending_buf[t.pending - 3] = n >> 8, t.pending_buf[t.pending - 2] = ~n, t.pending_buf[t.pending - 1] = ~n >> 8, L(t.strm), r && (r > n && (r = n), t.strm.output.set(t.window.subarray(t.block_start, t.block_start + r), t.strm.next_out), t.strm.next_out += r, t.strm.avail_out -= r, t.strm.total_out += r, t.block_start += r, n -= r), n && (Ae(t.strm, t.strm.output, t.strm.next_out, n), t.strm.next_out += n, t.strm.avail_out -= n, t.strm.total_out += n);
    } while (h === 0);
    return o -= t.strm.avail_in, o && (o >= t.w_size ? (t.matches = 2, t.window.set(t.strm.input.subarray(t.strm.next_in - t.w_size, t.strm.next_in), 0), t.strstart = t.w_size, t.insert = t.strstart) : (t.window_size - t.strstart <= o && (t.strstart -= t.w_size, t.window.set(t.window.subarray(t.w_size, t.w_size + t.strstart), 0), t.matches < 2 && t.matches++, t.insert > t.strstart && (t.insert = t.strstart)), t.window.set(t.strm.input.subarray(t.strm.next_in - o, t.strm.next_in), t.strstart), t.strstart += o, t.insert += o > t.w_size - t.insert ? t.w_size - t.insert : o), t.block_start = t.strstart), t.high_water < t.strstart && (t.high_water = t.strstart), h ? pt : i !== q && i !== M && t.strm.avail_in === 0 && t.strstart === t.block_start ? ut : (a = t.window_size - t.strstart, t.strm.avail_in > a && t.block_start >= t.w_size && (t.block_start -= t.w_size, t.strstart -= t.w_size, t.window.set(t.window.subarray(t.w_size, t.w_size + t.strstart), 0), t.matches < 2 && t.matches++, a += t.w_size, t.insert > t.strstart && (t.insert = t.strstart)), a > t.strm.avail_in && (a = t.strm.avail_in), a && (Ae(t.strm, t.window, t.strstart, a), t.strstart += a, t.insert += a > t.w_size - t.insert ? t.w_size - t.insert : a), t.high_water < t.strstart && (t.high_water = t.strstart), a = t.bi_valid + 42 >> 3, a = t.pending_buf_size - a > 65535 ? 65535 : t.pending_buf_size - a, e = a > t.w_size ? t.w_size : a, r = t.strstart - t.block_start, (r >= e || (r || i === M) && i !== q && t.strm.avail_in === 0 && r <= a) && (n = r > a ? a : r, h = i === M && t.strm.avail_in === 0 && n === r ? 1 : 0, ge(t, t.block_start, n, h), t.block_start += n, L(t.strm)), h ? at : I);
}, re = (t, i) => {
    let e, n;
    for (; ; ) {
        if (t.lookahead < P) {
            if (ct(t), t.lookahead < P && i === q)
                return I;
            if (t.lookahead === 0)
                break;
        }
        if (e = 0, t.lookahead >= A && (t.ins_h = J(t, t.ins_h, t.window[t.strstart + A - 1]), e = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart), e !== 0 && t.strstart - e <= t.w_size - P && (t.match_length = Zi(t, e)), t.match_length >= A)
            if (n = V(t, t.strstart - t.match_start, t.match_length - A), t.lookahead -= t.match_length, t.match_length <= t.max_lazy_match && t.lookahead >= A) {
                t.match_length--;
                do
                    t.strstart++, t.ins_h = J(t, t.ins_h, t.window[t.strstart + A - 1]), e = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart;
                while (--t.match_length !== 0);
                t.strstart++;
            } else
                t.strstart += t.match_length, t.match_length = 0, t.ins_h = t.window[t.strstart], t.ins_h = J(t, t.ins_h, t.window[t.strstart + 1]);
        else
            n = V(t, 0, t.window[t.strstart]), t.lookahead--, t.strstart++;
        if (n && (B(t, !1), t.strm.avail_out === 0))
            return I;
    }
    return t.insert = t.strstart < A - 1 ? t.strstart : A - 1, i === M ? (B(t, !0), t.strm.avail_out === 0 ? at : pt) : t.sym_next && (B(t, !1), t.strm.avail_out === 0) ? I : ut;
}, ot = (t, i) => {
    let e, n, r;
    for (; ; ) {
        if (t.lookahead < P) {
            if (ct(t), t.lookahead < P && i === q)
                return I;
            if (t.lookahead === 0)
                break;
        }
        if (e = 0, t.lookahead >= A && (t.ins_h = J(t, t.ins_h, t.window[t.strstart + A - 1]), e = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart), t.prev_length = t.match_length, t.prev_match = t.match_start, t.match_length = A - 1, e !== 0 && t.prev_length < t.max_lazy_match && t.strstart - e <= t.w_size - P && (t.match_length = Zi(t, e), t.match_length <= 5 && (t.strategy === oa || t.match_length === A && t.strstart - t.match_start > 4096) && (t.match_length = A - 1)), t.prev_length >= A && t.match_length <= t.prev_length) {
            r = t.strstart + t.lookahead - A, n = V(t, t.strstart - 1 - t.prev_match, t.prev_length - A), t.lookahead -= t.prev_length - 1, t.prev_length -= 2;
            do
                ++t.strstart <= r && (t.ins_h = J(t, t.ins_h, t.window[t.strstart + A - 1]), e = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h], t.head[t.ins_h] = t.strstart);
            while (--t.prev_length !== 0);
            if (t.match_available = 0, t.match_length = A - 1, t.strstart++, n && (B(t, !1), t.strm.avail_out === 0))
                return I;
        } else if (t.match_available) {
            if (n = V(t, 0, t.window[t.strstart - 1]), n && B(t, !1), t.strstart++, t.lookahead--, t.strm.avail_out === 0)
                return I;
        } else
            t.match_available = 1, t.strstart++, t.lookahead--;
    }
    return t.match_available && (n = V(t, 0, t.window[t.strstart - 1]), t.match_available = 0), t.insert = t.strstart < A - 1 ? t.strstart : A - 1, i === M ? (B(t, !0), t.strm.avail_out === 0 ? at : pt) : t.sym_next && (B(t, !1), t.strm.avail_out === 0) ? I : ut;
}, ma = (t, i) => {
    let e, n, r, a;
    const h = t.window;
    for (; ; ) {
        if (t.lookahead <= j) {
            if (ct(t), t.lookahead <= j && i === q)
                return I;
            if (t.lookahead === 0)
                break;
        }
        if (t.match_length = 0, t.lookahead >= A && t.strstart > 0 && (r = t.strstart - 1, n = h[r], n === h[++r] && n === h[++r] && n === h[++r])) {
            a = t.strstart + j;
            do
                ;
            while (n === h[++r] && n === h[++r] && n === h[++r] && n === h[++r] && n === h[++r] && n === h[++r] && n === h[++r] && n === h[++r] && r < a);
            t.match_length = j - (a - r), t.match_length > t.lookahead && (t.match_length = t.lookahead);
        }
        if (t.match_length >= A ? (e = V(t, 1, t.match_length - A), t.lookahead -= t.match_length, t.strstart += t.match_length, t.match_length = 0) : (e = V(t, 0, t.window[t.strstart]), t.lookahead--, t.strstart++), e && (B(t, !1), t.strm.avail_out === 0))
            return I;
    }
    return t.insert = 0, i === M ? (B(t, !0), t.strm.avail_out === 0 ? at : pt) : t.sym_next && (B(t, !1), t.strm.avail_out === 0) ? I : ut;
}, Sa = (t, i) => {
    let e;
    for (; ; ) {
        if (t.lookahead === 0 && (ct(t), t.lookahead === 0)) {
            if (i === q)
                return I;
            break;
        }
        if (t.match_length = 0, e = V(t, 0, t.window[t.strstart]), t.lookahead--, t.strstart++, e && (B(t, !1), t.strm.avail_out === 0))
            return I;
    }
    return t.insert = 0, i === M ? (B(t, !0), t.strm.avail_out === 0 ? at : pt) : t.sym_next && (B(t, !1), t.strm.avail_out === 0) ? I : ut;
};
function $(t, i, e, n, r) {
    this.good_length = t, this.max_lazy = i, this.nice_length = e, this.max_chain = n, this.func = r;
}
const bt = [
    /*      good lazy nice chain */
    new $(0, 0, 0, 0, $i),
    /* 0 store only */
    new $(4, 4, 8, 4, re),
    /* 1 max speed, no lazy matches */
    new $(4, 5, 16, 8, re),
    /* 2 */
    new $(4, 6, 32, 32, re),
    /* 3 */
    new $(4, 4, 16, 16, ot),
    /* 4 lazy matches */
    new $(8, 16, 32, 32, ot),
    /* 5 */
    new $(8, 16, 128, 128, ot),
    /* 6 */
    new $(8, 32, 128, 256, ot),
    /* 7 */
    new $(32, 128, 258, 1024, ot),
    /* 8 */
    new $(32, 258, 258, 4096, ot)
    /* 9 max compression */
], Ua = (t) => {
    t.window_size = 2 * t.w_size, G(t.head), t.max_lazy_match = bt[t.level].max_lazy, t.good_match = bt[t.level].good_length, t.nice_match = bt[t.level].nice_length, t.max_chain_length = bt[t.level].max_chain, t.strstart = 0, t.block_start = 0, t.lookahead = 0, t.insert = 0, t.match_length = t.prev_length = A - 1, t.match_available = 0, t.ins_h = 0;
};
function Ta() {
    this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = jt, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new Uint16Array(xa * 2), this.dyn_dtree = new Uint16Array((2 * ga + 1) * 2), this.bl_tree = new Uint16Array((2 * ba + 1) * 2), G(this.dyn_ltree), G(this.dyn_dtree), G(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new Uint16Array(ya + 1), this.heap = new Uint16Array(2 * be + 1), G(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new Uint16Array(2 * be + 1), G(this.depth), this.sym_buf = 0, this.lit_bufsize = 0, this.sym_next = 0, this.sym_end = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
}
const Ct = (t) => {
    if (!t)
        return 1;
    const i = t.state;
    return !i || i.strm !== t || i.status !== dt && //#ifdef GZIP
    i.status !== Oe && //#endif
    i.status !== xe && i.status !== ye && i.status !== ke && i.status !== Ee && i.status !== et && i.status !== gt ? 1 : 0;
}, Fi = (t) => {
    if (Ct(t))
        return it(t, H);
    t.total_in = t.total_out = 0, t.data_type = da;
    const i = t.state;
    return i.pending = 0, i.pending_out = 0, i.wrap < 0 && (i.wrap = -i.wrap), i.status = //#ifdef GZIP
        i.wrap === 2 ? Oe : (
            //#endif
            i.wrap ? dt : et
        ), t.adler = i.wrap === 2 ? 0 : 1, i.last_flush = -2, ta(i), C;
}, Hi = (t) => {
    const i = Fi(t);
    return i === C && Ua(t.state), i;
}, Oa = (t, i) => Ct(t) || t.state.wrap !== 2 ? H : (t.state.gzhead = i, C), Pi = (t, i, e, n, r, a) => {
    if (!t)
        return H;
    let h = 1;
    if (i === sa && (i = 6), n < 0 ? (h = 0, n = -n) : n > 15 && (h = 2, n -= 16), r < 1 || r > ca || e !== jt || n < 8 || n > 15 || i < 0 || i > 9 || a < 0 || a > la || n === 8 && h !== 1)
        return it(t, H);
    n === 8 && (n = 9);
    const o = new Ta();
    return t.state = o, o.strm = t, o.status = dt, o.wrap = h, o.gzhead = null, o.w_bits = n, o.w_size = 1 << o.w_bits, o.w_mask = o.w_size - 1, o.hash_bits = r + 7, o.hash_size = 1 << o.hash_bits, o.hash_mask = o.hash_size - 1, o.hash_shift = ~~((o.hash_bits + A - 1) / A), o.window = new Uint8Array(o.w_size * 2), o.head = new Uint16Array(o.hash_size), o.prev = new Uint16Array(o.w_size), o.lit_bufsize = 1 << r + 6, o.pending_buf_size = o.lit_bufsize * 4, o.pending_buf = new Uint8Array(o.pending_buf_size), o.sym_buf = o.lit_bufsize, o.sym_end = (o.lit_bufsize - 1) * 3, o.level = i, o.strategy = a, o.method = e, Hi(t);
}, Ra = (t, i) => Pi(t, i, jt, _a, ua, fa), Da = (t, i) => {
    if (Ct(t) || i > Ze || i < 0)
        return t ? it(t, H) : H;
    const e = t.state;
    if (!t.output || t.avail_in !== 0 && !t.input || e.status === gt && i !== M)
        return it(t, t.avail_out === 0 ? ae : H);
    const n = e.last_flush;
    if (e.last_flush = i, e.pending !== 0) {
        if (L(t), t.avail_out === 0)
            return e.last_flush = -1, C;
    } else if (t.avail_in === 0 && Fe(i) <= Fe(n) && i !== M)
        return it(t, ae);
    if (e.status === gt && t.avail_in !== 0)
        return it(t, ae);
    if (e.status === dt && e.wrap === 0 && (e.status = et), e.status === dt) {
        let r = jt + (e.w_bits - 8 << 4) << 8, a = -1;
        if (e.strategy >= Bt || e.level < 2 ? a = 0 : e.level < 6 ? a = 1 : e.level === 6 ? a = 2 : a = 3, r |= a << 6, e.strstart !== 0 && (r |= ka), r += 31 - r % 31, wt(e, r), e.strstart !== 0 && (wt(e, t.adler >>> 16), wt(e, t.adler & 65535)), t.adler = 1, e.status = et, L(t), e.pending !== 0)
            return e.last_flush = -1, C;
    }
    if (e.status === Oe) {
        if (t.adler = 0, S(e, 31), S(e, 139), S(e, 8), e.gzhead)
            S(
                e,
                (e.gzhead.text ? 1 : 0) + (e.gzhead.hcrc ? 2 : 0) + (e.gzhead.extra ? 4 : 0) + (e.gzhead.name ? 8 : 0) + (e.gzhead.comment ? 16 : 0)
            ), S(e, e.gzhead.time & 255), S(e, e.gzhead.time >> 8 & 255), S(e, e.gzhead.time >> 16 & 255), S(e, e.gzhead.time >> 24 & 255), S(e, e.level === 9 ? 2 : e.strategy >= Bt || e.level < 2 ? 4 : 0), S(e, e.gzhead.os & 255), e.gzhead.extra && e.gzhead.extra.length && (S(e, e.gzhead.extra.length & 255), S(e, e.gzhead.extra.length >> 8 & 255)), e.gzhead.hcrc && (t.adler = N(t.adler, e.pending_buf, e.pending, 0)), e.gzindex = 0, e.status = xe;
        else if (S(e, 0), S(e, 0), S(e, 0), S(e, 0), S(e, 0), S(e, e.level === 9 ? 2 : e.strategy >= Bt || e.level < 2 ? 4 : 0), S(e, Ea), e.status = et, L(t), e.pending !== 0)
            return e.last_flush = -1, C;
    }
    if (e.status === xe) {
        if (e.gzhead.extra) {
            let r = e.pending, a = (e.gzhead.extra.length & 65535) - e.gzindex;
            for (; e.pending + a > e.pending_buf_size; ) {
                let o = e.pending_buf_size - e.pending;
                if (e.pending_buf.set(e.gzhead.extra.subarray(e.gzindex, e.gzindex + o), e.pending), e.pending = e.pending_buf_size, e.gzhead.hcrc && e.pending > r && (t.adler = N(t.adler, e.pending_buf, e.pending - r, r)), e.gzindex += o, L(t), e.pending !== 0)
                    return e.last_flush = -1, C;
                r = 0, a -= o;
            }
            let h = new Uint8Array(e.gzhead.extra);
            e.pending_buf.set(h.subarray(e.gzindex, e.gzindex + a), e.pending), e.pending += a, e.gzhead.hcrc && e.pending > r && (t.adler = N(t.adler, e.pending_buf, e.pending - r, r)), e.gzindex = 0;
        }
        e.status = ye;
    }
    if (e.status === ye) {
        if (e.gzhead.name) {
            let r = e.pending, a;
            do {
                if (e.pending === e.pending_buf_size) {
                    if (e.gzhead.hcrc && e.pending > r && (t.adler = N(t.adler, e.pending_buf, e.pending - r, r)), L(t), e.pending !== 0)
                        return e.last_flush = -1, C;
                    r = 0;
                }
                e.gzindex < e.gzhead.name.length ? a = e.gzhead.name.charCodeAt(e.gzindex++) & 255 : a = 0, S(e, a);
            } while (a !== 0);
            e.gzhead.hcrc && e.pending > r && (t.adler = N(t.adler, e.pending_buf, e.pending - r, r)), e.gzindex = 0;
        }
        e.status = ke;
    }
    if (e.status === ke) {
        if (e.gzhead.comment) {
            let r = e.pending, a;
            do {
                if (e.pending === e.pending_buf_size) {
                    if (e.gzhead.hcrc && e.pending > r && (t.adler = N(t.adler, e.pending_buf, e.pending - r, r)), L(t), e.pending !== 0)
                        return e.last_flush = -1, C;
                    r = 0;
                }
                e.gzindex < e.gzhead.comment.length ? a = e.gzhead.comment.charCodeAt(e.gzindex++) & 255 : a = 0, S(e, a);
            } while (a !== 0);
            e.gzhead.hcrc && e.pending > r && (t.adler = N(t.adler, e.pending_buf, e.pending - r, r));
        }
        e.status = Ee;
    }
    if (e.status === Ee) {
        if (e.gzhead.hcrc) {
            if (e.pending + 2 > e.pending_buf_size && (L(t), e.pending !== 0))
                return e.last_flush = -1, C;
            S(e, t.adler & 255), S(e, t.adler >> 8 & 255), t.adler = 0;
        }
        if (e.status = et, L(t), e.pending !== 0)
            return e.last_flush = -1, C;
    }
    if (t.avail_in !== 0 || e.lookahead !== 0 || i !== q && e.status !== gt) {
        let r = e.level === 0 ? $i(e, i) : e.strategy === Bt ? Sa(e, i) : e.strategy === ha ? ma(e, i) : bt[e.level].func(e, i);
        if ((r === at || r === pt) && (e.status = gt), r === I || r === at)
            return t.avail_out === 0 && (e.last_flush = -1), C;
        if (r === ut && (i === na ? ia(e) : i !== Ze && (ge(e, 0, 0, !1), i === aa && (G(e.head), e.lookahead === 0 && (e.strstart = 0, e.block_start = 0, e.insert = 0))), L(t), t.avail_out === 0))
            return e.last_flush = -1, C;
    }
    return i !== M ? C : e.wrap <= 0 ? $e : (e.wrap === 2 ? (S(e, t.adler & 255), S(e, t.adler >> 8 & 255), S(e, t.adler >> 16 & 255), S(e, t.adler >> 24 & 255), S(e, t.total_in & 255), S(e, t.total_in >> 8 & 255), S(e, t.total_in >> 16 & 255), S(e, t.total_in >> 24 & 255)) : (wt(e, t.adler >>> 16), wt(e, t.adler & 65535)), L(t), e.wrap > 0 && (e.wrap = -e.wrap), e.pending !== 0 ? C : $e);
}, Na = (t) => {
    if (Ct(t))
        return H;
    const i = t.state.status;
    return t.state = null, i === et ? it(t, ra) : C;
}, Ca = (t, i) => {
    let e = i.length;
    if (Ct(t))
        return H;
    const n = t.state, r = n.wrap;
    if (r === 2 || r === 1 && n.status !== dt || n.lookahead)
        return H;
    if (r === 1 && (t.adler = Tt(t.adler, i, e, 0)), n.wrap = 0, e >= n.w_size) {
        r === 0 && (G(n.head), n.strstart = 0, n.block_start = 0, n.insert = 0);
        let d = new Uint8Array(n.w_size);
        d.set(i.subarray(e - n.w_size, e), 0), i = d, e = n.w_size;
    }
    const a = t.avail_in, h = t.next_in, o = t.input;
    for (t.avail_in = e, t.next_in = 0, t.input = i, ct(n); n.lookahead >= A; ) {
        let d = n.strstart, s = n.lookahead - (A - 1);
        do
            n.ins_h = J(n, n.ins_h, n.window[d + A - 1]), n.prev[d & n.w_mask] = n.head[n.ins_h], n.head[n.ins_h] = d, d++;
        while (--s);
        n.strstart = d, n.lookahead = A - 1, ct(n);
    }
    return n.strstart += n.lookahead, n.block_start = n.strstart, n.insert = n.lookahead, n.lookahead = 0, n.match_length = n.prev_length = A - 1, n.match_available = 0, t.next_in = h, t.input = o, t.avail_in = a, n.wrap = r, C;
};
var Ia = Ra, za = Pi, La = Hi, Ba = Fi, Ma = Oa, Za = Da, $a = Na, Fa = Ca, Ha = "pako deflate (from Nodeca project)", yt = {
    deflateInit: Ia,
    deflateInit2: za,
    deflateReset: La,
    deflateResetKeep: Ba,
    deflateSetHeader: Ma,
    deflate: Za,
    deflateEnd: $a,
    deflateSetDictionary: Fa,
    deflateInfo: Ha
};
const Pa = (t, i) => Object.prototype.hasOwnProperty.call(t, i);
var Ka = function(t) {
    const i = Array.prototype.slice.call(arguments, 1);
    for (; i.length; ) {
        const e = i.shift();
        if (e) {
            if (typeof e != "object")
                throw new TypeError(e + "must be non-object");
            for (const n in e)
                Pa(e, n) && (t[n] = e[n]);
        }
    }
    return t;
}, Wa = (t) => {
    let i = 0;
    for (let n = 0, r = t.length; n < r; n++)
        i += t[n].length;
    const e = new Uint8Array(i);
    for (let n = 0, r = 0, a = t.length; n < a; n++) {
        let h = t[n];
        e.set(h, r), r += h.length;
    }
    return e;
}, Vt = {
    assign: Ka,
    flattenChunks: Wa
};
let Ki = !0;
try {
    String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
    Ki = !1;
}
const Ot = new Uint8Array(256);
for (let t = 0; t < 256; t++)
    Ot[t] = t >= 252 ? 6 : t >= 248 ? 5 : t >= 240 ? 4 : t >= 224 ? 3 : t >= 192 ? 2 : 1;
Ot[254] = Ot[254] = 1;
var Ya = (t) => {
    if (typeof TextEncoder == "function" && TextEncoder.prototype.encode)
        return new TextEncoder().encode(t);
    let i, e, n, r, a, h = t.length, o = 0;
    for (r = 0; r < h; r++)
        e = t.charCodeAt(r), (e & 64512) === 55296 && r + 1 < h && (n = t.charCodeAt(r + 1), (n & 64512) === 56320 && (e = 65536 + (e - 55296 << 10) + (n - 56320), r++)), o += e < 128 ? 1 : e < 2048 ? 2 : e < 65536 ? 3 : 4;
    for (i = new Uint8Array(o), a = 0, r = 0; a < o; r++)
        e = t.charCodeAt(r), (e & 64512) === 55296 && r + 1 < h && (n = t.charCodeAt(r + 1), (n & 64512) === 56320 && (e = 65536 + (e - 55296 << 10) + (n - 56320), r++)), e < 128 ? i[a++] = e : e < 2048 ? (i[a++] = 192 | e >>> 6, i[a++] = 128 | e & 63) : e < 65536 ? (i[a++] = 224 | e >>> 12, i[a++] = 128 | e >>> 6 & 63, i[a++] = 128 | e & 63) : (i[a++] = 240 | e >>> 18, i[a++] = 128 | e >>> 12 & 63, i[a++] = 128 | e >>> 6 & 63, i[a++] = 128 | e & 63);
    return i;
};
const Ga = (t, i) => {
    if (i < 65534 && t.subarray && Ki)
        return String.fromCharCode.apply(null, t.length === i ? t : t.subarray(0, i));
    let e = "";
    for (let n = 0; n < i; n++)
        e += String.fromCharCode(t[n]);
    return e;
};
var Xa = (t, i) => {
    const e = i || t.length;
    if (typeof TextDecoder == "function" && TextDecoder.prototype.decode)
        return new TextDecoder().decode(t.subarray(0, i));
    let n, r;
    const a = new Array(e * 2);
    for (r = 0, n = 0; n < e; ) {
        let h = t[n++];
        if (h < 128) {
            a[r++] = h;
            continue;
        }
        let o = Ot[h];
        if (o > 4) {
            a[r++] = 65533, n += o - 1;
            continue;
        }
        for (h &= o === 2 ? 31 : o === 3 ? 15 : 7; o > 1 && n < e; )
            h = h << 6 | t[n++] & 63, o--;
        if (o > 1) {
            a[r++] = 65533;
            continue;
        }
        h < 65536 ? a[r++] = h : (h -= 65536, a[r++] = 55296 | h >> 10 & 1023, a[r++] = 56320 | h & 1023);
    }
    return Ga(a, r);
}, ja = (t, i) => {
    i = i || t.length, i > t.length && (i = t.length);
    let e = i - 1;
    for (; e >= 0 && (t[e] & 192) === 128; )
        e--;
    return e < 0 || e === 0 ? i : e + Ot[t[e]] > i ? e : i;
}, Rt = {
    string2buf: Ya,
    buf2string: Xa,
    utf8border: ja
};
function Va() {
    this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
}
var Wi = Va;
const Yi = Object.prototype.toString, {
    Z_NO_FLUSH: qa,
    Z_SYNC_FLUSH: Ja,
    Z_FULL_FLUSH: Qa,
    Z_FINISH: tr,
    Z_OK: Yt,
    Z_STREAM_END: er,
    Z_DEFAULT_COMPRESSION: ir,
    Z_DEFAULT_STRATEGY: nr,
    Z_DEFLATED: ar
} = Xt;
function qt(t) {
    this.options = Vt.assign({
        level: ir,
        method: ar,
        chunkSize: 16384,
        windowBits: 15,
        memLevel: 8,
        strategy: nr
    }, t || {});
    let i = this.options;
    i.raw && i.windowBits > 0 ? i.windowBits = -i.windowBits : i.gzip && i.windowBits > 0 && i.windowBits < 16 && (i.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new Wi(), this.strm.avail_out = 0;
    let e = yt.deflateInit2(
        this.strm,
        i.level,
        i.method,
        i.windowBits,
        i.memLevel,
        i.strategy
    );
    if (e !== Yt)
        throw new Error(nt[e]);
    if (i.header && yt.deflateSetHeader(this.strm, i.header), i.dictionary) {
        let n;
        if (typeof i.dictionary == "string" ? n = Rt.string2buf(i.dictionary) : Yi.call(i.dictionary) === "[object ArrayBuffer]" ? n = new Uint8Array(i.dictionary) : n = i.dictionary, e = yt.deflateSetDictionary(this.strm, n), e !== Yt)
            throw new Error(nt[e]);
        this._dict_set = !0;
    }
}
qt.prototype.push = function(t, i) {
    const e = this.strm, n = this.options.chunkSize;
    let r, a;
    if (this.ended)
        return !1;
    for (i === ~~i ? a = i : a = i === !0 ? tr : qa, typeof t == "string" ? e.input = Rt.string2buf(t) : Yi.call(t) === "[object ArrayBuffer]" ? e.input = new Uint8Array(t) : e.input = t, e.next_in = 0, e.avail_in = e.input.length; ; ) {
        if (e.avail_out === 0 && (e.output = new Uint8Array(n), e.next_out = 0, e.avail_out = n), (a === Ja || a === Qa) && e.avail_out <= 6) {
            this.onData(e.output.subarray(0, e.next_out)), e.avail_out = 0;
            continue;
        }
        if (r = yt.deflate(e, a), r === er)
            return e.next_out > 0 && this.onData(e.output.subarray(0, e.next_out)), r = yt.deflateEnd(this.strm), this.onEnd(r), this.ended = !0, r === Yt;
        if (e.avail_out === 0) {
            this.onData(e.output);
            continue;
        }
        if (a > 0 && e.next_out > 0) {
            this.onData(e.output.subarray(0, e.next_out)), e.avail_out = 0;
            continue;
        }
        if (e.avail_in === 0) break;
    }
    return !0;
};
qt.prototype.onData = function(t) {
    this.chunks.push(t);
};
qt.prototype.onEnd = function(t) {
    t === Yt && (this.result = Vt.flattenChunks(this.chunks)), this.chunks = [], this.err = t, this.msg = this.strm.msg;
};
function rr(t, i) {
    const e = new qt(i);
    if (e.push(t, !0), e.err)
        throw e.msg || nt[e.err];
    return e.result;
}
var sr = rr, or = {
    deflate: sr
};
const Mt = 16209, hr = 16191;
var lr = function(i, e) {
    let n, r, a, h, o, d, s, l, u, c, f, p, U, y, b, v, g, _, k, O, w, T, m, x;
    const E = i.state;
    n = i.next_in, m = i.input, r = n + (i.avail_in - 5), a = i.next_out, x = i.output, h = a - (e - i.avail_out), o = a + (i.avail_out - 257), d = E.dmax, s = E.wsize, l = E.whave, u = E.wnext, c = E.window, f = E.hold, p = E.bits, U = E.lencode, y = E.distcode, b = (1 << E.lenbits) - 1, v = (1 << E.distbits) - 1;
    t:
        do {
            p < 15 && (f += m[n++] << p, p += 8, f += m[n++] << p, p += 8), g = U[f & b];
            e:
                for (; ; ) {
                    if (_ = g >>> 24, f >>>= _, p -= _, _ = g >>> 16 & 255, _ === 0)
                        x[a++] = g & 65535;
                    else if (_ & 16) {
                        k = g & 65535, _ &= 15, _ && (p < _ && (f += m[n++] << p, p += 8), k += f & (1 << _) - 1, f >>>= _, p -= _), p < 15 && (f += m[n++] << p, p += 8, f += m[n++] << p, p += 8), g = y[f & v];
                        i:
                            for (; ; ) {
                                if (_ = g >>> 24, f >>>= _, p -= _, _ = g >>> 16 & 255, _ & 16) {
                                    if (O = g & 65535, _ &= 15, p < _ && (f += m[n++] << p, p += 8, p < _ && (f += m[n++] << p, p += 8)), O += f & (1 << _) - 1, O > d) {
                                        i.msg = "invalid distance too far back", E.mode = Mt;
                                        break t;
                                    }
                                    if (f >>>= _, p -= _, _ = a - h, O > _) {
                                        if (_ = O - _, _ > l && E.sane) {
                                            i.msg = "invalid distance too far back", E.mode = Mt;
                                            break t;
                                        }
                                        if (w = 0, T = c, u === 0) {
                                            if (w += s - _, _ < k) {
                                                k -= _;
                                                do
                                                    x[a++] = c[w++];
                                                while (--_);
                                                w = a - O, T = x;
                                            }
                                        } else if (u < _) {
                                            if (w += s + u - _, _ -= u, _ < k) {
                                                k -= _;
                                                do
                                                    x[a++] = c[w++];
                                                while (--_);
                                                if (w = 0, u < k) {
                                                    _ = u, k -= _;
                                                    do
                                                        x[a++] = c[w++];
                                                    while (--_);
                                                    w = a - O, T = x;
                                                }
                                            }
                                        } else if (w += u - _, _ < k) {
                                            k -= _;
                                            do
                                                x[a++] = c[w++];
                                            while (--_);
                                            w = a - O, T = x;
                                        }
                                        for (; k > 2; )
                                            x[a++] = T[w++], x[a++] = T[w++], x[a++] = T[w++], k -= 3;
                                        k && (x[a++] = T[w++], k > 1 && (x[a++] = T[w++]));
                                    } else {
                                        w = a - O;
                                        do
                                            x[a++] = x[w++], x[a++] = x[w++], x[a++] = x[w++], k -= 3;
                                        while (k > 2);
                                        k && (x[a++] = x[w++], k > 1 && (x[a++] = x[w++]));
                                    }
                                } else if ((_ & 64) === 0) {
                                    g = y[(g & 65535) + (f & (1 << _) - 1)];
                                    continue i;
                                } else {
                                    i.msg = "invalid distance code", E.mode = Mt;
                                    break t;
                                }
                                break;
                            }
                    } else if ((_ & 64) === 0) {
                        g = U[(g & 65535) + (f & (1 << _) - 1)];
                        continue e;
                    } else if (_ & 32) {
                        E.mode = hr;
                        break t;
                    } else {
                        i.msg = "invalid literal/length code", E.mode = Mt;
                        break t;
                    }
                    break;
                }
        } while (n < r && a < o);
    k = p >> 3, n -= k, p -= k << 3, f &= (1 << p) - 1, i.next_in = n, i.next_out = a, i.avail_in = n < r ? 5 + (r - n) : 5 - (n - r), i.avail_out = a < o ? 257 + (o - a) : 257 - (a - o), E.hold = f, E.bits = p;
};
const ht = 15, He = 852, Pe = 592, Ke = 0, se = 1, We = 2, fr = new Uint16Array([
    /* Length codes 257..285 base */
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    13,
    15,
    17,
    19,
    23,
    27,
    31,
    35,
    43,
    51,
    59,
    67,
    83,
    99,
    115,
    131,
    163,
    195,
    227,
    258,
    0,
    0
]), dr = new Uint8Array([
    /* Length codes 257..285 extra */
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    17,
    17,
    17,
    17,
    18,
    18,
    18,
    18,
    19,
    19,
    19,
    19,
    20,
    20,
    20,
    20,
    21,
    21,
    21,
    21,
    16,
    72,
    78
]), cr = new Uint16Array([
    /* Distance codes 0..29 base */
    1,
    2,
    3,
    4,
    5,
    7,
    9,
    13,
    17,
    25,
    33,
    49,
    65,
    97,
    129,
    193,
    257,
    385,
    513,
    769,
    1025,
    1537,
    2049,
    3073,
    4097,
    6145,
    8193,
    12289,
    16385,
    24577,
    0,
    0
]), _r = new Uint8Array([
    /* Distance codes 0..29 extra */
    16,
    16,
    16,
    16,
    17,
    17,
    18,
    18,
    19,
    19,
    20,
    20,
    21,
    21,
    22,
    22,
    23,
    23,
    24,
    24,
    25,
    25,
    26,
    26,
    27,
    27,
    28,
    28,
    29,
    29,
    64,
    64
]), ur = (t, i, e, n, r, a, h, o) => {
    const d = o.bits;
    let s = 0, l = 0, u = 0, c = 0, f = 0, p = 0, U = 0, y = 0, b = 0, v = 0, g, _, k, O, w, T = null, m;
    const x = new Uint16Array(ht + 1), E = new Uint16Array(ht + 1);
    let Q = null, Re, zt, Lt;
    for (s = 0; s <= ht; s++)
        x[s] = 0;
    for (l = 0; l < n; l++)
        x[i[e + l]]++;
    for (f = d, c = ht; c >= 1 && x[c] === 0; c--)
        ;
    if (f > c && (f = c), c === 0)
        return r[a++] = 1 << 24 | 64 << 16 | 0, r[a++] = 1 << 24 | 64 << 16 | 0, o.bits = 1, 0;
    for (u = 1; u < c && x[u] === 0; u++)
        ;
    for (f < u && (f = u), y = 1, s = 1; s <= ht; s++)
        if (y <<= 1, y -= x[s], y < 0)
            return -1;
    if (y > 0 && (t === Ke || c !== 1))
        return -1;
    for (E[1] = 0, s = 1; s < ht; s++)
        E[s + 1] = E[s] + x[s];
    for (l = 0; l < n; l++)
        i[e + l] !== 0 && (h[E[i[e + l]]++] = l);
    if (t === Ke ? (T = Q = h, m = 20) : t === se ? (T = fr, Q = dr, m = 257) : (T = cr, Q = _r, m = 0), v = 0, l = 0, s = u, w = a, p = f, U = 0, k = -1, b = 1 << f, O = b - 1, t === se && b > He || t === We && b > Pe)
        return 1;
    for (; ; ) {
        Re = s - U, h[l] + 1 < m ? (zt = 0, Lt = h[l]) : h[l] >= m ? (zt = Q[h[l] - m], Lt = T[h[l] - m]) : (zt = 96, Lt = 0), g = 1 << s - U, _ = 1 << p, u = _;
        do
            _ -= g, r[w + (v >> U) + _] = Re << 24 | zt << 16 | Lt | 0;
        while (_ !== 0);
        for (g = 1 << s - 1; v & g; )
            g >>= 1;
        if (g !== 0 ? (v &= g - 1, v += g) : v = 0, l++, --x[s] === 0) {
            if (s === c)
                break;
            s = i[e + h[l]];
        }
        if (s > f && (v & O) !== k) {
            for (U === 0 && (U = f), w += u, p = s - U, y = 1 << p; p + U < c && (y -= x[p + U], !(y <= 0)); )
                p++, y <<= 1;
            if (b += 1 << p, t === se && b > He || t === We && b > Pe)
                return 1;
            k = v & O, r[k] = f << 24 | p << 16 | w - a | 0;
        }
    }
    return v !== 0 && (r[w + v] = s - U << 24 | 64 << 16 | 0), o.bits = f, 0;
};
var kt = ur;
const pr = 0, Gi = 1, Xi = 2, {
    Z_FINISH: Ye,
    Z_BLOCK: wr,
    Z_TREES: Zt,
    Z_OK: rt,
    Z_STREAM_END: gr,
    Z_NEED_DICT: br,
    Z_STREAM_ERROR: Z,
    Z_DATA_ERROR: ji,
    Z_MEM_ERROR: Vi,
    Z_BUF_ERROR: xr,
    Z_DEFLATED: Ge
} = Xt, Jt = 16180, Xe = 16181, je = 16182, Ve = 16183, qe = 16184, Je = 16185, Qe = 16186, ti = 16187, ei = 16188, ii = 16189, Gt = 16190, K = 16191, oe = 16192, ni = 16193, he = 16194, ai = 16195, ri = 16196, si = 16197, oi = 16198, $t = 16199, Ft = 16200, hi = 16201, li = 16202, fi = 16203, di = 16204, ci = 16205, le = 16206, _i = 16207, ui = 16208, R = 16209, qi = 16210, Ji = 16211, yr = 852, kr = 592, Er = 15, Ar = Er, pi = (t) => (t >>> 24 & 255) + (t >>> 8 & 65280) + ((t & 65280) << 8) + ((t & 255) << 24);
function vr() {
    this.strm = null, this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new Uint16Array(320), this.work = new Uint16Array(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
}
const st = (t) => {
    if (!t)
        return 1;
    const i = t.state;
    return !i || i.strm !== t || i.mode < Jt || i.mode > Ji ? 1 : 0;
}, Qi = (t) => {
    if (st(t))
        return Z;
    const i = t.state;
    return t.total_in = t.total_out = i.total = 0, t.msg = "", i.wrap && (t.adler = i.wrap & 1), i.mode = Jt, i.last = 0, i.havedict = 0, i.flags = -1, i.dmax = 32768, i.head = null, i.hold = 0, i.bits = 0, i.lencode = i.lendyn = new Int32Array(yr), i.distcode = i.distdyn = new Int32Array(kr), i.sane = 1, i.back = -1, rt;
}, tn = (t) => {
    if (st(t))
        return Z;
    const i = t.state;
    return i.wsize = 0, i.whave = 0, i.wnext = 0, Qi(t);
}, en = (t, i) => {
    let e;
    if (st(t))
        return Z;
    const n = t.state;
    return i < 0 ? (e = 0, i = -i) : (e = (i >> 4) + 5, i < 48 && (i &= 15)), i && (i < 8 || i > 15) ? Z : (n.window !== null && n.wbits !== i && (n.window = null), n.wrap = e, n.wbits = i, tn(t));
}, nn = (t, i) => {
    if (!t)
        return Z;
    const e = new vr();
    t.state = e, e.strm = t, e.window = null, e.mode = Jt;
    const n = en(t, i);
    return n !== rt && (t.state = null), n;
}, mr = (t) => nn(t, Ar);
let wi = !0, fe, de;
const Sr = (t) => {
    if (wi) {
        fe = new Int32Array(512), de = new Int32Array(32);
        let i = 0;
        for (; i < 144; )
            t.lens[i++] = 8;
        for (; i < 256; )
            t.lens[i++] = 9;
        for (; i < 280; )
            t.lens[i++] = 7;
        for (; i < 288; )
            t.lens[i++] = 8;
        for (kt(Gi, t.lens, 0, 288, fe, 0, t.work, { bits: 9 }), i = 0; i < 32; )
            t.lens[i++] = 5;
        kt(Xi, t.lens, 0, 32, de, 0, t.work, { bits: 5 }), wi = !1;
    }
    t.lencode = fe, t.lenbits = 9, t.distcode = de, t.distbits = 5;
}, an = (t, i, e, n) => {
    let r;
    const a = t.state;
    return a.window === null && (a.wsize = 1 << a.wbits, a.wnext = 0, a.whave = 0, a.window = new Uint8Array(a.wsize)), n >= a.wsize ? (a.window.set(i.subarray(e - a.wsize, e), 0), a.wnext = 0, a.whave = a.wsize) : (r = a.wsize - a.wnext, r > n && (r = n), a.window.set(i.subarray(e - n, e - n + r), a.wnext), n -= r, n ? (a.window.set(i.subarray(e - n, e), 0), a.wnext = n, a.whave = a.wsize) : (a.wnext += r, a.wnext === a.wsize && (a.wnext = 0), a.whave < a.wsize && (a.whave += r))), 0;
}, Ur = (t, i) => {
    let e, n, r, a, h, o, d, s, l, u, c, f, p, U, y = 0, b, v, g, _, k, O, w, T;
    const m = new Uint8Array(4);
    let x, E;
    const Q = (
        /* permutation of code lengths */
        new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
    );
    if (st(t) || !t.output || !t.input && t.avail_in !== 0)
        return Z;
    e = t.state, e.mode === K && (e.mode = oe), h = t.next_out, r = t.output, d = t.avail_out, a = t.next_in, n = t.input, o = t.avail_in, s = e.hold, l = e.bits, u = o, c = d, T = rt;
    t:
        for (; ; )
            switch (e.mode) {
                case Jt:
                    if (e.wrap === 0) {
                        e.mode = oe;
                        break;
                    }
                    for (; l < 16; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    if (e.wrap & 2 && s === 35615) {
                        e.wbits === 0 && (e.wbits = 15), e.check = 0, m[0] = s & 255, m[1] = s >>> 8 & 255, e.check = N(e.check, m, 2, 0), s = 0, l = 0, e.mode = Xe;
                        break;
                    }
                    if (e.head && (e.head.done = !1), !(e.wrap & 1) || /* check if zlib header allowed */
                    (((s & 255) << 8) + (s >> 8)) % 31) {
                        t.msg = "incorrect header check", e.mode = R;
                        break;
                    }
                    if ((s & 15) !== Ge) {
                        t.msg = "unknown compression method", e.mode = R;
                        break;
                    }
                    if (s >>>= 4, l -= 4, w = (s & 15) + 8, e.wbits === 0 && (e.wbits = w), w > 15 || w > e.wbits) {
                        t.msg = "invalid window size", e.mode = R;
                        break;
                    }
                    e.dmax = 1 << e.wbits, e.flags = 0, t.adler = e.check = 1, e.mode = s & 512 ? ii : K, s = 0, l = 0;
                    break;
                case Xe:
                    for (; l < 16; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    if (e.flags = s, (e.flags & 255) !== Ge) {
                        t.msg = "unknown compression method", e.mode = R;
                        break;
                    }
                    if (e.flags & 57344) {
                        t.msg = "unknown header flags set", e.mode = R;
                        break;
                    }
                    e.head && (e.head.text = s >> 8 & 1), e.flags & 512 && e.wrap & 4 && (m[0] = s & 255, m[1] = s >>> 8 & 255, e.check = N(e.check, m, 2, 0)), s = 0, l = 0, e.mode = je;
                /* falls through */
                case je:
                    for (; l < 32; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    e.head && (e.head.time = s), e.flags & 512 && e.wrap & 4 && (m[0] = s & 255, m[1] = s >>> 8 & 255, m[2] = s >>> 16 & 255, m[3] = s >>> 24 & 255, e.check = N(e.check, m, 4, 0)), s = 0, l = 0, e.mode = Ve;
                /* falls through */
                case Ve:
                    for (; l < 16; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    e.head && (e.head.xflags = s & 255, e.head.os = s >> 8), e.flags & 512 && e.wrap & 4 && (m[0] = s & 255, m[1] = s >>> 8 & 255, e.check = N(e.check, m, 2, 0)), s = 0, l = 0, e.mode = qe;
                /* falls through */
                case qe:
                    if (e.flags & 1024) {
                        for (; l < 16; ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        e.length = s, e.head && (e.head.extra_len = s), e.flags & 512 && e.wrap & 4 && (m[0] = s & 255, m[1] = s >>> 8 & 255, e.check = N(e.check, m, 2, 0)), s = 0, l = 0;
                    } else e.head && (e.head.extra = null);
                    e.mode = Je;
                /* falls through */
                case Je:
                    if (e.flags & 1024 && (f = e.length, f > o && (f = o), f && (e.head && (w = e.head.extra_len - e.length, e.head.extra || (e.head.extra = new Uint8Array(e.head.extra_len)), e.head.extra.set(
                        n.subarray(
                            a,
                            // extra field is limited to 65536 bytes
                            // - no need for additional size check
                            a + f
                        ),
                        /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                        w
                    )), e.flags & 512 && e.wrap & 4 && (e.check = N(e.check, n, f, a)), o -= f, a += f, e.length -= f), e.length))
                        break t;
                    e.length = 0, e.mode = Qe;
                /* falls through */
                case Qe:
                    if (e.flags & 2048) {
                        if (o === 0)
                            break t;
                        f = 0;
                        do
                            w = n[a + f++], e.head && w && e.length < 65536 && (e.head.name += String.fromCharCode(w));
                        while (w && f < o);
                        if (e.flags & 512 && e.wrap & 4 && (e.check = N(e.check, n, f, a)), o -= f, a += f, w)
                            break t;
                    } else e.head && (e.head.name = null);
                    e.length = 0, e.mode = ti;
                /* falls through */
                case ti:
                    if (e.flags & 4096) {
                        if (o === 0)
                            break t;
                        f = 0;
                        do
                            w = n[a + f++], e.head && w && e.length < 65536 && (e.head.comment += String.fromCharCode(w));
                        while (w && f < o);
                        if (e.flags & 512 && e.wrap & 4 && (e.check = N(e.check, n, f, a)), o -= f, a += f, w)
                            break t;
                    } else e.head && (e.head.comment = null);
                    e.mode = ei;
                /* falls through */
                case ei:
                    if (e.flags & 512) {
                        for (; l < 16; ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        if (e.wrap & 4 && s !== (e.check & 65535)) {
                            t.msg = "header crc mismatch", e.mode = R;
                            break;
                        }
                        s = 0, l = 0;
                    }
                    e.head && (e.head.hcrc = e.flags >> 9 & 1, e.head.done = !0), t.adler = e.check = 0, e.mode = K;
                    break;
                case ii:
                    for (; l < 32; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    t.adler = e.check = pi(s), s = 0, l = 0, e.mode = Gt;
                /* falls through */
                case Gt:
                    if (e.havedict === 0)
                        return t.next_out = h, t.avail_out = d, t.next_in = a, t.avail_in = o, e.hold = s, e.bits = l, br;
                    t.adler = e.check = 1, e.mode = K;
                /* falls through */
                case K:
                    if (i === wr || i === Zt)
                        break t;
                /* falls through */
                case oe:
                    if (e.last) {
                        s >>>= l & 7, l -= l & 7, e.mode = le;
                        break;
                    }
                    for (; l < 3; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    switch (e.last = s & 1, s >>>= 1, l -= 1, s & 3) {
                        case 0:
                            e.mode = ni;
                            break;
                        case 1:
                            if (Sr(e), e.mode = $t, i === Zt) {
                                s >>>= 2, l -= 2;
                                break t;
                            }
                            break;
                        case 2:
                            e.mode = ri;
                            break;
                        case 3:
                            t.msg = "invalid block type", e.mode = R;
                    }
                    s >>>= 2, l -= 2;
                    break;
                case ni:
                    for (s >>>= l & 7, l -= l & 7; l < 32; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    if ((s & 65535) !== (s >>> 16 ^ 65535)) {
                        t.msg = "invalid stored block lengths", e.mode = R;
                        break;
                    }
                    if (e.length = s & 65535, s = 0, l = 0, e.mode = he, i === Zt)
                        break t;
                /* falls through */
                case he:
                    e.mode = ai;
                /* falls through */
                case ai:
                    if (f = e.length, f) {
                        if (f > o && (f = o), f > d && (f = d), f === 0)
                            break t;
                        r.set(n.subarray(a, a + f), h), o -= f, a += f, d -= f, h += f, e.length -= f;
                        break;
                    }
                    e.mode = K;
                    break;
                case ri:
                    for (; l < 14; ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    if (e.nlen = (s & 31) + 257, s >>>= 5, l -= 5, e.ndist = (s & 31) + 1, s >>>= 5, l -= 5, e.ncode = (s & 15) + 4, s >>>= 4, l -= 4, e.nlen > 286 || e.ndist > 30) {
                        t.msg = "too many length or distance symbols", e.mode = R;
                        break;
                    }
                    e.have = 0, e.mode = si;
                /* falls through */
                case si:
                    for (; e.have < e.ncode; ) {
                        for (; l < 3; ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        e.lens[Q[e.have++]] = s & 7, s >>>= 3, l -= 3;
                    }
                    for (; e.have < 19; )
                        e.lens[Q[e.have++]] = 0;
                    if (e.lencode = e.lendyn, e.lenbits = 7, x = { bits: e.lenbits }, T = kt(pr, e.lens, 0, 19, e.lencode, 0, e.work, x), e.lenbits = x.bits, T) {
                        t.msg = "invalid code lengths set", e.mode = R;
                        break;
                    }
                    e.have = 0, e.mode = oi;
                /* falls through */
                case oi:
                    for (; e.have < e.nlen + e.ndist; ) {
                        for (; y = e.lencode[s & (1 << e.lenbits) - 1], b = y >>> 24, v = y >>> 16 & 255, g = y & 65535, !(b <= l); ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        if (g < 16)
                            s >>>= b, l -= b, e.lens[e.have++] = g;
                        else {
                            if (g === 16) {
                                for (E = b + 2; l < E; ) {
                                    if (o === 0)
                                        break t;
                                    o--, s += n[a++] << l, l += 8;
                                }
                                if (s >>>= b, l -= b, e.have === 0) {
                                    t.msg = "invalid bit length repeat", e.mode = R;
                                    break;
                                }
                                w = e.lens[e.have - 1], f = 3 + (s & 3), s >>>= 2, l -= 2;
                            } else if (g === 17) {
                                for (E = b + 3; l < E; ) {
                                    if (o === 0)
                                        break t;
                                    o--, s += n[a++] << l, l += 8;
                                }
                                s >>>= b, l -= b, w = 0, f = 3 + (s & 7), s >>>= 3, l -= 3;
                            } else {
                                for (E = b + 7; l < E; ) {
                                    if (o === 0)
                                        break t;
                                    o--, s += n[a++] << l, l += 8;
                                }
                                s >>>= b, l -= b, w = 0, f = 11 + (s & 127), s >>>= 7, l -= 7;
                            }
                            if (e.have + f > e.nlen + e.ndist) {
                                t.msg = "invalid bit length repeat", e.mode = R;
                                break;
                            }
                            for (; f--; )
                                e.lens[e.have++] = w;
                        }
                    }
                    if (e.mode === R)
                        break;
                    if (e.lens[256] === 0) {
                        t.msg = "invalid code -- missing end-of-block", e.mode = R;
                        break;
                    }
                    if (e.lenbits = 9, x = { bits: e.lenbits }, T = kt(Gi, e.lens, 0, e.nlen, e.lencode, 0, e.work, x), e.lenbits = x.bits, T) {
                        t.msg = "invalid literal/lengths set", e.mode = R;
                        break;
                    }
                    if (e.distbits = 6, e.distcode = e.distdyn, x = { bits: e.distbits }, T = kt(Xi, e.lens, e.nlen, e.ndist, e.distcode, 0, e.work, x), e.distbits = x.bits, T) {
                        t.msg = "invalid distances set", e.mode = R;
                        break;
                    }
                    if (e.mode = $t, i === Zt)
                        break t;
                /* falls through */
                case $t:
                    e.mode = Ft;
                /* falls through */
                case Ft:
                    if (o >= 6 && d >= 258) {
                        t.next_out = h, t.avail_out = d, t.next_in = a, t.avail_in = o, e.hold = s, e.bits = l, lr(t, c), h = t.next_out, r = t.output, d = t.avail_out, a = t.next_in, n = t.input, o = t.avail_in, s = e.hold, l = e.bits, e.mode === K && (e.back = -1);
                        break;
                    }
                    for (e.back = 0; y = e.lencode[s & (1 << e.lenbits) - 1], b = y >>> 24, v = y >>> 16 & 255, g = y & 65535, !(b <= l); ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    if (v && (v & 240) === 0) {
                        for (_ = b, k = v, O = g; y = e.lencode[O + ((s & (1 << _ + k) - 1) >> _)], b = y >>> 24, v = y >>> 16 & 255, g = y & 65535, !(_ + b <= l); ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        s >>>= _, l -= _, e.back += _;
                    }
                    if (s >>>= b, l -= b, e.back += b, e.length = g, v === 0) {
                        e.mode = ci;
                        break;
                    }
                    if (v & 32) {
                        e.back = -1, e.mode = K;
                        break;
                    }
                    if (v & 64) {
                        t.msg = "invalid literal/length code", e.mode = R;
                        break;
                    }
                    e.extra = v & 15, e.mode = hi;
                /* falls through */
                case hi:
                    if (e.extra) {
                        for (E = e.extra; l < E; ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        e.length += s & (1 << e.extra) - 1, s >>>= e.extra, l -= e.extra, e.back += e.extra;
                    }
                    e.was = e.length, e.mode = li;
                /* falls through */
                case li:
                    for (; y = e.distcode[s & (1 << e.distbits) - 1], b = y >>> 24, v = y >>> 16 & 255, g = y & 65535, !(b <= l); ) {
                        if (o === 0)
                            break t;
                        o--, s += n[a++] << l, l += 8;
                    }
                    if ((v & 240) === 0) {
                        for (_ = b, k = v, O = g; y = e.distcode[O + ((s & (1 << _ + k) - 1) >> _)], b = y >>> 24, v = y >>> 16 & 255, g = y & 65535, !(_ + b <= l); ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        s >>>= _, l -= _, e.back += _;
                    }
                    if (s >>>= b, l -= b, e.back += b, v & 64) {
                        t.msg = "invalid distance code", e.mode = R;
                        break;
                    }
                    e.offset = g, e.extra = v & 15, e.mode = fi;
                /* falls through */
                case fi:
                    if (e.extra) {
                        for (E = e.extra; l < E; ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        e.offset += s & (1 << e.extra) - 1, s >>>= e.extra, l -= e.extra, e.back += e.extra;
                    }
                    if (e.offset > e.dmax) {
                        t.msg = "invalid distance too far back", e.mode = R;
                        break;
                    }
                    e.mode = di;
                /* falls through */
                case di:
                    if (d === 0)
                        break t;
                    if (f = c - d, e.offset > f) {
                        if (f = e.offset - f, f > e.whave && e.sane) {
                            t.msg = "invalid distance too far back", e.mode = R;
                            break;
                        }
                        f > e.wnext ? (f -= e.wnext, p = e.wsize - f) : p = e.wnext - f, f > e.length && (f = e.length), U = e.window;
                    } else
                        U = r, p = h - e.offset, f = e.length;
                    f > d && (f = d), d -= f, e.length -= f;
                    do
                        r[h++] = U[p++];
                    while (--f);
                    e.length === 0 && (e.mode = Ft);
                    break;
                case ci:
                    if (d === 0)
                        break t;
                    r[h++] = e.length, d--, e.mode = Ft;
                    break;
                case le:
                    if (e.wrap) {
                        for (; l < 32; ) {
                            if (o === 0)
                                break t;
                            o--, s |= n[a++] << l, l += 8;
                        }
                        if (c -= d, t.total_out += c, e.total += c, e.wrap & 4 && c && (t.adler = e.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
                            e.flags ? N(e.check, r, c, h - c) : Tt(e.check, r, c, h - c)), c = d, e.wrap & 4 && (e.flags ? s : pi(s)) !== e.check) {
                            t.msg = "incorrect data check", e.mode = R;
                            break;
                        }
                        s = 0, l = 0;
                    }
                    e.mode = _i;
                /* falls through */
                case _i:
                    if (e.wrap && e.flags) {
                        for (; l < 32; ) {
                            if (o === 0)
                                break t;
                            o--, s += n[a++] << l, l += 8;
                        }
                        if (e.wrap & 4 && s !== (e.total & 4294967295)) {
                            t.msg = "incorrect length check", e.mode = R;
                            break;
                        }
                        s = 0, l = 0;
                    }
                    e.mode = ui;
                /* falls through */
                case ui:
                    T = gr;
                    break t;
                case R:
                    T = ji;
                    break t;
                case qi:
                    return Vi;
                case Ji:
                /* falls through */
                default:
                    return Z;
            }
    return t.next_out = h, t.avail_out = d, t.next_in = a, t.avail_in = o, e.hold = s, e.bits = l, (e.wsize || c !== t.avail_out && e.mode < R && (e.mode < le || i !== Ye)) && an(t, t.output, t.next_out, c - t.avail_out), u -= t.avail_in, c -= t.avail_out, t.total_in += u, t.total_out += c, e.total += c, e.wrap & 4 && c && (t.adler = e.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
        e.flags ? N(e.check, r, c, t.next_out - c) : Tt(e.check, r, c, t.next_out - c)), t.data_type = e.bits + (e.last ? 64 : 0) + (e.mode === K ? 128 : 0) + (e.mode === $t || e.mode === he ? 256 : 0), (u === 0 && c === 0 || i === Ye) && T === rt && (T = xr), T;
}, Tr = (t) => {
    if (st(t))
        return Z;
    let i = t.state;
    return i.window && (i.window = null), t.state = null, rt;
}, Or = (t, i) => {
    if (st(t))
        return Z;
    const e = t.state;
    return (e.wrap & 2) === 0 ? Z : (e.head = i, i.done = !1, rt);
}, Rr = (t, i) => {
    const e = i.length;
    let n, r, a;
    return st(t) || (n = t.state, n.wrap !== 0 && n.mode !== Gt) ? Z : n.mode === Gt && (r = 1, r = Tt(r, i, e, 0), r !== n.check) ? ji : (a = an(t, i, e, e), a ? (n.mode = qi, Vi) : (n.havedict = 1, rt));
};
var Dr = tn, Nr = en, Cr = Qi, Ir = mr, zr = nn, Lr = Ur, Br = Tr, Mr = Or, Zr = Rr, $r = "pako inflate (from Nodeca project)", Y = {
    inflateReset: Dr,
    inflateReset2: Nr,
    inflateResetKeep: Cr,
    inflateInit: Ir,
    inflateInit2: zr,
    inflate: Lr,
    inflateEnd: Br,
    inflateGetHeader: Mr,
    inflateSetDictionary: Zr,
    inflateInfo: $r
};
function Fr() {
    this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
}
var Hr = Fr;
const rn = Object.prototype.toString, {
    Z_NO_FLUSH: Pr,
    Z_FINISH: Kr,
    Z_OK: Dt,
    Z_STREAM_END: ce,
    Z_NEED_DICT: _e,
    Z_STREAM_ERROR: Wr,
    Z_DATA_ERROR: gi,
    Z_MEM_ERROR: Yr
} = Xt;
function It(t) {
    this.options = Vt.assign({
        chunkSize: 1024 * 64,
        windowBits: 15,
        to: ""
    }, t || {});
    const i = this.options;
    i.raw && i.windowBits >= 0 && i.windowBits < 16 && (i.windowBits = -i.windowBits, i.windowBits === 0 && (i.windowBits = -15)), i.windowBits >= 0 && i.windowBits < 16 && !(t && t.windowBits) && (i.windowBits += 32), i.windowBits > 15 && i.windowBits < 48 && (i.windowBits & 15) === 0 && (i.windowBits |= 15), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new Wi(), this.strm.avail_out = 0;
    let e = Y.inflateInit2(
        this.strm,
        i.windowBits
    );
    if (e !== Dt)
        throw new Error(nt[e]);
    if (this.header = new Hr(), Y.inflateGetHeader(this.strm, this.header), i.dictionary && (typeof i.dictionary == "string" ? i.dictionary = Rt.string2buf(i.dictionary) : rn.call(i.dictionary) === "[object ArrayBuffer]" && (i.dictionary = new Uint8Array(i.dictionary)), i.raw && (e = Y.inflateSetDictionary(this.strm, i.dictionary), e !== Dt)))
        throw new Error(nt[e]);
}
It.prototype.push = function(t, i) {
    const e = this.strm, n = this.options.chunkSize, r = this.options.dictionary;
    let a, h, o;
    if (this.ended) return !1;
    for (i === ~~i ? h = i : h = i === !0 ? Kr : Pr, rn.call(t) === "[object ArrayBuffer]" ? e.input = new Uint8Array(t) : e.input = t, e.next_in = 0, e.avail_in = e.input.length; ; ) {
        for (e.avail_out === 0 && (e.output = new Uint8Array(n), e.next_out = 0, e.avail_out = n), a = Y.inflate(e, h), a === _e && r && (a = Y.inflateSetDictionary(e, r), a === Dt ? a = Y.inflate(e, h) : a === gi && (a = _e)); e.avail_in > 0 && a === ce && e.state.wrap > 0 && t[e.next_in] !== 0; )
            Y.inflateReset(e), a = Y.inflate(e, h);
        switch (a) {
            case Wr:
            case gi:
            case _e:
            case Yr:
                return this.onEnd(a), this.ended = !0, !1;
        }
        if (o = e.avail_out, e.next_out && (e.avail_out === 0 || a === ce))
            if (this.options.to === "string") {
                let d = Rt.utf8border(e.output, e.next_out), s = e.next_out - d, l = Rt.buf2string(e.output, d);
                e.next_out = s, e.avail_out = n - s, s && e.output.set(e.output.subarray(d, d + s), 0), this.onData(l);
            } else
                this.onData(e.output.length === e.next_out ? e.output : e.output.subarray(0, e.next_out));
        if (!(a === Dt && o === 0)) {
            if (a === ce)
                return a = Y.inflateEnd(this.strm), this.onEnd(a), this.ended = !0, !0;
            if (e.avail_in === 0) break;
        }
    }
    return !0;
};
It.prototype.onData = function(t) {
    this.chunks.push(t);
};
It.prototype.onEnd = function(t) {
    t === Dt && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Vt.flattenChunks(this.chunks)), this.chunks = [], this.err = t, this.msg = this.strm.msg;
};
function Gr(t, i) {
    const e = new It(i);
    if (e.push(t), e.err) throw e.msg || nt[e.err];
    return e.result;
}
var Xr = It, jr = Gr, Vr = {
    Inflate: Xr,
    inflate: jr
};
const { deflate: qr } = or, { Inflate: Jr, inflate: Qr } = Vr;
var ts = qr, bi = Jr, es = Qr;
const sn = [];
for (let t = 0; t < 256; t++) {
    let i = t;
    for (let e = 0; e < 8; e++)
        i & 1 ? i = 3988292384 ^ i >>> 1 : i = i >>> 1;
    sn[t] = i;
}
const xi = 4294967295;
function is(t, i, e) {
    let n = t;
    for (let r = 0; r < e; r++)
        n = sn[(n ^ i[r]) & 255] ^ n >>> 8;
    return n;
}
function on(t, i) {
    return (is(xi, t, i) ^ xi) >>> 0;
}
function yi(t, i, e) {
    const n = t.readUint32(), r = on(new Uint8Array(t.buffer, t.byteOffset + t.offset - i - 4, i), i);
    if (r !== n)
        throw new Error(`CRC mismatch for chunk ${e}. Expected ${n}, found ${r}`);
}
function lt(t, i) {
    t.writeUint32(on(new Uint8Array(t.buffer, t.byteOffset + t.offset - i, i), i));
}
function hn(t, i, e) {
    for (let n = 0; n < e; n++)
        i[n] = t[n];
}
function ln(t, i, e, n) {
    let r = 0;
    for (; r < n; r++)
        i[r] = t[r];
    for (; r < e; r++)
        i[r] = t[r] + i[r - n] & 255;
}
function fn(t, i, e, n) {
    let r = 0;
    if (e.length === 0)
        for (; r < n; r++)
            i[r] = t[r];
    else
        for (; r < n; r++)
            i[r] = t[r] + e[r] & 255;
}
function dn(t, i, e, n, r) {
    let a = 0;
    if (e.length === 0) {
        for (; a < r; a++)
            i[a] = t[a];
        for (; a < n; a++)
            i[a] = t[a] + (i[a - r] >> 1) & 255;
    } else {
        for (; a < r; a++)
            i[a] = t[a] + (e[a] >> 1) & 255;
        for (; a < n; a++)
            i[a] = t[a] + (i[a - r] + e[a] >> 1) & 255;
    }
}
function cn(t, i, e, n, r) {
    let a = 0;
    if (e.length === 0) {
        for (; a < r; a++)
            i[a] = t[a];
        for (; a < n; a++)
            i[a] = t[a] + i[a - r] & 255;
    } else {
        for (; a < r; a++)
            i[a] = t[a] + e[a] & 255;
        for (; a < n; a++)
            i[a] = t[a] + ns(i[a - r], e[a], e[a - r]) & 255;
    }
}
function ns(t, i, e) {
    const n = t + i - e, r = Math.abs(n - t), a = Math.abs(n - i), h = Math.abs(n - e);
    return r <= a && r <= h ? t : a <= h ? i : e;
}
function as(t, i, e, n, r, a) {
    switch (t) {
        case 0:
            hn(i, e, r);
            break;
        case 1:
            ln(i, e, r, a);
            break;
        case 2:
            fn(i, e, n, r);
            break;
        case 3:
            dn(i, e, n, r, a);
            break;
        case 4:
            cn(i, e, n, r, a);
            break;
        default:
            throw new Error(`Unsupported filter: ${t}`);
    }
}
const rs = new Uint16Array([255]), ss = new Uint8Array(rs.buffer), os = ss[0] === 255;
function hs(t) {
    const { data: i, width: e, height: n, channels: r, depth: a } = t, h = [
        { x: 0, y: 0, xStep: 8, yStep: 8 },
        // Pass 1
        { x: 4, y: 0, xStep: 8, yStep: 8 },
        // Pass 2
        { x: 0, y: 4, xStep: 4, yStep: 8 },
        // Pass 3
        { x: 2, y: 0, xStep: 4, yStep: 4 },
        // Pass 4
        { x: 0, y: 2, xStep: 2, yStep: 4 },
        // Pass 5
        { x: 1, y: 0, xStep: 2, yStep: 2 },
        // Pass 6
        { x: 0, y: 1, xStep: 1, yStep: 2 }
        // Pass 7
    ], o = Math.ceil(a / 8) * r, d = new Uint8Array(n * e * o);
    let s = 0;
    for (let l = 0; l < 7; l++) {
        const u = h[l], c = Math.ceil((e - u.x) / u.xStep), f = Math.ceil((n - u.y) / u.yStep);
        if (c <= 0 || f <= 0)
            continue;
        const p = c * o, U = new Uint8Array(p);
        for (let y = 0; y < f; y++) {
            const b = i[s++], v = i.subarray(s, s + p);
            s += p;
            const g = new Uint8Array(p);
            as(b, v, g, U, p, o), U.set(g);
            for (let _ = 0; _ < c; _++) {
                const k = u.x + _ * u.xStep, O = u.y + y * u.yStep;
                if (!(k >= e || O >= n))
                    for (let w = 0; w < o; w++)
                        d[(O * e + k) * o + w] = g[_ * o + w];
            }
        }
    }
    if (a === 16) {
        const l = new Uint16Array(d.buffer);
        if (os)
            for (let u = 0; u < l.length; u++)
                l[u] = ls(l[u]);
        return l;
    } else
        return d;
}
function ls(t) {
    return (t & 255) << 8 | t >> 8 & 255;
}
const fs = new Uint16Array([255]), ds = new Uint8Array(fs.buffer), cs = ds[0] === 255, _s = new Uint8Array(0);
function ki(t) {
    const { data: i, width: e, height: n, channels: r, depth: a } = t, h = Math.ceil(a / 8) * r, o = Math.ceil(a / 8 * r * e), d = new Uint8Array(n * o);
    let s = _s, l = 0, u, c;
    for (let f = 0; f < n; f++) {
        switch (u = i.subarray(l + 1, l + 1 + o), c = d.subarray(f * o, (f + 1) * o), i[l]) {
            case 0:
                hn(u, c, o);
                break;
            case 1:
                ln(u, c, o, h);
                break;
            case 2:
                fn(u, c, s, o);
                break;
            case 3:
                dn(u, c, s, o, h);
                break;
            case 4:
                cn(u, c, s, o, h);
                break;
            default:
                throw new Error(`Unsupported filter: ${i[l]}`);
        }
        s = c, l += o + 1;
    }
    if (a === 16) {
        const f = new Uint16Array(d.buffer);
        if (cs)
            for (let p = 0; p < f.length; p++)
                f[p] = us(f[p]);
        return f;
    } else
        return d;
}
function us(t) {
    return (t & 255) << 8 | t >> 8 & 255;
}
const Et = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
function ps(t) {
    t.writeBytes(Et);
}
function Ei(t) {
    if (!_n(t.readBytes(Et.length)))
        throw new Error("wrong PNG signature");
}
function _n(t) {
    if (t.length < Et.length)
        return !1;
    for (let i = 0; i < Et.length; i++)
        if (t[i] !== Et[i])
            return !1;
    return !0;
}
const un = "tEXt", pn = 0, wn = new TextDecoder("latin1");
function gn(t) {
    if (bn(t), t.length === 0 || t.length > 79)
        throw new Error("keyword length must be between 1 and 79");
}
const ws = /^[\u0000-\u00FF]*$/;
function bn(t) {
    if (!ws.test(t))
        throw new Error("invalid latin1 text");
}
function gs(t, i, e) {
    const n = xn(i);
    t[n] = xs(i, e - n.length - 1);
}
function bs(t, i, e) {
    gn(i), bn(e);
    const n = i.length + 1 + e.length;
    t.writeUint32(n), t.writeChars(un), t.writeChars(i), t.writeByte(pn), t.writeChars(e), lt(t, n + 4);
}
function xn(t) {
    for (t.mark(); t.readByte() !== pn; )
        ;
    const i = t.offset;
    t.reset();
    const e = wn.decode(t.readBytes(i - t.offset - 1));
    return t.skip(1), gn(e), e;
}
function xs(t, i) {
    return wn.decode(t.readBytes(i));
}
const D = {
    UNKNOWN: -1,
    GREYSCALE: 0,
    TRUECOLOUR: 2,
    INDEXED_COLOUR: 3,
    GREYSCALE_ALPHA: 4,
    TRUECOLOUR_ALPHA: 6
}, Kt = {
    UNKNOWN: -1,
    DEFLATE: 0
}, ve = {
    UNKNOWN: -1,
    ADAPTIVE: 0
}, X = {
    UNKNOWN: -1,
    NO_INTERLACE: 0,
    ADAM7: 1
}, Ht = {
    NONE: 0,
    BACKGROUND: 1,
    PREVIOUS: 2
}, ue = {
    SOURCE: 0,
    OVER: 1
};
class yn extends At {
    _checkCrc;
    _inflator;
    _png;
    _apng;
    _end;
    _hasPalette;
    _palette;
    _hasTransparency;
    _transparency;
    _compressionMethod;
    _filterMethod;
    _interlaceMethod;
    _colorType;
    _isAnimated;
    _numberOfFrames;
    _numberOfPlays;
    _frames;
    _writingDataChunks;
    constructor(i, e = {}) {
        super(i);
        const { checkCrc: n = !1 } = e;
        this._checkCrc = n, this._inflator = new bi(), this._png = {
            width: -1,
            height: -1,
            channels: -1,
            data: new Uint8Array(0),
            depth: 1,
            text: {}
        }, this._apng = {
            width: -1,
            height: -1,
            channels: -1,
            depth: 1,
            numberOfFrames: 1,
            numberOfPlays: 0,
            text: {},
            frames: []
        }, this._end = !1, this._hasPalette = !1, this._palette = [], this._hasTransparency = !1, this._transparency = new Uint16Array(0), this._compressionMethod = Kt.UNKNOWN, this._filterMethod = ve.UNKNOWN, this._interlaceMethod = X.UNKNOWN, this._colorType = D.UNKNOWN, this._isAnimated = !1, this._numberOfFrames = 1, this._numberOfPlays = 0, this._frames = [], this._writingDataChunks = !1, this.setBigEndian();
    }
    decode() {
        for (Ei(this); !this._end; ) {
            const i = this.readUint32(), e = this.readChars(4);
            this.decodeChunk(i, e);
        }
        return this.decodeImage(), this._png;
    }
    decodeApng() {
        for (Ei(this); !this._end; ) {
            const i = this.readUint32(), e = this.readChars(4);
            this.decodeApngChunk(i, e);
        }
        return this.decodeApngImage(), this._apng;
    }
    // https://www.w3.org/TR/PNG/#5Chunk-layout
    decodeChunk(i, e) {
        const n = this.offset;
        switch (e) {
            // 11.2 Critical chunks
            case "IHDR":
                this.decodeIHDR();
                break;
            case "PLTE":
                this.decodePLTE(i);
                break;
            case "IDAT":
                this.decodeIDAT(i);
                break;
            case "IEND":
                this._end = !0;
                break;
            // 11.3 Ancillary chunks
            case "tRNS":
                this.decodetRNS(i);
                break;
            case "iCCP":
                this.decodeiCCP(i);
                break;
            case un:
                gs(this._png.text, this, i);
                break;
            case "pHYs":
                this.decodepHYs();
                break;
            default:
                this.skip(i);
                break;
        }
        if (this.offset - n !== i)
            throw new Error(`Length mismatch while decoding chunk ${e}`);
        this._checkCrc ? yi(this, i + 4, e) : this.skip(4);
    }
    decodeApngChunk(i, e) {
        const n = this.offset;
        switch (e !== "fdAT" && e !== "IDAT" && this._writingDataChunks && this.pushDataToFrame(), e) {
            case "acTL":
                this.decodeACTL();
                break;
            case "fcTL":
                this.decodeFCTL();
                break;
            case "fdAT":
                this.decodeFDAT(i);
                break;
            default:
                this.decodeChunk(i, e), this.offset = n + i;
                break;
        }
        if (this.offset - n !== i)
            throw new Error(`Length mismatch while decoding chunk ${e}`);
        this._checkCrc ? yi(this, i + 4, e) : this.skip(4);
    }
    // https://www.w3.org/TR/PNG/#11IHDR
    decodeIHDR() {
        const i = this._png;
        i.width = this.readUint32(), i.height = this.readUint32(), i.depth = ys(this.readUint8());
        const e = this.readUint8();
        this._colorType = e;
        let n;
        switch (e) {
            case D.GREYSCALE:
                n = 1;
                break;
            case D.TRUECOLOUR:
                n = 3;
                break;
            case D.INDEXED_COLOUR:
                n = 1;
                break;
            case D.GREYSCALE_ALPHA:
                n = 2;
                break;
            case D.TRUECOLOUR_ALPHA:
                n = 4;
                break;
            // Kept for exhaustiveness.
            // eslint-disable-next-line unicorn/no-useless-switch-case
            case D.UNKNOWN:
            default:
                throw new Error(`Unknown color type: ${e}`);
        }
        if (this._png.channels = n, this._compressionMethod = this.readUint8(), this._compressionMethod !== Kt.DEFLATE)
            throw new Error(`Unsupported compression method: ${this._compressionMethod}`);
        this._filterMethod = this.readUint8(), this._interlaceMethod = this.readUint8();
    }
    decodeACTL() {
        this._numberOfFrames = this.readUint32(), this._numberOfPlays = this.readUint32(), this._isAnimated = !0;
    }
    decodeFCTL() {
        const i = {
            sequenceNumber: this.readUint32(),
            width: this.readUint32(),
            height: this.readUint32(),
            xOffset: this.readUint32(),
            yOffset: this.readUint32(),
            delayNumber: this.readUint16(),
            delayDenominator: this.readUint16(),
            disposeOp: this.readUint8(),
            blendOp: this.readUint8(),
            data: new Uint8Array(0)
        };
        this._frames.push(i);
    }
    // https://www.w3.org/TR/PNG/#11PLTE
    decodePLTE(i) {
        if (i % 3 !== 0)
            throw new RangeError(`PLTE field length must be a multiple of 3. Got ${i}`);
        const e = i / 3;
        this._hasPalette = !0;
        const n = [];
        this._palette = n;
        for (let r = 0; r < e; r++)
            n.push([this.readUint8(), this.readUint8(), this.readUint8()]);
    }
    // https://www.w3.org/TR/PNG/#11IDAT
    decodeIDAT(i) {
        this._writingDataChunks = !0;
        const e = i, n = this.offset + this.byteOffset;
        if (this._inflator.push(new Uint8Array(this.buffer, n, e)), this._inflator.err)
            throw new Error(`Error while decompressing the data: ${this._inflator.err}`);
        this.skip(i);
    }
    decodeFDAT(i) {
        this._writingDataChunks = !0;
        let e = i, n = this.offset + this.byteOffset;
        if (n += 4, e -= 4, this._inflator.push(new Uint8Array(this.buffer, n, e)), this._inflator.err)
            throw new Error(`Error while decompressing the data: ${this._inflator.err}`);
        this.skip(i);
    }
    // https://www.w3.org/TR/PNG/#11tRNS
    decodetRNS(i) {
        switch (this._colorType) {
            case D.GREYSCALE:
            case D.TRUECOLOUR: {
                if (i % 2 !== 0)
                    throw new RangeError(`tRNS chunk length must be a multiple of 2. Got ${i}`);
                if (i / 2 > this._png.width * this._png.height)
                    throw new Error(`tRNS chunk contains more alpha values than there are pixels (${i / 2} vs ${this._png.width * this._png.height})`);
                this._hasTransparency = !0, this._transparency = new Uint16Array(i / 2);
                for (let e = 0; e < i / 2; e++)
                    this._transparency[e] = this.readUint16();
                break;
            }
            case D.INDEXED_COLOUR: {
                if (i > this._palette.length)
                    throw new Error(`tRNS chunk contains more alpha values than there are palette colors (${i} vs ${this._palette.length})`);
                let e = 0;
                for (; e < i; e++) {
                    const n = this.readByte();
                    this._palette[e].push(n);
                }
                for (; e < this._palette.length; e++)
                    this._palette[e].push(255);
                break;
            }
            // Kept for exhaustiveness.
            /* eslint-disable unicorn/no-useless-switch-case */
            case D.UNKNOWN:
            case D.GREYSCALE_ALPHA:
            case D.TRUECOLOUR_ALPHA:
            default:
                throw new Error(`tRNS chunk is not supported for color type ${this._colorType}`);
        }
    }
    // https://www.w3.org/TR/PNG/#11iCCP
    decodeiCCP(i) {
        const e = xn(this), n = this.readUint8();
        if (n !== Kt.DEFLATE)
            throw new Error(`Unsupported iCCP compression method: ${n}`);
        const r = this.readBytes(i - e.length - 2);
        this._png.iccEmbeddedProfile = {
            name: e,
            profile: es(r)
        };
    }
    // https://www.w3.org/TR/PNG/#11pHYs
    decodepHYs() {
        const i = this.readUint32(), e = this.readUint32(), n = this.readByte();
        this._png.resolution = {
            x: i,
            y: e,
            unit: n
        };
    }
    decodeApngImage() {
        this._apng.width = this._png.width, this._apng.height = this._png.height, this._apng.channels = this._png.channels, this._apng.depth = this._png.depth, this._apng.numberOfFrames = this._numberOfFrames, this._apng.numberOfPlays = this._numberOfPlays, this._apng.text = this._png.text, this._apng.resolution = this._png.resolution;
        for (let i = 0; i < this._numberOfFrames; i++) {
            const e = {
                sequenceNumber: this._frames[i].sequenceNumber,
                delayNumber: this._frames[i].delayNumber,
                delayDenominator: this._frames[i].delayDenominator,
                data: this._apng.depth === 8 ? new Uint8Array(this._apng.width * this._apng.height * this._apng.channels) : new Uint16Array(this._apng.width * this._apng.height * this._apng.channels)
            }, n = this._frames.at(i);
            if (n) {
                if (n.data = ki({
                    data: n.data,
                    width: n.width,
                    height: n.height,
                    channels: this._apng.channels,
                    depth: this._apng.depth
                }), this._hasPalette && (this._apng.palette = this._palette), this._hasTransparency && (this._apng.transparency = this._transparency), i === 0 || n.xOffset === 0 && n.yOffset === 0 && n.width === this._png.width && n.height === this._png.height)
                    e.data = n.data;
                else {
                    const r = this._apng.frames.at(i - 1);
                    this.disposeFrame(n, r, e), this.addFrameDataToCanvas(e, n);
                }
                this._apng.frames.push(e);
            }
        }
        return this._apng;
    }
    disposeFrame(i, e, n) {
        switch (i.disposeOp) {
            case Ht.NONE:
                break;
            case Ht.BACKGROUND:
                for (let r = 0; r < this._png.height; r++)
                    for (let a = 0; a < this._png.width; a++) {
                        const h = (r * i.width + a) * this._png.channels;
                        for (let o = 0; o < this._png.channels; o++)
                            n.data[h + o] = 0;
                    }
                break;
            case Ht.PREVIOUS:
                n.data.set(e.data);
                break;
            default:
                throw new Error("Unknown disposeOp");
        }
    }
    addFrameDataToCanvas(i, e) {
        const n = 1 << this._png.depth, r = (a, h) => {
            const o = ((a + e.yOffset) * this._png.width + e.xOffset + h) * this._png.channels, d = (a * e.width + h) * this._png.channels;
            return { index: o, frameIndex: d };
        };
        switch (e.blendOp) {
            case ue.SOURCE:
                for (let a = 0; a < e.height; a++)
                    for (let h = 0; h < e.width; h++) {
                        const { index: o, frameIndex: d } = r(a, h);
                        for (let s = 0; s < this._png.channels; s++)
                            i.data[o + s] = e.data[d + s];
                    }
                break;
            // https://www.w3.org/TR/png-3/#13Alpha-channel-processing
            case ue.OVER:
                for (let a = 0; a < e.height; a++)
                    for (let h = 0; h < e.width; h++) {
                        const { index: o, frameIndex: d } = r(a, h);
                        for (let s = 0; s < this._png.channels; s++) {
                            const l = e.data[d + this._png.channels - 1] / n, u = s % (this._png.channels - 1) === 0 ? 1 : e.data[d + s], c = Math.floor(l * u + (1 - l) * i.data[o + s]);
                            i.data[o + s] += c;
                        }
                    }
                break;
            default:
                throw new Error("Unknown blendOp");
        }
    }
    decodeImage() {
        if (this._inflator.err)
            throw new Error(`Error while decompressing the data: ${this._inflator.err}`);
        const i = this._isAnimated ? (this._frames?.at(0)).data : this._inflator.result;
        if (this._filterMethod !== ve.ADAPTIVE)
            throw new Error(`Filter method ${this._filterMethod} not supported`);
        if (this._interlaceMethod === X.NO_INTERLACE)
            this._png.data = ki({
                data: i,
                width: this._png.width,
                height: this._png.height,
                channels: this._png.channels,
                depth: this._png.depth
            });
        else if (this._interlaceMethod === X.ADAM7)
            this._png.data = hs({
                data: i,
                width: this._png.width,
                height: this._png.height,
                channels: this._png.channels,
                depth: this._png.depth
            });
        else
            throw new Error(`Interlace method ${this._interlaceMethod} not supported`);
        this._hasPalette && (this._png.palette = this._palette), this._hasTransparency && (this._png.transparency = this._transparency);
    }
    pushDataToFrame() {
        const i = this._inflator.result, e = this._frames.at(-1);
        e ? e.data = i : this._frames.push({
            sequenceNumber: 0,
            width: this._png.width,
            height: this._png.height,
            xOffset: 0,
            yOffset: 0,
            delayNumber: 0,
            delayDenominator: 0,
            disposeOp: Ht.NONE,
            blendOp: ue.SOURCE,
            data: i
        }), this._inflator = new bi(), this._writingDataChunks = !1;
    }
}
function ys(t) {
    if (t !== 1 && t !== 2 && t !== 4 && t !== 8 && t !== 16)
        throw new Error(`invalid bit depth: ${t}`);
    return t;
}
const ks = {
    level: 3
};
class Es extends At {
    _png;
    _zlibOptions;
    _colorType;
    _interlaceMethod;
    constructor(i, e = {}) {
        super(), this._colorType = D.UNKNOWN, this._zlibOptions = { ...ks, ...e.zlib }, this._png = this._checkData(i), this._interlaceMethod = (e.interlace === "Adam7" ? X.ADAM7 : X.NO_INTERLACE) ?? X.NO_INTERLACE, this.setBigEndian();
    }
    encode() {
        if (ps(this), this.encodeIHDR(), this._png.palette && (this.encodePLTE(), this._png.palette[0].length === 4 && this.encodeTRNS()), this.encodeData(), this._png.text)
            for (const [i, e] of Object.entries(this._png.text))
                bs(this, i, e);
        return this.encodeIEND(), this.toArray();
    }
    // https://www.w3.org/TR/PNG/#11IHDR
    encodeIHDR() {
        this.writeUint32(13), this.writeChars("IHDR"), this.writeUint32(this._png.width), this.writeUint32(this._png.height), this.writeByte(this._png.depth), this.writeByte(this._colorType), this.writeByte(Kt.DEFLATE), this.writeByte(ve.ADAPTIVE), this.writeByte(this._interlaceMethod), lt(this, 17);
    }
    // https://www.w3.org/TR/PNG/#11IEND
    encodeIEND() {
        this.writeUint32(0), this.writeChars("IEND"), lt(this, 4);
    }
    encodePLTE() {
        const i = this._png.palette?.length * 3;
        this.writeUint32(i), this.writeChars("PLTE");
        for (const e of this._png.palette)
            this.writeByte(e[0]), this.writeByte(e[1]), this.writeByte(e[2]);
        lt(this, 4 + i);
    }
    encodeTRNS() {
        const i = this._png.palette.filter((e) => e.at(-1) !== 255);
        this.writeUint32(i.length), this.writeChars("tRNS");
        for (const e of i)
            this.writeByte(e.at(-1));
        lt(this, 4 + i.length);
    }
    // https://www.w3.org/TR/PNG/#11IDAT
    encodeIDAT(i) {
        this.writeUint32(i.length), this.writeChars("IDAT"), this.writeBytes(i), lt(this, i.length + 4);
    }
    encodeData() {
        const { width: i, height: e, channels: n, depth: r, data: a } = this._png, h = r <= 8 ? Math.ceil(i * r / 8) * n : Math.ceil(i * r / 8 * n / 2), o = new At().setBigEndian();
        let d = 0;
        if (this._interlaceMethod === X.NO_INTERLACE)
            for (let u = 0; u < e; u++)
                o.writeByte(0), r === 16 ? d = Ss(a, o, h, d) : d = vs(a, o, h, d);
        else this._interlaceMethod === X.ADAM7 && (d = ms(this._png, a, o, d));
        const s = o.toArray(), l = ts(s, this._zlibOptions);
        this.encodeIDAT(l);
    }
    _checkData(i) {
        const { colorType: e, channels: n, depth: r } = As(i, i.palette), a = {
            width: Ai(i.width, "width"),
            height: Ai(i.height, "height"),
            channels: n,
            data: i.data,
            depth: r,
            text: i.text,
            palette: i.palette
        };
        this._colorType = e;
        const h = r < 8 ? Math.ceil(a.width * r / 8) * a.height * n : a.width * a.height * n;
        if (a.data.length !== h)
            throw new RangeError(`wrong data size. Found ${a.data.length}, expected ${h}`);
        return a;
    }
}
function Ai(t, i) {
    if (Number.isInteger(t) && t > 0)
        return t;
    throw new TypeError(`${i} must be a positive integer`);
}
function As(t, i) {
    const { channels: e = 4, depth: n = 8 } = t;
    if (e !== 4 && e !== 3 && e !== 2 && e !== 1)
        throw new RangeError(`unsupported number of channels: ${e}`);
    const r = {
        channels: e,
        depth: n,
        colorType: D.UNKNOWN
    };
    switch (e) {
        case 4:
            r.colorType = D.TRUECOLOUR_ALPHA;
            break;
        case 3:
            r.colorType = D.TRUECOLOUR;
            break;
        case 1:
            i ? r.colorType = D.INDEXED_COLOUR : r.colorType = D.GREYSCALE;
            break;
        case 2:
            r.colorType = D.GREYSCALE_ALPHA;
            break;
        default:
            throw new Error("unsupported number of channels");
    }
    return r;
}
function vs(t, i, e, n) {
    for (let r = 0; r < e; r++)
        i.writeByte(t[n++]);
    return n;
}
function ms(t, i, e, n) {
    const r = [
        { x: 0, y: 0, xStep: 8, yStep: 8 },
        { x: 4, y: 0, xStep: 8, yStep: 8 },
        { x: 0, y: 4, xStep: 4, yStep: 8 },
        { x: 2, y: 0, xStep: 4, yStep: 4 },
        { x: 0, y: 2, xStep: 2, yStep: 4 },
        { x: 1, y: 0, xStep: 2, yStep: 2 },
        { x: 0, y: 1, xStep: 1, yStep: 2 }
    ], { width: a, height: h, channels: o, depth: d } = t;
    let s;
    d === 16 ? s = o * d / 8 / 2 : s = o * d / 8;
    for (let l = 0; l < 7; l++) {
        const u = r[l], c = Math.floor((a - u.x + u.xStep - 1) / u.xStep), f = Math.floor((h - u.y + u.yStep - 1) / u.yStep);
        if (c <= 0 || f <= 0)
            continue;
        const p = c * s;
        for (let U = 0; U < f; U++) {
            const y = u.y + U * u.yStep, b = d <= 8 ? new Uint8Array(p) : new Uint16Array(p);
            let v = 0;
            for (let g = 0; g < c; g++) {
                const _ = u.x + g * u.xStep;
                if (_ < a && y < h) {
                    const k = (y * a + _) * s;
                    for (let O = 0; O < s; O++)
                        b[v++] = i[k + O];
                }
            }
            if (e.writeByte(0), d === 8)
                e.writeBytes(b);
            else if (d === 16)
                for (const g of b)
                    e.writeByte(g >> 8 & 255), e.writeByte(g & 255);
        }
    }
    return n;
}
function Ss(t, i, e, n) {
    for (let r = 0; r < e; r++)
        i.writeUint16(t[n++]);
    return n;
}
const Us = {
    /**
     * Unit is unknown.
     */
    UNKNOWN: 0,
    /**
     * Unit is the metre.
     */
    METRE: 1
};
function Ts(t) {
    const i = t.palette, e = t.depth;
    if (!i)
        throw new Error("Color palette is undefined.");
    Os(t);
    const n = t.width * t.height, r = n * i[0].length, a = new Uint8Array(r);
    let h = 0, o = 0;
    const d = new Uint8Array(n);
    let s = 255;
    switch (e) {
        case 1:
            s = 128;
            break;
        case 2:
            s = 192;
            break;
        case 4:
            s = 240;
            break;
        case 8:
            s = 255;
            break;
        default:
            throw new Error("Incorrect depth value");
    }
    for (const l of t.data) {
        let u = s, c = 8;
        for (; u && (c -= e, d[h++] = (l & u) >> c, u = u >> e, h % t.width !== 0); )
            ;
    }
    if (t.palette)
        for (const l of d) {
            const u = t.palette.at(l);
            if (!u)
                throw new Error("Incorrect index of palette color");
            a.set(u, o), o += u.length;
        }
    return a;
}
function Os(t) {
    const i = t.depth < 8 ? Math.ceil(t.width * t.depth / 8) * t.height * t.channels : t.width * t.height * t.channels;
    if (t.data.length !== i)
        throw new RangeError(`wrong data size. Found ${t.data.length}, expected ${i}`);
}
function Rs(t, i) {
    return new yn(t, i).decode();
}
function Ds(t, i) {
    return new Es(t, i).encode();
}
function Ns(t, i) {
    return new yn(t, i).decodeApng();
}
const Cs = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    ResolutionUnitSpecifier: Us,
    convertIndexedToRgb: Ts,
    decode: Rs,
    decodeApng: Ns,
    encode: Ds,
    hasPngSignature: _n
}, Symbol.toStringTag, { value: "Module" }));
if (typeof window !== "undefined") {
    window.fastPng = Cs;
};
export {
    Cs as default
};