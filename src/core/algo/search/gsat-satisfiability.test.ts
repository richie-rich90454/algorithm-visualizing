/**
 * gsat-satisfiability.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./gsat-satisfiability";
import type { VisualFrame } from "@/types";

function satisfies(clauses: number[][], assignment: number[]): boolean {
    return clauses.every((clause) =>
        clause.some((lit) => {
            const value = assignment[Math.abs(lit) - 1] === 1;
            return lit > 0 ? value : !value;
        }),
    );
}

function bruteSatisfiable(clauses: number[][], variables: number): boolean {
    for (let mask = 0; mask < 1 << variables; mask += 1) {
        const assignment = Array.from({ length: variables }, (_v, i) => ((mask >> i) & 1) as number);
        if (satisfies(clauses, assignment)) return true;
    }
    return false;
}

function checkFrames(frames: VisualFrame[], variables: number, clauseCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(variables + clauseCount);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const assignment = frame.meta["assignment"] as number[];
        const flags = frame.meta["satFlags"] as number[];
        expect(assignment.length).toBe(variables);
        expect(flags.length).toBe(clauseCount);
        expect(frame.meta["satCount"]).toBe(flags.filter((f) => f === 1).length);
    });
}

interface Input {
    clauses: number[][];
    variables: number;
    maxFlips: number;
    restarts: number;
    seed: number;
    noise: number;
}

function run(input: Input): VisualFrame[] {
    const frames = [...mod.run(input)];
    checkFrames(frames, input.variables, input.clauses.length);
    return frames;
}

describe("GSAT Satisfiability Search", () => {
    it("finds a genuinely satisfying assignment on the default formula", () => {
        const input = mod.defaultInput as Input;
        const frames = run(input);
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(final["found"]).toBe(true);
        expect(satisfies(input.clauses, final["assignment"] as number[])).toBe(true);
        expect(final["satCount"]).toBe(input.clauses.length);
    });

    it("never reports success on an unsatisfiable formula", () => {
        const input: Input = {
            clauses: [[1], [-1]],
            variables: 1,
            maxFlips: 20,
            restarts: 3,
            seed: 5,
            noise: 0.2,
        };
        const frames = run(input);
        expect(frames[frames.length - 1]?.meta["found"]).toBe(false);
    });

    it("agrees with brute-force satisfiability on small formulas", () => {
        const cases: number[][][] = [
            [
                [1, 2],
                [-1, 2],
                [1, -2],
                [-1, -2],
            ],
            [
                [1, 2, 3],
                [-1, -2],
                [-2, -3],
                [2, -3],
            ],
            [
                [1],
                [2],
                [-3],
            ],
        ];
        cases.forEach((clauses, index) => {
            const variables = 3;
            const input: Input = {
                clauses,
                variables,
                maxFlips: 300,
                restarts: 8,
                seed: 17 + index,
                noise: 0.15,
            };
            const frames = run(input);
            const found = frames[frames.length - 1]?.meta["found"] === true;
            expect(found).toBe(bruteSatisfiable(clauses, variables));
            if (found) {
                expect(satisfies(clauses, frames[frames.length - 1]?.meta["assignment"] as number[])).toBe(true);
            }
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
