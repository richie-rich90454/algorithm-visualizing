/**
 * pythagorean-triples.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./pythagorean-triples";
import type { VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    while (b !== 0) {
        const r = a % b;
        a = b;
        b = r;
    }
    return a;
}

/** Brute force every integer right triangle with hypotenuse at most limit. */
function bruteForce(limit: number): string[] {
    const triples: string[] = [];
    for (let a = 1; a < limit; a += 1) {
        for (let b = a + 1; b < limit; b += 1) {
            const c = Math.round(Math.sqrt(a * a + b * b));
            if (c <= limit && c * c === a * a + b * b && gcd(gcd(a, b), c) === 1) {
                triples.push(`${a},${b},${c}`);
            }
        }
    }
    return triples.sort();
}

function emittedTriples(frames: VisualFrame[]): string[] {
    const result: string[] = [];
    for (const frame of frames) {
        const last = frame.meta["last"];
        if (Array.isArray(last) && last.length === 3) {
            const legs = [Number(last[0]), Number(last[1])].sort((a, b) => a - b);
            result.push(`${legs[0]},${legs[1]},${last[2]}`);
        }
    }
    return result.sort();
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Pythagorean Triples", () => {
    it("matches a brute-force enumeration of primitive triples", () => {
        for (const limit of [20, 50, 100]) {
            const frames = [...mod.run({ limit })];
            checkFrames(frames);
            expect(emittedTriples(frames)).toEqual(bruteForce(limit));
        }
    });

    it("every emitted triple satisfies the Pythagorean identity", () => {
        const frames = [...mod.run({ limit: 200 })];
        for (const frame of frames) {
            const last = frame.meta["last"];
            if (Array.isArray(last) && last.length === 3) {
                const [a, b, c] = last as number[];
                expect((a ?? 0) ** 2 + (b ?? 0) ** 2).toBe((c ?? 0) ** 2);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
