/** burnside-polya-enumeration.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./burnside-polya-enumeration";
import type { VisualFrame } from "@/types";

function rotationsOf(colors: number[]): number[][] {
    const n = colors.length;
    return Array.from({ length: n }, (_, k) =>
        Array.from({ length: n }, (_, i) => colors[(i + k) % n]!),
    );
}

function canonical(colors: number[], reflections: boolean): string {
    const variants: number[][] = [...rotationsOf(colors)];
    if (reflections) {
        for (const reversed of [colors.slice().reverse()]) {
            variants.push(...rotationsOf(reversed));
        }
    }
    return variants.map((v) => v.join("")).sort()[0]!;
}

/** Brute-force orbit count by enumerating every coloring. */
function bruteForceOrbits(n: number, colors: number, reflections: boolean): number {
    const seen = new Set<string>();
    const current = new Array<number>(n).fill(0);
    const enumerate = (position: number): void => {
        if (position === n) {
            seen.add(canonical(current, reflections));
            return;
        }
        for (let c = 0; c < colors; c += 1) {
            current[position] = c;
            enumerate(position + 1);
        }
    };
    enumerate(0);
    return seen.size;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Burnside-Polya enumeration", () => {
    it("matches brute-force orbit counts for necklaces and bracelets", () => {
        for (const reflections of [false, true]) {
            for (let n = 3; n <= 8; n += 1) {
                for (const colors of [2, 3]) {
                    const frames = [...mod.run({ beads: n, colors, reflections })];
                    checkFrames(frames);
                    const final = frames[frames.length - 1]?.meta;
                    expect(final?.["orbits"]).toBe(bruteForceOrbits(n, colors, reflections));
                    expect(final?.["totalFixed"]).toBe(
                        (final?.["fixedCounts"] as number[]).reduce((a, b) => a + b, 0),
                    );
                    expect(final?.["groupSize"]).toBe(reflections ? 2 * n : n);
                    expect(
                        (final?.["totalFixed"] as number) % (final?.["groupSize"] as number),
                    ).toBe(0);
                }
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
