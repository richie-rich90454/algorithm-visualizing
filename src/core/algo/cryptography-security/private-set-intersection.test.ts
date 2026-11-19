/** private-set-intersection.test.ts - Brute-force intersection cross-check, root property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { evaluatePolynomial, psi, rootPolynomial } from "./private-set-intersection";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.length).toBeLessThanOrEqual(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Private Set Intersection via Polynomial Evaluation", () => {
    it("the root polynomial vanishes exactly on its roots", () => {
        for (let mask = 0; mask < 32; mask += 1) {
            const roots = Array.from({ length: 5 }, (_, i) => (mask + i * 3) % 31);
            const polynomial = rootPolynomial(roots);
            const rootSet = new Set(roots);
            for (let value = 0; value < 31; value += 1) {
                const evaluation = evaluatePolynomial(polynomial, value);
                if (rootSet.has(value)) {
                    expect(evaluation).toBe(0);
                } else {
                    expect(evaluation).not.toBe(0);
                }
            }
        }
    });

    it("matches a brute-force set intersection across many small sets", () => {
        for (let clientMask = 0; clientMask < 24; clientMask += 1) {
            for (let serverMask = 0; serverMask < 24; serverMask += 1) {
                const client = Array.from({ length: 4 }, (_, i) => (clientMask + i * 5) % 29);
                const server = Array.from({ length: 4 }, (_, i) => (serverMask + i * 7) % 29);
                const expected = client.filter((value) => new Set(server).has(value));
                expect(psi(client, server)).toEqual(expected);
            }
        }
    });

    it("handles empty sets and duplicates", () => {
        expect(psi([], [1, 2, 3])).toEqual([]);
        expect(psi([1, 2, 3], [])).toEqual([]);
        expect(psi([], [])).toEqual([]);
        expect(psi([5, 5, 6], [5, 6])).toEqual([5, 5, 6]);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["intersection"]).toBe("7,12");
        expect(frames[frames.length - 1]?.meta["size"]).toBe(2);
        expect(generator.next().done).toBe(true);
    });
});
