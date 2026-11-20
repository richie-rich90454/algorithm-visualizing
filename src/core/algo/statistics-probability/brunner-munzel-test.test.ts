/** brunner-munzel-test.test.ts - independent formula cross-check + SciPy oracle, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./brunner-munzel-test";
import type { VisualFrame } from "@/types";

function ranks(values: number[]): number[] {
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = new Array<number>(values.length).fill(0);
    let i = 0;
    while (i < order.length) {
        let j = i;
        while (j < order.length && (order[j] as { v: number }).v === (order[i] as { v: number }).v) j += 1;
        const avg = (i + 1 + j) / 2;
        for (let k = i; k < j; k += 1) out[(order[k] as { i: number }).i] = avg;
        i = j;
    }
    return out;
}

const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

/** Independent implementation of the Brunner-Munzel W and Welch degrees of freedom. */
function referenceBM(x: number[], y: number[]): { w: number; df: number } {
    const nx = x.length;
    const ny = y.length;
    const pooled = ranks([...x, ...y]);
    const cx = pooled.slice(0, nx);
    const cy = pooled.slice(nx);
    const ix = ranks(x);
    const iy = ranks(y);
    const mx = mean(ix);
    const my = mean(iy);
    const cmx = mean(cx);
    const cmy = mean(cy);
    const sx = cx.reduce((s, v, i) => s + (v - (ix[i] as number) - cmx + mx) ** 2, 0) / (nx - 1);
    const sy = cy.reduce((s, v, i) => s + (v - (iy[i] as number) - cmy + my) ** 2, 0) / (ny - 1);
    const nxSx = nx * sx;
    const nySy = ny * sy;
    const w = (nx * ny * (cmy - cmx)) / ((nx + ny) * Math.sqrt(nxSx + nySy));
    const df = (nxSx + nySy) ** 2 / (nxSx ** 2 / (nx - 1) + nySy ** 2 / (ny - 1));
    return { w, df };
}

function checkFrames(frames: VisualFrame[], N: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * N);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Brunner-Munzel Test", () => {
    it("matches an independent formula implementation on several samples", () => {
        const cases: Array<{ x: number[]; y: number[] }> = [
            { x: [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 1, 1], y: [3, 3, 4, 3, 1, 2, 3, 1, 1, 5, 4] },
            { x: [1, 2, 3, 4, 5], y: [6, 7, 8, 9, 10] },
            { x: [5, 5, 5, 5], y: [1, 2, 3, 9] },
            { x: [2, 4, 6, 8], y: [3, 5, 7, 9, 11, 13] },
        ];
        for (const { x, y } of cases) {
            const frames = [...mod.run({ x, y })];
            checkFrames(frames, x.length + y.length);
            const ref = referenceBM(x, y);
            const final = frames.at(-1)?.meta;
            if (Number.isFinite(ref.w)) {
                expect(Number(final?.["w"])).toBeCloseTo(ref.w, 9);
                expect(Number(final?.["df"])).toBeCloseTo(ref.df, 8);
            } else {
                expect(Number(final?.["w"])).toBe(0);
            }
        }
    });

    it("reproduces the documented SciPy W statistic for the example pair", () => {
        const x = [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 1, 1];
        const y = [3, 3, 4, 3, 1, 2, 3, 1, 1, 5, 4];
        const w = Number([...mod.run({ x, y })].at(-1)?.meta["w"]);
        expect(w).toBeCloseTo(3.1374674823029505, 9);
    });

    it("gives W near zero for identical samples and a two-sided p in range", () => {
        const final = [...mod.run({ x: [1, 2, 3, 4, 5], y: [1, 2, 3, 4, 5] })].at(-1)?.meta;
        expect(Number(final?.["w"])).toBeCloseTo(0, 9);
        expect(Number(final?.["pValue"])).toBeGreaterThanOrEqual(0);
        expect(Number(final?.["pValue"])).toBeLessThanOrEqual(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
