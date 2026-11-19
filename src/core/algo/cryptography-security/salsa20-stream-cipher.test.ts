/** salsa20-stream-cipher.test.ts - Known vector, independent reference, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./salsa20-stream-cipher";
import type { VisualFrame } from "@/types";

interface Input {
    key: number[];
    nonce: number[];
    counter: number;
    blocks: number;
}

const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;

/** Independent flat-array Salsa20 block function used only by the test. */
function referenceBlock(key: number[], nonce: number[], counter: number): number[] {
    let value = 0;
    const kw: number[] = [];
    for (let i = 0; i < 8; i += 1) {
        value = 0;
        for (let j = 0; j < 4; j += 1) value += (key[i * 4 + j] ?? 0) << (8 * j);
        kw.push(value >>> 0);
    }
    const nw: number[] = [];
    for (let i = 0; i < 2; i += 1) {
        value = 0;
        for (let j = 0; j < 4; j += 1) value += (nonce[i * 4 + j] ?? 0) << (8 * j);
        nw.push(value >>> 0);
    }
    const s = [
        0x61707865, kw[0], kw[1], kw[2], kw[3], 0x3320646e, nw[0], nw[1],
        counter >>> 0, Math.floor(counter / 4294967296) >>> 0, 0x79622d32, kw[4],
        kw[5], kw[6], kw[7], 0x6b206574,
    ] as number[];
    const qr = (a: number, b: number, c: number, d: number): void => {
        const A = s[a], B = s[b], C = s[c], D = s[d];
        const z1 = B ^ rotl((A + D) >>> 0, 7);
        const z2 = C ^ rotl((z1 + A) >>> 0, 9);
        const z3 = D ^ rotl((z2 + z1) >>> 0, 13);
        s[a] = A ^ rotl((z3 + z2) >>> 0, 18);
        s[b] = z1;
        s[c] = z2;
        s[d] = z3;
    };
    const original = s.slice();
    for (let r = 0; r < 10; r += 1) {
        qr(0, 4, 8, 12); qr(5, 9, 13, 1); qr(10, 14, 2, 6); qr(15, 3, 7, 11);
        qr(0, 1, 2, 3); qr(5, 6, 7, 4); qr(10, 11, 8, 9); qr(15, 12, 13, 14);
    }
    const bytes: number[] = [];
    for (let i = 0; i < 16; i += 1) {
        const word = (s[i] + original[i]) >>> 0;
        for (let j = 0; j < 4; j += 1) bytes.push((word >>> (8 * j)) & 0xff);
    }
    return bytes;
}

function keystream(input: Input, block: number): string {
    const frames = [...mod.run(input)];
    const outputFrames = frames.filter((frame) => typeof frame.meta["keystream"] === "string");
    return String(outputFrames[block]?.meta["keystream"]);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Salsa20 Stream Cipher", () => {
    const input: Input = {
        key: Array.from({ length: 32 }, (_, i) => i),
        nonce: Array.from({ length: 8 }, (_, i) => i),
        counter: 0,
        blocks: 2,
    };

    it("matches the reference Salsa20 keystream for a sequential key and nonce", () => {
        expect(keystream(input, 0)).toBe(
            "2ead0f5f185729ced672b3a928e454f72fdb44a87b9cd8d219e4ec14aef9c6bc" +
                "77bf057f5659d7753848f8d3fe769ca5fdd8057d46326990e5f136e2fcb7bb7c",
        );
    });

    it("agrees with an independent block reference", () => {
        for (let block = 0; block < input.blocks; block += 1) {
            const expected = referenceBlock(input.key, input.nonce, input.counter + block)
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("");
            expect(keystream(input, block)).toBe(expected);
        }
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames.length).toBe(1 + input.blocks * 11 + 1);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
