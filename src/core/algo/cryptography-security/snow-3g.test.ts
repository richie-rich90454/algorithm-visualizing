/** snow-3g.test.ts - Independent keystream reference, determinism and IV separation, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { snowInit, snowKeystream, type SnowState } from "./snow-3g";
import type { VisualFrame } from "@/types";

const MASK = 0xffff;
function refSbox(): number[] {
    const box = Array.from({ length: 256 }, (_, i) => i);
    let s = 987654321;
    for (let i = 255; i > 0; i -= 1) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const j = s % (i + 1);
        const t = box[i]!;
        box[i] = box[j]!;
        box[j] = t;
    }
    return box;
}
const REF_BOX = refSbox();
function refClock(st: SnowState): { st: SnowState; out: number } {
    const reg = st.lfsr.slice();
    const rot = ((reg[0]! << 1) | (reg[0]! >>> 15)) & MASK;
    const fb = (rot ^ reg[2]! ^ reg[5]! ^ reg[11]!) & MASK;
    const mix = REF_BOX[(reg[15]! + st.r1) & 255]! | (REF_BOX[(reg[15]! >>> 8) & 255]! << 8);
    const fsm = ((mix & MASK) + st.r2) & MASK;
    const out = (fsm ^ reg[0]!) & MASK;
    for (let i = 0; i < 15; i += 1) reg[i] = reg[i + 1]!;
    reg[15] = fb;
    return { st: { lfsr: reg, r1: fsm, r2: st.r1 }, out };
}
function refInit(key: number[], iv: number[]): SnowState {
    const w = (v: number | undefined) => ((Math.floor(v ?? 0) & MASK) + MASK) % MASK;
    const k = [0, 1, 2, 3].map((i) => w(key[i]));
    const v = [0, 1, 2, 3].map((i) => w(iv[i]));
    const reg = Array.from({ length: 16 }, (_, i) => {
        if (i < 4) return k[i]!;
        if (i < 8) return v[i - 4]!;
        return (k[(i - 8) % 4]! ^ ((i * 4660 + 17) & MASK)) & MASK;
    });
    let st: SnowState = { lfsr: reg, r1: 0, r2: 0 };
    for (let i = 0; i < 10; i += 1) st = refClock(st).st;
    return st;
}
function refStream(st: SnowState, n: number): number[] {
    let cur = st;
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const step = refClock(cur);
        cur = step.st;
        out.push(step.out);
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SNOW 3G teaching core", () => {
    it("matches an independently transcribed keystream reference", () => {
        for (let trial = 0; trial < 25; trial += 1) {
            const key = [trial, trial * 4096 + 17, (trial * 8193) & MASK, 3 + trial];
            const iv = [trial + 1, 1027, 2051, 7 + trial];
            expect(snowInit(key, iv)).toEqual(refInit(key, iv));
            const got = snowKeystream(snowInit(key, iv), 40).words;
            expect(got).toEqual(refStream(refInit(key, iv), 40));
            expect(got.every((word) => word >= 0 && word <= MASK)).toBe(true);
        }
    });

    it("is deterministic and separates different IVs", () => {
        const key = [17, 4096, 8193, 3];
        const first = snowKeystream(snowInit(key, [3, 1027, 2051, 7]), 20).words;
        const again = snowKeystream(snowInit(key, [3, 1027, 2051, 7]), 20).words;
        const other = snowKeystream(snowInit(key, [4, 1027, 2051, 7]), 20).words;
        expect(first).toEqual(again);
        expect(first).not.toEqual(other);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["done"]).toBe(true);
        expect((final["words"] as number[]).length).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});
