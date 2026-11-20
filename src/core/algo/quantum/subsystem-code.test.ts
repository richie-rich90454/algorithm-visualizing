/** subsystem-code.test.ts - Gauge/stabilizer algebra, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./subsystem-code";
import type { VisualFrame } from "@/types";

interface Spec { x: number[]; z: number[]; label?: string }

function checkFrames(frames: VisualFrame[], nGens: number): void {
    expect(frames.length).toBe(nGens + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function toBits(spec: Spec, n: number): number {
    let bits = 0;
    for (let i = 0; i < n; i += 1) {
        if (spec.x[i]) bits |= 1 << i;
        if (spec.z[i]) bits |= 1 << (n + i);
    }
    return bits;
}
function parity(v: number): number {
    let c = 0;
    while (v > 0) { c ^= v & 1; v >>>= 1; }
    return c;
}
function commutes(a: number, b: number, n: number): boolean {
    const m = (1 << n) - 1;
    return ((parity(a & ((b >> n) & m)) ^ parity(((a >> n) & m) & (b & m))) === 0);
}
function group(gens: number[]): number[] {
    const set = new Set<number>([0]);
    for (const g of gens) {
        const next = new Set<number>(set);
        for (const e of set) next.add(e ^ g);
        for (const e of next) set.add(e);
    }
    return [...set];
}

describe("Subsystem code structure", () => {
    it("matches brute-force group algebra on the default gauge group", () => {
        const input = mod.defaultInput as { n: number; generators: Spec[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.generators.length);
        const final = frames[frames.length - 1]!.meta;
        const gens = input.generators.map((s) => toBits(s, input.n));
        const G = group(gens);
        const S = G.filter((e) => gens.every((g) => commutes(e, g, input.n)));
        let centralizer = 0;
        for (let v = 0; v < (1 << (2 * input.n)); v += 1) {
            if (S.every((s) => commutes(v, s, input.n))) centralizer += 1;
        }
        expect(G.length).toBe(8);
        expect(Number(final["centerSize"])).toBe(S.length);
        expect(Number(final["centralizerSize"])).toBe(centralizer);
        expect(Number(final["gaugeRank"])).toBe(3);
        expect(Number(final["stabilizerRank"])).toBe(1);
        expect(Number(final["gaugeQubits"])).toBe(1);
        expect(Number(final["logicalQubits"])).toBe(2);
        expect(final["consistent"]).toBe(true);
    });

    it("handles an abelian stabilizer code and a single generator", () => {
        const cases: Array<{ input: { n: number; generators: Spec[] }; g: number; s: number; k: number }> = [
            { input: { n: 2, generators: [{ x: [1, 0], z: [0, 0], label: "X1" }] }, g: 1, s: 1, k: 1 },
            { input: { n: 3, generators: [{ x: [1, 1, 0], z: [0, 0, 0] }, { x: [0, 1, 1], z: [0, 0, 0] }] }, g: 2, s: 2, k: 1 },
        ];
        for (const { input, g, s, k } of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.generators.length);
            const final = frames[frames.length - 1]!.meta;
            expect(Number(final["gaugeRank"])).toBe(g);
            expect(Number(final["stabilizerRank"])).toBe(s);
            expect(Number(final["logicalQubits"])).toBe(k);
            expect(final["consistent"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
