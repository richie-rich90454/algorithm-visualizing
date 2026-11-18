/**
 * color-code.test.ts - Independent syndrome/lookup reference, distance-3 property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./color-code";
import type { VisualFrame } from "@/types";

const PLAQUETTES = [[0, 2, 4, 6], [1, 2, 5, 6], [3, 4, 5, 6]];

/** Independent syndrome computation on the plaquette incidence. */
function refSyndrome(qubit: number): number {
    if (qubit < 0) return 0;
    let mask = 0;
    for (let p = 0; p < 3; p += 1) {
        if (PLAQUETTES[p]!.includes(qubit)) mask |= 1 << p;
    }
    return mask;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(7);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["qubits"]).toBe(7);
    });
}

describe("ColorCode", () => {
    it("corrects every single-qubit X and Z error", () => {
        for (const type of ["X", "Z"] as const) {
            for (let q = 0; q < 7; q += 1) {
                const frames = [...mod.run({ error: q, type })];
                checkFrames(frames);
                expect(frames[2]!.meta["syndrome"]).toBe(refSyndrome(q));
                expect(frames[3]!.meta["identified"]).toBe(q);
                const final = frames[frames.length - 1]!.meta;
                expect(final["syndrome"]).toBe(0);
                expect(final["clean"]).toBe(true);
                expect(final["corrected"]).toBe(true);
            }
        }
    });

    it("maps the seven qubits to seven distinct nonzero syndromes", () => {
        const masks = Array.from({ length: 7 }, (_, q) => refSyndrome(q));
        expect(new Set(masks).size).toBe(7);
        expect(masks.every((m) => m >= 1 && m <= 7)).toBe(true);
    });

    it("each stabilizer overlaps an even number of qubits (CSS commutativity)", () => {
        for (const plaquette of PLAQUETTES) {
            for (const other of PLAQUETTES) {
                const overlap = plaquette.filter((q) => other.includes(q)).length;
                expect(overlap % 2).toBe(0);
            }
        }
    });

    it("treats no error as a zero syndrome needing no correction", () => {
        const frames = [...mod.run({ error: -1, type: "X" })];
        checkFrames(frames);
        expect(frames[2]!.meta["syndrome"]).toBe(0);
        expect(frames[4]!.meta["identified"]).toBe(-1);
        expect(frames[4]!.meta["clean"]).toBe(true);
    });

    it("falls back on invalid input and terminates cleanly", () => {
        const generator = mod.run({ error: 99, type: "bad" });
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
