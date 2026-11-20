/**
 * vector-commitment.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./vector-commitment";
import type { VisualFrame } from "@/types";

const P = 2147483647;
function gens(n: number): number[] {
    return Array.from({ length: n }, (_, i) => (2 ** (i + 3) + 12345 * (i + 1)) % P);
}
function reference(vector: number[], r: number): number {
    const g = gens(vector.length);
    let total = 0;
    for (let i = 0; i < vector.length; i += 1) {
        total = (total + (vector[i] ?? 0) * (g[i] ?? 0)) % P;
    }
    return ((total + r * (987654321 % P)) % P + P) % P;
}
function final(input: unknown): Record<string, unknown> {
    const frames = [...mod.run(input)];
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    return frames[frames.length - 1]?.meta as unknown as Record<string, unknown>;
}

describe("Pedersen vector commitment toy model", () => {
    it("matches an independent commitment and always verifies", () => {
        const cases = [
            { vector: [3, 5, 7, 11], randomness: 42 },
            { vector: [1], randomness: 0 },
            { vector: [100, 200, 300, 400, 500], randomness: 99991 },
        ];
        for (const testCase of cases) {
            const meta = final(testCase);
            expect(meta["commitment"]).toBe(reference(testCase.vector, testCase.randomness));
            expect(meta["verification"]).toBe(true);
        }
    });

    it("hides the vector behind a changing blinder and changes with the message", () => {
        const vector = [3, 5, 7, 11];
        const a = final({ vector, randomness: 1 })["commitment"];
        const b = final({ vector, randomness: 2 })["commitment"];
        const c = final({ vector: [3, 5, 7, 12], randomness: 1 })["commitment"];
        expect(a).not.toBe(b);
        expect(a).not.toBe(c);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
