/**
 * conditional-entropy.test.ts - Independent count-based entropy reference,
 * the chain-rule identity, deterministic dependence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./conditional-entropy";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], groups: number): void {
    expect(frames.length).toBe(groups + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(groups);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function entropyOf(counts: number[], total: number): number {
    if (total <= 0) return 0;
    let sum = 0;
    for (const count of counts) {
        if (count <= 0) continue;
        const p = count / total;
        sum -= p * Math.log2(p);
    }
    return sum;
}

function reference(xs: Array<number | string>, ys: Array<number | string>) {
    const n = Math.min(xs.length, ys.length);
    const joint = new Map<string, number>();
    const mx = new Map<string, number>();
    const my = new Map<string, number>();
    for (let i = 0; i < n; i += 1) {
        const x = String(xs[i]);
        const y = String(ys[i]);
        joint.set(`${x}|${y}`, (joint.get(`${x}|${y}`) ?? 0) + 1);
        mx.set(x, (mx.get(x) ?? 0) + 1);
        my.set(y, (my.get(y) ?? 0) + 1);
    }
    return {
        hxy: entropyOf([...joint.values()], n),
        hx: entropyOf([...mx.values()], n),
        hy: entropyOf([...my.values()], n),
        groups: mx.size,
    };
}

describe("ConditionalEntropy", () => {
    it("matches an independent count-based entropy calculation", () => {
        const input = mod.defaultInput as { xs: Array<number | string>; ys: Array<number | string> };
        const frames = [...mod.run(input)];
        const expected = reference(input.xs, input.ys);
        checkFrames(frames, expected.groups);
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["hxy"])).toBeCloseTo(expected.hxy, 12);
        expect(Number(meta["hx"])).toBeCloseTo(expected.hx, 12);
        expect(Number(meta["hy"])).toBeCloseTo(expected.hy, 12);
        expect(Number(meta["conditionalEntropy"])).toBeCloseTo(expected.hxy - expected.hx, 12);
        expect(Number(meta["mutualInformation"])).toBeCloseTo(expected.hx + expected.hy - expected.hxy, 12);
    });

    it("obeys the chain rule across several data sets", () => {
        const cases: Array<{ xs: Array<number | string>; ys: Array<number | string> }> = [
            { xs: [1, 1, 2, 2, 3, 3, 4, 4], ys: [1, 2, 1, 2, 1, 2, 1, 2] },
            { xs: ["a", "b", "c", "a", "b", "c"], ys: ["x", "x", "x", "y", "y", "y"] },
            { xs: [0, 0, 0, 1, 1, 1], ys: [0, 0, 1, 0, 1, 1] },
        ];
        for (const input of cases) {
            const expected = reference(input.xs, input.ys);
            const meta = [...mod.run(input)].at(-1)!.meta;
            expect(Number(meta["conditionalEntropy"])).toBeCloseTo(expected.hxy - expected.hx, 12);
            expect(Number(meta["conditionalEntropy"])).toBeGreaterThanOrEqual(-1e-12);
            expect(Number(meta["mutualInformation"])).toBeGreaterThanOrEqual(-1e-12);
        }
    });

    it("gives zero conditional entropy when Y is a function of X", () => {
        const xs = [1, 1, 2, 2, 3, 3];
        const ys = [7, 7, 8, 8, 9, 9];
        const meta = [...mod.run({ xs, ys })].at(-1)!.meta;
        expect(Number(meta["conditionalEntropy"])).toBeCloseTo(0, 12);
        expect(Number(meta["mutualInformation"])).toBeCloseTo(Number(meta["hx"]), 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
