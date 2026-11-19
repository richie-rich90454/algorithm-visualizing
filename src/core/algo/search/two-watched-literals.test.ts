/**
 * two-watched-literals.test.ts – Correctness and frame checks for Two-Watched-Literals.
 */

import { describe, expect, it } from "vitest";
import twoWatched from "./two-watched-literals";

type Clause = number[];

function framesOf(input: unknown) {
    return [...twoWatched.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = twoWatched.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(twoWatched.visualType);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function truth(lit: number, assign: Map<number, boolean>): boolean | undefined {
    const val = assign.get(Math.abs(lit));
    return val === undefined ? undefined : lit > 0 ? val : !val;
}

/** Straightforward rescan-based unit propagation used as the reference. */
function naivePropagate(clauses: Clause[]) {
    const assign = new Map<number, boolean>();
    let changed = true;
    let guard = 0;
    while (changed && guard < 10000) {
        changed = false;
        guard += 1;
        for (const clause of clauses) {
            if (clause.some((lit) => truth(lit, assign) === true)) continue;
            const open = clause.filter((lit) => truth(lit, assign) === undefined);
            if (open.length === 0) return { conflict: true, assign };
            if (open.length === 1) {
                const lit = open[0] as number;
                const v = Math.abs(lit);
                const value = lit > 0;
                const current = assign.get(v);
                if (current !== undefined && current !== value) return { conflict: true, assign };
                if (current === undefined) {
                    assign.set(v, value);
                    changed = true;
                }
            }
        }
    }
    return { conflict: false, assign };
}

function parseAssign(raw: unknown): Map<number, boolean> {
    const out = new Map<number, boolean>();
    if (!Array.isArray(raw)) return out;
    for (const entry of raw as string[]) {
        const [, varPart, valPart] = String(entry).match(/x(\d+)=([TF])/) ?? [];
        if (varPart && valPart) out.set(Number(varPart), valPart === "T");
    }
    return out;
}

function parseWatches(raw: unknown): Map<number, number[]> {
    const out = new Map<number, number[]>();
    if (!Array.isArray(raw)) return out;
    for (const entry of raw as string[]) {
        const [, num, lits] = String(entry).match(/c(\d+):(.*)/) ?? [];
        if (num !== undefined && lits !== undefined) {
            out.set(Number(num), lits.split(",").filter(Boolean).map(Number));
        }
    }
    return out;
}

const formulas: Clause[][] = [
    [[1], [-1, 2, 3], [-1, -2], [2, 3]],
    [[1], [-1, 2], [-2, 3], [2, -3]],
    [[1], [-1], [2]],
    [[1, 2], [-1, 2], [-2]],
    [[1, 2, 3], [-1, -2], [2, -3]],
];

describe("TwoWatchedLiterals", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(twoWatched.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("matches a naive unit-propagation reference on several formulas", () => {
        for (const clauses of formulas) {
            const frames = framesOf({ clauses, numVars: 3 });
            const meta = frames[frames.length - 1]?.meta ?? {};
            const expected = naivePropagate(clauses);
            const got = parseAssign(meta.assignment);
            expect(meta.conflict).toBe(expected.conflict);
            expect([...got.entries()].sort(([a], [b]) => a - b)).toEqual(
                [...expected.assign.entries()].sort(([a], [b]) => a - b),
            );
            checkFrameShape(frames);
        }
    });

    it("preserves the watched-literal invariant on every final non-satisfied clause", () => {
        const frames = framesOf(twoWatched.defaultInput);
        const meta = frames[frames.length - 1]?.meta ?? {};
        const assign = parseAssign(meta.assignment);
        const watches = parseWatches(meta.watches);
        const clauses = (twoWatched.defaultInput as { clauses: Clause[] }).clauses;
        clauses.forEach((clause, index) => {
            if (clause.some((lit) => truth(lit, assign) === true)) return; // satisfied clauses are exempt
            const watched = watches.get(index) ?? [];
            for (const lit of watched) {
                expect(truth(lit, assign)).not.toBe(false);
            }
        });
    });
});
