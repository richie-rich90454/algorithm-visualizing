import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./lucas-primality-test";

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

function isPrime(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}

describe("Lucas Primality Test", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("agrees with trial division over a range and validates witnesses", () => {
        for (let n = 2; n <= 120; n += 1) {
            const frames = [...module.run(n)];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.isPrime).toBe(isPrime(n));
            if (last.meta.isPrime === true && n > 2) {
                expect(last.meta.witness).toBeGreaterThan(1);
            }
        }
    });
});
