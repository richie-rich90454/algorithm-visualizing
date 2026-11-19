/** davis-putnam-sat.test.ts - Brute-force satisfiability check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import davisPutnamSat from "./davis-putnam-sat";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(davisPutnamSat.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeTypeOf("object");
        frame.entities.forEach((entity) => expect(entity.type).toBe("cell"));
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

function bruteForceSat(clauses: number[][]): boolean {
    let variables = 0;
    for (const clause of clauses) {
        for (const literal of clause) {
            variables = Math.max(variables, Math.abs(literal));
        }
    }
    for (let mask = 0; mask < 2 ** variables; mask += 1) {
        let satisfies = true;
        for (const clause of clauses) {
            let clauseTrue = false;
            for (const literal of clause) {
                const value = (mask >> (Math.abs(literal) - 1)) & 1;
                if ((value === 1) === (literal > 0)) {
                    clauseTrue = true;
                    break;
                }
            }
            if (!clauseTrue) {
                satisfies = false;
                break;
            }
        }
        if (satisfies) {
            return true;
        }
    }
    return false;
}

describe("Davis-Putnam SAT", () => {
    it("matches brute-force satisfiability on several formulas", () => {
        const cases = [
            [[1, 2], [-1, 3], [-2, 3], [3]],
            [[1], [-1]],
            [[1, 2], [1, -2], [-1, 2], [-1, -2]],
            [[1, 2, 3], [-1, -2], [-2, -3], [-1, -3]],
            [[2, -3], [-2, 3], [1, 3], [-1, -3]],
            [[4, 5], [-4]],
            [[1, -1]],
        ];
        for (const clauses of cases) {
            const frames = sumAll(davisPutnamSat.run({ clauses }));
            const final = frames[frames.length - 1];
            const expected = bruteForceSat(clauses);
            expect(final?.meta["status"]).toBe(expected ? "satisfiable" : "unsatisfiable");
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(davisPutnamSat.run(davisPutnamSat.defaultInput)));
        const generator = davisPutnamSat.run(davisPutnamSat.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
