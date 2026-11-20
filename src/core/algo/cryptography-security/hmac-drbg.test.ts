/**
 * hmac-drbg.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hmac-drbg";
import type { VisualFrame } from "@/types";

const BLOCK = 4;

function fnv1a(bytes: number[]): number {
    let h = 0x811c9dc5;
    for (const b of bytes) { h = Math.imul(h ^ (b & 0xff), 0x01000193) >>> 0; }
    return h >>> 0;
}
function toBytes(v: number): number[] {
    return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}
function hmac(key: number[], msg: number[]): number[] {
    const k = key.slice(0, BLOCK);
    while (k.length < BLOCK) { k.push(0); }
    const inner = fnv1a([...k.map((b) => b ^ 0x36), ...msg]);
    return toBytes(fnv1a([...k.map((b) => b ^ 0x5c), ...toBytes(inner)]));
}
/** Independent reference DRBG written straight from the construction. */
function reference(entropy: number[], nonce: number[], personal: number[], count: number): number[] {
    let v = new Array(BLOCK).fill(0x01);
    let c = new Array(BLOCK).fill(0x00);
    const update = (provided: number[]) => {
        let k = hmac(c, [...v, 0, ...provided]);
        v = hmac(k, v);
        c = hmac(k, [...v, 1]);
        v = hmac(k, v);
    };
    update([...entropy, ...nonce, ...personal]);
    const out: number[] = [];
    while (out.length < count) {
        let k = hmac(c, v);
        v = hmac(k, v);
        out.push(...v);
        k = hmac(c, [...v, 0]);
        v = hmac(k, v);
        c = hmac(k, [...v, 1]);
        v = hmac(k, v);
    }
    return out.slice(0, count);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(BLOCK);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("HMAC-DRBG toy model", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as { entropy: number[]; nonce: number[]; personalization: number[]; bytes: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const output = frames[frames.length - 1]?.meta["output"] as number[];
        const expected = reference(input.entropy, input.nonce, input.personalization, input.bytes);
        expect(output).toEqual(expected);
        expect(output.length).toBe(input.bytes);
    });

    it("is deterministic and changes when the seed changes", () => {
        const base = { entropy: [1, 2, 3, 4], nonce: [5, 6], personalization: [7], bytes: 12 };
        const a = [...mod.run(base)];
        const b = [...mod.run(base)];
        const c = [...mod.run({ ...base, entropy: [9, 2, 3, 4] })];
        expect(a[a.length - 1]?.meta["output"]).toEqual(b[b.length - 1]?.meta["output"]);
        expect(a[a.length - 1]?.meta["output"]).not.toEqual(c[c.length - 1]?.meta["output"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
