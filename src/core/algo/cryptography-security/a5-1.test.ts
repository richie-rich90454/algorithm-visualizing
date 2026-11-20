/**
 * a5-1.test.ts - Independent integer-based A5/1 reference, determinism and
 * key-sensitivity properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { keystream } from "./a5-1";
import type { VisualFrame } from "@/types";

/** Reference implementation using integer bitmasks instead of bit arrays. */
function reference(keyBits: number[], frameBits: number[], count = 228): number[] {
    const advance = (register: number, taps: number[], width: number): number => {
        let feedback = 0;
        for (const tap of taps) {
            feedback ^= (register >> tap) & 1;
        }
        return (register >>> 1) | (feedback << (width - 1));
    };
    let r1 = 0;
    let r2 = 0;
    let r3 = 0;
    const load = (bit: number) => {
        r1 = advance(r1 ^ (bit << 18), [13, 16, 17, 18], 19);
        r2 = advance(r2 ^ (bit << 21), [20, 21], 22);
        r3 = advance(r3 ^ (bit << 22), [7, 20, 21, 22], 23);
    };
    for (const bit of [...keyBits, ...frameBits]) {
        load(bit);
    }
    const tick = () => {
        const c1 = (r1 >> 8) & 1;
        const c2 = (r2 >> 10) & 1;
        const c3 = (r3 >> 10) & 1;
        const majority = (c1 & c2) | (c2 & c3) | (c1 & c3);
        if (c1 === majority) {
            r1 = advance(r1, [13, 16, 17, 18], 19);
        }
        if (c2 === majority) {
            r2 = advance(r2, [20, 21], 22);
        }
        if (c3 === majority) {
            r3 = advance(r3, [7, 20, 21, 22], 23);
        }
    };
    for (let i = 0; i < 100; i += 1) {
        tick();
    }
    const output: number[] = [];
    for (let i = 0; i < count; i += 1) {
        tick();
        output.push((r1 ^ r2 ^ r3) & 1);
    }
    return output;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["historical"]).toBe(true);
    });
}

describe("A5/1 Stream Cipher", () => {
    it("matches an independent integer-based reference", () => {
        const key = Array.from({ length: 64 }, (_, index) => (index % 7 < 3 ? 1 : 0));
        const frame = Array.from({ length: 22 }, (_, index) => (index % 3 === 0 ? 1 : 0));
        expect(keystream(key, frame)).toEqual(reference(key, frame));
    });

    it("reports the same bytes through its frame generator", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["bitsGenerated"]).toBe(228);
        const bytes = final?.["bytes"] as number[];
        expect(bytes.length).toBe(29);
        expect(bytes.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
    });

    it("is deterministic and changes when one key bit changes", () => {
        const key = Array.from({ length: 64 }, (_, index) => (index % 5 < 2 ? 1 : 0));
        const frame = Array.from({ length: 22 }, (_, index) => (index % 3 === 0 ? 1 : 0));
        const first = keystream(key, frame);
        expect(keystream(key, frame)).toEqual(first);
        const changed = key.slice();
        changed[63] = changed[63] === 1 ? 0 : 1;
        const second = keystream(changed, frame);
        expect(second).not.toEqual(first);
        expect(second.length).toBe(228);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(4);
        expect(generator.next().done).toBe(true);
    });
});
