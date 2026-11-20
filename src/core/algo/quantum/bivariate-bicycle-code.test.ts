/**
 * bivariate-bicycle-code.test.ts - Brute-force commutation, independent GF(2)
 * ranks, frame shape, and termination for the small bivariate bicycle code.
 */

import { describe, expect, it } from "vitest";
import mod from "./bivariate-bicycle-code";
import type { VisualFrame } from "@/types";

const SIDE = 3;
const SITES = SIDE * SIDE;
const QUBITS = 2 * SITES;
const A: Array<[number, number]> = [[0, 0], [1, 0], [0, 1]];
const B: Array<[number, number]> = [[0, 0], [0, 1], [1, 1], [1, 2], [2, 0], [2, 2]];

/** Build checks as sets of qubit indices, an independent representation. */
function supports(terms: Array<[number, number]>): Set<number>[] {
    const result: Set<number>[] = [];
    for (let row = 0; row < SIDE; row += 1) {
        for (let col = 0; col < SIDE; col += 1) {
            const set = new Set<number>();
            for (const [dx, dy] of terms) {
                set.add(((dx + row) % SIDE) * SIDE + ((dy + col) % SIDE));
            }
            result.push(set);
        }
    }
    return result;
}

/** Rank over GF(2) using bitmask pivots, independent of the module's row elimination. */
function independentRank(rows: Set<number>[]): number {
    const pivots = new Map<number, number>();
    for (const set of rows) {
        let value = 0;
        for (const qubit of set) value |= 1 << qubit;
        while (value !== 0) {
            const leading = 31 - Math.clz32(value);
            const existing = pivots.get(leading);
            if (existing === undefined) {
                pivots.set(leading, value);
                break;
            }
            value ^= existing;
        }
    }
    return pivots.size;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(SITES * QUBITS);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            const row = Number(entity.metadata["row"]);
            const col = Number(entity.metadata["col"]);
            expect(row).toBeGreaterThanOrEqual(0);
            expect(row).toBeLessThan(SITES);
            expect(col).toBeGreaterThanOrEqual(0);
            expect(col).toBeLessThan(QUBITS);
        }
    });
}

describe("bivariate bicycle code", () => {
    it("all X and Z check pairs commute by brute force", () => {
        const xChecks = supports(A);
        const zChecks = supports(B);
        let pairs = 0;
        for (const xCheck of xChecks) {
            for (const zCheck of zChecks) {
                let overlap = 0;
                for (const qubit of xCheck) if (zCheck.has(qubit)) overlap += 1;
                expect(overlap % 2).toBe(0);
                pairs += 1;
            }
        }
        expect(pairs).toBe(SITES * SITES);
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]!.meta;
        expect(final["commute"]).toBe(true);
    });

    it("agrees with an independent GF(2) rank computation", () => {
        const xRank = independentRank(supports(A));
        const zRank = independentRank(supports(B));
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["rankX"])).toBe(xRank);
        expect(Number(final["rankZ"])).toBe(zRank);
        expect(Number(final["logicals"])).toBe(QUBITS - xRank - zRank);
        expect(xRank).toBe(7);
        expect(zRank).toBe(2);
    });

    it("returns consistent check matrices in metadata", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const hx = final["hxFlat"] as number[];
        const hz = final["hzFlat"] as number[];
        expect(hx.length).toBe(SITES * QUBITS);
        expect(hz.length).toBe(SITES * QUBITS);
        expect(hx.filter((bit) => bit === 1).length).toBe(SITES * A.length);
        expect(hz.filter((bit) => bit === 1).length).toBe(SITES * B.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
