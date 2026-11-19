/** cache-2q.test.ts - Independent 2Q replay on random traces, capacity checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cache-2q";
import type { VisualFrame } from "@/types";

interface TwoQInput { accesses: number[]; kin: number; km: number; }

function reference(accesses: number[], kin: number, km: number) {
    let a1in: number[] = [];
    let a1out: number[] = [];
    let am: number[] = [];
    const verdicts: number[] = [];
    for (const item of accesses) {
        const mi = am.indexOf(item);
        if (mi >= 0) { am.splice(mi, 1); am.unshift(item); verdicts.push(1); continue; }
        const ii = a1in.indexOf(item);
        if (ii >= 0) {
            a1in.splice(ii, 1); am.unshift(item);
            if (am.length > km) am.pop();
            verdicts.push(1); continue;
        }
        const oi = a1out.indexOf(item);
        if (oi >= 0) {
            a1out.splice(oi, 1); am.unshift(item);
            if (am.length > km) am.pop();
            verdicts.push(1); continue;
        }
        a1in.unshift(item);
        if (a1in.length > kin) {
            const evicted = a1in.pop();
            if (evicted !== undefined) {
                a1out.unshift(evicted);
                if (a1out.length > kin) a1out.pop();
            }
        }
        verdicts.push(0);
    }
    return { verdicts, am, a1in, a1out };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("2Q Cache Replacement", () => {
    it("matches an independent 2Q replay on the default input", () => {
        const input = mod.defaultInput as TwoQInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.accesses, input.kin, input.km);
        expect(final?.["verdicts"]).toEqual(expected.verdicts);
        expect(final?.["am"]).toEqual(expected.am);
        expect(final?.["a1in"]).toEqual(expected.a1in);
        expect(final?.["a1out"]).toEqual(expected.a1out);
    });

    it("matches an independent replay on many random traces", () => {
        let state = 12345;
        const next = () => { state = (Math.imul(1103515245, state) + 12345) >>> 1; return state; };
        for (let trial = 0; trial < 40; trial += 1) {
            const kin = 1 + (next() % 3);
            const km = 1 + (next() % 3);
            const accesses = Array.from({ length: 30 }, () => next() % 8);
            const frames = [...mod.run({ accesses, kin, km })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["verdicts"]).toEqual(reference(accesses, kin, km).verdicts);
            expect((final?.["am"] as number[]).length).toBeLessThanOrEqual(km);
            expect((final?.["a1in"] as number[]).length).toBeLessThanOrEqual(kin);
            expect((final?.["a1out"] as number[]).length).toBeLessThanOrEqual(kin);
        }
    });

    it("a first access is a miss and a quick repeat is a hit", () => {
        const frames = [...mod.run({ accesses: [5, 5], kin: 2, km: 2 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["verdicts"]).toEqual([0, 1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
