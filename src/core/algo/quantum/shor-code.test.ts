/**
 * shor-code.test.ts - Syndrome/correction cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./shor-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(13);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference syndrome for a single error. */
function expectedSyndrome(q: number, type: "X" | "Z") {
    const block = Math.floor(q / 3);
    const pos = q % 3;
    if (type === "X") {
        const s1 = pos === 0 || pos === 1 ? 1 : 0;
        const s2 = pos === 1 || pos === 2 ? 1 : 0;
        return { bitChecks: [0, 0, 0, 0, 0, 0].map((v, i) => (i === 2 * block ? s1 : i === 2 * block + 1 ? s2 : v)), phaseChecks: [0, 0] };
    }
    const t1 = block === 0 || block === 1 ? 1 : 0;
    const t2 = block === 1 || block === 2 ? 1 : 0;
    return { bitChecks: [0, 0, 0, 0, 0, 0], phaseChecks: [t1, t2] };
}

describe("Shor code", () => {
    it("corrects every single X and Z error on all nine qubits", () => {
        for (const type of ["X", "Z"] as const) {
            for (let q = 0; q < 9; q += 1) {
                const frames = [...mod.run({ logical: 1, errorQubit: q, errorType: type })];
                checkFrames(frames);
                const syndrome = frames[2]?.meta;
                const expected = expectedSyndrome(q, type);
                expect(syndrome?.["bitChecks"]).toEqual(expected.bitChecks);
                expect(syndrome?.["phaseChecks"]).toEqual(expected.phaseChecks);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["corrected"]).toBe(true);
                const correction = Number(final?.["correctionQubit"]);
                if (type === "X") {
                    expect(correction).toBe(q);
                } else {
                    expect(Math.floor(correction / 3)).toBe(Math.floor(q / 3));
                }
            }
        }
    });

    it("shows distinct syndromes for every error location", () => {
        const bitSyndromes = new Set<string>();
        for (let q = 0; q < 9; q += 1) {
            const frames = [...mod.run({ errorQubit: q, errorType: "X" })];
            bitSyndromes.add((frames[2]?.meta["bitChecks"] as number[]).join(""));
        }
        expect(bitSyndromes.size).toBe(9); // one nonzero block-pair per physical qubit

        const phaseSyndromes = new Set<string>();
        for (let q = 0; q < 9; q += 1) {
            const frames = [...mod.run({ errorQubit: q, errorType: "Z" })];
            phaseSyndromes.add((frames[2]?.meta["phaseChecks"] as number[]).join(""));
        }
        expect(phaseSyndromes.size).toBe(3); // three blocks
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
