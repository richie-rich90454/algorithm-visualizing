/**
 * instrumental-variables.test.ts - Independent moment calculations, ratio
 * identity, endogeneity experiment, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./instrumental-variables";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

/** Reference cross products and slopes from first principles. */
function reference(x: number[], z: number[], y: number[]) {
    let sumZX = 0;
    let sumZY = 0;
    let sumZZ = 0;
    let sumXX = 0;
    let sumXY = 0;
    for (let i = 0; i < x.length; i += 1) {
        sumZX += z[i]! * x[i]!;
        sumZY += z[i]! * y[i]!;
        sumZZ += z[i]! ** 2;
        sumXX += x[i]! ** 2;
        sumXY += x[i]! * y[i]!;
    }
    return {
        sumZX, sumZY, sumZZ, sumXX, sumXY,
        betaIV: sumZY / sumZX,
        betaOLS: sumXY / sumXX,
        firstStage: sumZX / sumZZ,
        reducedForm: sumZY / sumZZ,
    };
}

function makeEndogenousData(n: number, seedInput: number) {
    let state = seedInput >>> 0;
    const uniform = (): number => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return (state / 4294967296) * 2 - 1;
    };
    const x: number[] = [];
    const z: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const zi = uniform();
        const u = uniform();
        const e = uniform();
        const xi = zi + u;
        z.push(zi);
        x.push(xi);
        y.push(2 * xi + u + e);
    }
    return { x, z, y };
}

describe("InstrumentalVariables", () => {
    it("matches an independent cross-product calculation on the default input", () => {
        const input = mod.defaultInput as { x: number[]; z: number[]; y: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.x.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = reference(input.x, input.z, input.y);
        for (const key of ["sumZX", "sumZY", "sumZZ", "sumXX", "sumXY", "betaIV", "betaOLS", "firstStage", "reducedForm"] as const) {
            expect(meta[key]).toBeCloseTo(expected[key], 9);
        }
    });

    it("satisfies the ratio identity between IV, first stage, and reduced form", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["betaIV"]).toBeCloseTo((meta["reducedForm"] as number) / (meta["firstStage"] as number), 9);
        expect(meta["identified"]).toBe(true);
    });

    it("recovers the causal slope where OLS is biased under endogeneity", () => {
        const data = makeEndogenousData(600, 424242);
        const frames = [...mod.run(data)];
        checkFrames(frames, data.x.length);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["betaIV"]).toBeCloseTo(2, 1);
        expect(Math.abs((meta["betaOLS"] as number) - 2)).toBeGreaterThan(0.2);
    });

    it("reports non-identification when the instrument is orthogonal to the regressor", () => {
        const frames = [...mod.run({ x: [1, -1, 1, -1], z: [1, 1, -1, -1], y: [2, 0, 3, 1] })];
        checkFrames(frames, 4);
        expect(frames[frames.length - 1]!.meta["identified"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
