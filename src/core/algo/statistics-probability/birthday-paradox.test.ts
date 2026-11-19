/**
 * birthday-paradox.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./birthday-paradox";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], people: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(people);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Brute-force enumeration of all d^k birthday assignments. */
function bruteForceCollisionProbability(days: number, people: number): number {
    let total = 1;
    for (let i = 0; i < people; i += 1) {
        total *= days;
    }
    let collisions = 0;
    for (let assignment = 0; assignment < total; assignment += 1) {
        let value = assignment;
        const seen = new Set<number>();
        let shared = false;
        for (let i = 0; i < people; i += 1) {
            const day = value % days;
            value = Math.floor(value / days);
            if (seen.has(day)) {
                shared = true;
                break;
            }
            seen.add(day);
        }
        if (shared) {
            collisions += 1;
        }
    }
    return collisions / total;
}

describe("Birthday paradox", () => {
    it("matches brute-force enumeration on small spaces", () => {
        const cases: Array<[number, number]> = [
            [2, 2], [3, 2], [5, 3], [4, 4], [6, 3], [7, 2],
        ];
        for (const [days, people] of cases) {
            const frames = [...mod.run({ days, people })];
            checkFrames(frames, people);
            const final = frames[frames.length - 1]!.meta;
            expect(final["probability"]).toBeCloseTo(bruteForceCollisionProbability(days, people), 10);
            expect(final["distinctProbability"]).toBeCloseTo(1 - bruteForceCollisionProbability(days, people), 10);
        }
    });

    it("reports the classic 23-person result and boundary cases", () => {
        const classic = [...mod.run({ days: 365, people: 23 })];
        const probability = classic[classic.length - 1]!.meta["probability"] as number;
        expect(probability).toBeCloseTo(0.5072972343, 6);

        const none = [...mod.run({ days: 365, people: 0 })];
        expect(none[none.length - 1]!.meta["probability"]).toBe(0);

        const allDays = [...mod.run({ days: 5, people: 5 })];
        const full = allDays[allDays.length - 1]!.meta["probability"] as number;
        expect(full).toBeCloseTo(1 - 120 / 3125, 10);
    });

    it("has monotone growing collision probability", () => {
        const frames = [...mod.run({ days: 365, people: 30 })];
        const bars = frames[frames.length - 1]!.entities;
        for (let i = 1; i < bars.length; i += 1) {
            expect(bars[i]!.value as number).toBeGreaterThanOrEqual(bars[i - 1]!.value as number);
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
