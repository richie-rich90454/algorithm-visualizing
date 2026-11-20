/** calkin-wilf-tree.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./calkin-wilf-tree";
import type { VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    while (b !== 0) {
        const t = a % b;
        a = b;
        b = t;
    }
    return a;
}

/** Stern's diatomic sequence, computed independently by recursion + memo. */
function fusc(n: number, memo = new Map<number, number>()): number {
    if (n === 0) return 0;
    if (n === 1) return 1;
    const cached = memo.get(n);
    if (cached !== undefined) return cached;
    let value: number;
    if (n % 2 === 0) {
        value = fusc(n / 2, memo);
    } else {
        value = fusc((n - 1) / 2, memo) + fusc((n + 1) / 2, memo);
    }
    memo.set(n, value);
    return value;
}

function parseFraction(text: string): [number, number] {
    const [a, b] = text.split("/").map(Number);
    return [a!, b!];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Calkin-Wilf tree", () => {
    it("enumerates reduced unique fractions matching the Stern sequence", () => {
        const frames = [...mod.run({ count: 31 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const fractions = final?.["fractions"] as string[];
        expect(final?.["allReduced"]).toBe(true);
        expect(final?.["unique"]).toBe(true);
        expect(fractions.length).toBe(31);

        const pairs = fractions.map(parseFraction);
        for (let i = 0; i < pairs.length; i += 1) {
            const [a, b] = pairs[i]!;
            expect(gcd(a, b)).toBe(1);
            // Calkin-Wilf sequence equals fusc(n)/fusc(n+1) for n >= 1.
            const n = i + 1;
            expect(a).toBe(fusc(n));
            expect(b).toBe(fusc(n + 1));
        }
        // Child recurrence holds for the breadth-first layout.
        for (let i = 0; i < 10; i += 1) {
            const [a, b] = pairs[i]!;
            expect(pairs[2 * i + 1]).toEqual([a, a + b]);
            expect(pairs[2 * i + 2]).toEqual([a + b, b]);
        }
    });

    it("finds a target path by backward subtraction", () => {
        for (const [a, b] of [
            [3, 2],
            [5, 7],
            [1, 1],
            [8, 3],
        ]) {
            const frames = [...mod.run({ count: 31, targetA: a, targetB: b })];
            checkFrames(frames);
            const targetFrame = frames.find((f) => f.meta["target"] === `${a}/${b}`);
            expect(targetFrame).toBeDefined();
            const path = targetFrame?.meta["path"] as string;
            // Replay the path from 1/1 to confirm it lands on the target.
            let x = 1;
            let y = 1;
            for (const step of path) {
                if (step === "L") y = x + y;
                else x = x + y;
            }
            expect([x, y]).toEqual([a, b]);
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
