/**
 * envy-free-cake-cutting.test.ts - Independent envy-freeness and frame-contract tests.
 */

import { describe, expect, it } from "vitest";
import envyFreeCakeCutting from "./envy-free-cake-cutting";

function collect(input: unknown) {
    const frames = [];
    for (const frame of envyFreeCakeCutting.run(input)) {
        frames.push(frame);
    }
    return frames;
}

function lastFrame(input: unknown) {
    const frames = collect(input);
    const frame = frames[frames.length - 1];
    if (!frame) throw new Error("no frames");
    return frame;
}

/** Straightforward additive value of one interval; independent of the module. */
function intervalValue(density: number[], lo: number | undefined, hi: number | undefined): number {
    if (lo === undefined || hi === undefined || hi <= lo) {
        return 0;
    }
    let total = 0;
    for (let i = 0; i < density.length; i += 1) {
        const overlap = Math.max(0, Math.min(hi, i + 1) - Math.max(lo, i));
        total += (density[i] ?? 0) * overlap;
    }
    return total;
}

/** Value of a bundle encoded as a flat list of [lo, hi] boundary pairs. */
function bundleValue(density: number[], flat: number[]): number {
    let total = 0;
    for (let i = 0; i + 1 < flat.length; i += 2) {
        total += intervalValue(density, flat[i], flat[i + 1]);
    }
    return total;
}

function assertEnvyFree(input: { alice: number[]; bob: number[]; carol: number[] }): void {
    const meta = lastFrame(input).meta;
    const densities = [input.alice, input.bob, input.carol];
    const bundles = [
        meta.aliceBundle as number[],
        meta.bobBundle as number[],
        meta.carolBundle as number[],
    ];
    for (let p = 0; p < 3; p += 1) {
        const own = bundleValue(densities[p] as number[], bundles[p] as number[]);
        for (let q = 0; q < 3; q += 1) {
            const other = bundleValue(densities[p] as number[], bundles[q] as number[]);
            expect(own).toBeGreaterThanOrEqual(other - 1e-6);
        }
    }
    // The three bundles must partition the whole cake exactly.
    let covered = 0;
    for (const flat of bundles) {
        for (let i = 0; i + 1 < flat.length; i += 2) {
            const lo = flat[i] as number;
            const hi = flat[i + 1] as number;
            expect(lo).toBeGreaterThanOrEqual(-1e-9);
            expect(hi).toBeLessThanOrEqual(input.alice.length + 1e-9);
            covered += hi - lo;
        }
    }
    expect(covered).toBeCloseTo(input.alice.length, 6);
    expect(meta.envyFree).toBe(true);
}

describe("Envy-Free Cake Cutting", () => {
    it("produces an envy-free division on the default input", () => {
        assertEnvyFree(envyFreeCakeCutting.defaultInput as { alice: number[]; bob: number[]; carol: number[] });
    });

    it("passes a property check on many random additive valuations", () => {
        let seed = 987654321;
        const next = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const randomVector = () => Array.from({ length: 6 }, () => 1 + Math.floor(next() * 12));
            assertEnvyFree({ alice: randomVector(), bob: randomVector(), carol: randomVector() });
        }
    });

    it("handles identical valuations for all three players", () => {
        assertEnvyFree({ alice: [1, 1, 1, 1, 1, 1], bob: [1, 1, 1, 1, 1, 1], carol: [1, 1, 1, 1, 1, 1] });
    });

    it("emits well-formed VisualFrames with sequential steps", () => {
        const frames = collect(envyFreeCakeCutting.defaultInput);
        expect(frames.length).toBeGreaterThanOrEqual(10);
        const pseudocodeLength = envyFreeCakeCutting.pseudocode?.length ?? 0;
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(pseudocodeLength);
            expect(frame.layout).toBe("array");
            expect(frame.edges).toEqual([]);
            expect(frame.meta).toHaveProperty("phase");
            const ids = frame.entities.map((entity) => entity.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
        const phases = frames.map((frame) => frame.meta.phase);
        expect(phases).toContain("trim");
        expect(phases).toContain("y-cuts");
        expect(phases[phases.length - 1]).toBe("done");
    });

    it("terminates cleanly", () => {
        let count = 0;
        for (const _frame of envyFreeCakeCutting.run(envyFreeCakeCutting.defaultInput)) {
            count += 1;
            expect(count).toBeLessThan(100);
        }
        expect(count).toBeGreaterThan(0);
    });
});
