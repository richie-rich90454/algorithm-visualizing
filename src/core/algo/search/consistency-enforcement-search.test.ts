/**
 * consistency-enforcement-search.test.ts – Correctness and frame checks for Consistency Enforcement Search.
 */

import { describe, expect, it } from "vitest";
import ces from "./consistency-enforcement-search";

type Domains = Record<string, number[]>;

function framesOf(input: unknown) {
    return [...ces.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = ces.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(ces.visualType);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function bruteSatisfiable(domains: Domains, constraints: Array<[string, string]>): boolean {
    const vars = Object.keys(domains);
    const rec = (i: number, assign: Record<string, number>): boolean => {
        if (i === vars.length) {
            return constraints.every(([a, b]) => assign[a] !== undefined && assign[b] !== undefined && assign[a] !== assign[b]);
        }
        const v = vars[i] as string;
        for (const value of domains[v] ?? []) {
            if (rec(i + 1, { ...assign, [v]: value })) return true;
        }
        return false;
    };
    return rec(0, {});
}

function parseSolution(raw: unknown): Record<string, number> {
    if (!Array.isArray(raw)) return {};
    const out: Record<string, number> = {};
    for (const entry of raw) {
        const [k, v] = String(entry).split("=");
        if (k && v !== undefined) out[k] = Number(v);
    }
    return out;
}

describe("ConsistencyEnforcementSearch", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(ces.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("agrees with brute force on satisfiable and unsatisfiable instances", () => {
        const cases: Array<{ domains: Domains; constraints: Array<[string, string]> }> = [
            { domains: { X: [1, 2, 3], Y: [1, 2], Z: [1, 2, 3], W: [1, 2, 3] }, constraints: [["X", "Y"], ["Y", "Z"], ["Z", "W"]] },
            { domains: { X: [1], Y: [1], Z: [1], W: [1] }, constraints: [["X", "Y"], ["Y", "Z"]] },
            { domains: { X: [1, 2], Y: [1, 2], Z: [1, 2], W: [1, 2] }, constraints: [["X", "Y"], ["Y", "Z"], ["Z", "W"], ["X", "W"]] },
            { domains: { X: [1, 2], Y: [1, 2], Z: [1], W: [1, 2] }, constraints: [["Y", "Z"], ["Z", "W"]] },
        ];
        for (const testCase of cases) {
            const frames = framesOf(testCase);
            const meta = frames[frames.length - 1]?.meta ?? {};
            const expected = bruteSatisfiable(testCase.domains, testCase.constraints);
            expect(meta.sat).toBe(expected);
            if (expected) {
                const solution = parseSolution(meta.solution);
                for (const v of Object.keys(testCase.domains)) {
                    expect(solution[v]).toBeDefined();
                    expect(testCase.domains[v]).toContain(solution[v]);
                }
                for (const [a, b] of testCase.constraints) {
                    expect(solution[a]).not.toBe(solution[b]);
                }
            }
            checkFrameShape(frames);
        }
    });
});
