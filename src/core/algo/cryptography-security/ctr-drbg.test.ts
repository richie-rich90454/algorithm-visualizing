/**
 * ctr-drbg.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { createCtrDrbg, toyBlock, toyCtr } from "./ctr-drbg";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(2);
    });
}

/** Independent replay of the toy DRBG state machine. */
function reference(seed: number, count: number, reseed: number) {
    let key = 0;
    let v = 1;
    const update = (data: number[]): void => {
        let temp = toyCtr(key, v, 2);
        key = temp[0]!;
        v = temp[1]!;
        if (data.length > 0) {
            const stream = toyCtr(key, v, Math.max(2, data.length));
            const mixed = stream.map((byte, i) => byte ^ (data[i] ?? 0));
            key = mixed[0]!;
            v = mixed[1]!;
        }
    };
    update([seed & 0xff]);
    const setupKey = key, setupV = v;
    const first = toyCtr(key, v, count);
    update([]);
    const second = toyCtr(key, v, count);
    update([]);
    update([reseed & 0xff]);
    const third = toyCtr(key, v, count);
    update([]);
    return { setupKey, setupV, first, second, third, finalKey: key, finalV: v };
}

describe("CTR_DRBG Random Generator (Toy)", () => {
    it("matches an independent replay of the state machine", () => {
        const input = mod.defaultInput as { seed: number; count: number; reseed: number };
        const expected = reference(input.seed, input.count, input.reseed);
        const drbg = createCtrDrbg(input.seed);
        expect([drbg.key, drbg.v]).toEqual([expected.setupKey, expected.setupV]);
        expect(drbg.generate(input.count)).toEqual(expected.first);
        expect(drbg.generate(input.count)).toEqual(expected.second);
        drbg.reseed(input.reseed);
        expect(drbg.generate(input.count)).toEqual(expected.third);
        expect([drbg.key, drbg.v]).toEqual([expected.finalKey, expected.finalV]);
    });

    it("produces in-range bytes, advances state, and reacts to reseeding", () => {
        const a = createCtrDrbg(90);
        const first = a.generate(8);
        const second = a.generate(8);
        expect(first.length).toBe(8);
        expect(second.length).toBe(8);
        expect(first.every((b) => b >= 0 && b <= 255)).toBe(true);
        expect(first).not.toEqual(second);

        const b = createCtrDrbg(90);
        expect(b.generate(8)).toEqual(first);
        const c = createCtrDrbg(91);
        expect(c.generate(8)).not.toEqual(first);

        b.reseed(60);
        expect(b.generate(8)).not.toEqual(second);
    });

    it("emits well-formed frames consistent with a fresh run", () => {
        const input = mod.defaultInput as { seed: number; count: number; reseed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, 9);
        const expected = reference(input.seed, input.count, input.reseed);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["setupKey"]).toBe(expected.setupKey);
        expect(meta["setupV"]).toBe(expected.setupV);
        expect(meta["first"]).toEqual(expected.first);
        expect(meta["second"]).toEqual(expected.second);
        expect(meta["postReseedOutput"]).toEqual(expected.third);
        expect(meta["finalKey"]).toBe(expected.finalKey);
        expect(meta["finalV"]).toBe(expected.finalV);
    });

    it("has a deterministic toy block cipher and terminates cleanly", () => {
        for (let key = 0; key < 256; key += 37) {
            for (let input = 0; input < 256; input += 29) {
                const out = toyBlock(key, input);
                expect(out).toBeGreaterThanOrEqual(0);
                expect(out).toBeLessThanOrEqual(255);
                expect(toyBlock(key, input)).toBe(out);
            }
        }
        expect(toyCtr(5, 250, 10).length).toBe(10);

        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
