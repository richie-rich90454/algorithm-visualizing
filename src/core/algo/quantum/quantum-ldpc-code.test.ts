/**
 * quantum-ldpc-code.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-ldpc-code";
import type { VisualFrame } from "@/types";

const H = [
    [1, 0, 1, 0, 1, 0, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 1, 1],
];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(H.length * H[0]!.length);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

/** Brute-force syndrome: parity of H row dotted with error vector. */
function syndrome(error: number[]): number[] {
    return H.map((row) => row.reduce((sum, bit, q) => sum + bit * (error[q] ?? 0), 0) % 2);
}

describe("Quantum LDPC code", () => {
    it("corrects every single-qubit X, Z, and Y error", () => {
        for (let qubit = 0; qubit < 7; qubit += 1) {
            for (const type of ["X", "Z", "Y"]) {
                const frames = [...mod.run({ errorQubit: qubit, errorType: type })];
                checkFrames(frames);
                const metaFrame = finalMeta(frames);
                const xError = metaFrame["xError"] as number[];
                const zError = metaFrame["zError"] as number[];
                expect(syndrome(xError)).toEqual(metaFrame["sx"]);
                expect(syndrome(zError)).toEqual(metaFrame["sz"]);
                if (type === "X" || type === "Y") {
                    expect(metaFrame["decodedX"]).toBe(qubit);
                } else {
                    expect(metaFrame["decodedX"]).toBe(-1);
                }
                if (type === "Z" || type === "Y") {
                    expect(metaFrame["decodedZ"]).toBe(qubit);
                } else {
                    expect(metaFrame["decodedZ"]).toBe(-1);
                }
                expect(metaFrame["success"]).toBe(true);
                expect(metaFrame["residualX"]).toEqual([0, 0, 0]);
                expect(metaFrame["residualZ"]).toEqual([0, 0, 0]);
            }
        }
    });

    it("reports no error when no error vector is supplied", () => {
        const frames = [...mod.run({ errorQubit: -1 })];
        checkFrames(frames);
        const metaFrame = finalMeta(frames);
        expect(metaFrame["sx"]).toEqual([0, 0, 0]);
        expect(metaFrame["sz"]).toEqual([0, 0, 0]);
        expect(metaFrame["decodedX"]).toBe(-1);
        expect(metaFrame["decodedZ"]).toBe(-1);
        expect(metaFrame["success"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
