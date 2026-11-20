/** moving-knife-cake-cutting.test.ts - Independent allocation cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./moving-knife-cake-cutting";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function normalize(values: number[]): number[] {
    const sum = values.reduce((a, b) => a + b, 0);
    return values.map((value) => (value * 100) / sum);
}

function valueUpTo(density: number[], x: number): number {
    const position = Math.max(0, Math.min(1, x)) * density.length;
    let total = 0;
    for (let i = 0; i < density.length; i += 1) {
        total += (density[i] ?? 0) * Math.max(0, Math.min(1, position - i));
    }
    return total;
}

function callPoint(density: number[], start: number, threshold: number): number {
    if (valueUpTo(density, 1) - valueUpTo(density, start) < threshold) return 1;
    let low = start;
    let high = 1;
    for (let i = 0; i < 80; i += 1) {
        const middle = (low + high) / 2;
        if (valueUpTo(density, middle) - valueUpTo(density, start) < threshold) low = middle;
        else high = middle;
    }
    return high;
}

/** Independent round-by-round computation of received values. */
function reference(players: number[][]): number[] {
    const densities = players.map(normalize);
    const remaining = new Set(densities.map((_, index) => index));
    const pieces = densities.map(() => [0, 0]);
    let start = 0;
    while (remaining.size > 1) {
        const threshold = 100 / densities.length;
        let caller = -1;
        let cut = 1;
        for (const player of remaining) {
            const point = callPoint(densities[player] ?? [], start, threshold);
            if (point < cut - 1e-9) {
                cut = point;
                caller = player;
            }
        }
        pieces[caller] = [start, cut];
        remaining.delete(caller);
        start = cut;
    }
    const last = [...remaining][0] ?? 0;
    pieces[last] = [start, 1];
    return densities.map((density, player) => {
        const piece = pieces[player] ?? [0, 0];
        return valueUpTo(density, piece[1] ?? 0) - valueUpTo(density, piece[0] ?? 0);
    });
}

describe("Moving-Knife Cake Cutting", () => {
    it("matches an independent protocol simulation and is proportional", () => {
        const cases = [
            [[10, 30, 40, 20], [30, 20, 10, 40], [20, 40, 30, 10]],
            [[50, 50], [10, 90], [70, 30]],
            [[1, 1, 1], [5, 1, 1], [1, 5, 1], [1, 1, 5]],
        ];
        for (const players of cases) {
            const frames = [...mod.run({ players })];
            checkFrames(frames);
            const received = frames[frames.length - 1]?.meta["received"] as number[];
            const expected = reference(players);
            expected.forEach((value, index) => expect(received[index] ?? 0).toBeCloseTo(value ?? 0, 4));
            const fairShare = 100 / players.length;
            received.forEach((value) => expect(value).toBeGreaterThanOrEqual(fairShare - 1e-3));
        }
    });

    it("covers the whole cake with ordered intervals", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const cuts = frames.map((frame) => Number(frame.meta["cut"]));
        expect(cuts[0]).toBe(0);
        expect(cuts[cuts.length - 1]).toBe(1);
        for (let index = 1; index < cuts.length; index += 1) {
            expect(cuts[index] ?? 0).toBeGreaterThanOrEqual(cuts[index - 1] ?? 0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
