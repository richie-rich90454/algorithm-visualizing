/**
 * quantum-state-tomography.test.ts - Density-matrix reconstruction cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-state-tomography";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function toPairs(flat: number[]): Array<[number, number]> {
    return Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i] ?? 0, flat[2 * i + 1] ?? 0]);
}

describe("QuantumStateTomography", () => {
    it("reconstructs rho and recovers each Bloch component via Pauli traces", () => {
        const vectors = [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [0.3, -0.4, 0.5],
            [0.6, 0, 0.8],
            [2, 0, 0],
        ];
        for (const vector of vectors) {
            const frames = [...mod.run({ rx: vector[0], ry: vector[1], rz: vector[2] })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const rx = meta?.["rx"] as number;
            const ry = meta?.["ry"] as number;
            const rz = meta?.["rz"] as number;
            const rho = toPairs(meta?.["density"] as number[]);
            expect(rho.length).toBe(4);

            // Independent Pauli traces: Tr(rho X) = rx, Tr(rho Y) = ry, Tr(rho Z) = rz.
            const traceX = rho[1]![0] + rho[2]![0];
            const traceY = -(rho[1]![1] - rho[2]![1]);
            const traceZ = rho[0]![0] - rho[3]![0];
            expect(traceX).toBeCloseTo(rx, 12);
            expect(traceY).toBeCloseTo(ry, 12);
            expect(traceZ).toBeCloseTo(rz, 12);

            expect(rho[0]![0]).toBeCloseTo((1 + rz) / 2, 12);
            expect(rho[0]![1]).toBeCloseTo(0, 12);
            expect(rho[1]![0]).toBeCloseTo(rx / 2, 12);
            expect(rho[1]![1]).toBeCloseTo(-ry / 2, 12);
            expect(rho[2]![0]).toBeCloseTo(rx / 2, 12);
            expect(rho[2]![1]).toBeCloseTo(ry / 2, 12);
            expect(rho[3]![0]).toBeCloseTo((1 - rz) / 2, 12);
            expect(meta?.["trace"]).toBeCloseTo(1, 12);
            expect(meta?.["physical"]).toBe(true);
        }
    });

    it("clamps an out-of-range Bloch vector onto the unit ball", () => {
        const frames = [...mod.run({ rx: 3, ry: 4, rz: 0 })];
        const meta = frames[frames.length - 1]?.meta;
        const radius = Math.hypot(meta?.["rx"] as number, meta?.["ry"] as number, meta?.["rz"] as number);
        expect(radius).toBeCloseTo(1, 12);
        expect(meta?.["minEigenvalue"]).toBeGreaterThanOrEqual(-1e-12);
    });

    it("reports purity of a maximally mixed state as one half", () => {
        const frames = [...mod.run({ rx: 0, ry: 0, rz: 0 })];
        expect(frames[frames.length - 1]?.meta["purity"]).toBeCloseTo(0.5, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
