import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./sum-of-two-squares";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

function brute(n: number): boolean {
    for (let a = 0; a * a <= n; a += 1) {
        const rest = n - a * a;
        const b = Math.round(Math.sqrt(rest));
        if (b * b === rest) return true;
    }
    return false;
}

describe("Sum of Two Squares", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("matches brute-force representability and verifies each witness", () => {
        for (const n of [0, 1, 2, 3, 4, 5, 10, 13, 25, 50, 65, 100, 101]) {
            const frames = [...module.run(n)];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.found).toBe(brute(n));
            if (last.meta.found === true) {
                const a = last.meta.a as number;
                const b = last.meta.b as number;
                expect(a * a + b * b).toBe(n);
            }
        }
    });
});
