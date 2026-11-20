import { describe, expect, it } from "vitest";
import mod from "./frobenius-number";
import type { VisualFrame } from "@/types";

function bruteFrobenius(coins: number[], limit = 400): number {
    const representable = new Array<boolean>(limit + 1).fill(false);
    representable[0] = true;
    for (let value = 0; value <= limit; value += 1) {
        if (!representable[value]) {
            continue;
        }
        for (const coin of coins) {
            if (value + coin <= limit) {
                representable[value + coin] = true;
            }
        }
    }
    let largest = -1;
    for (let value = 0; value <= limit; value += 1) {
        if (!representable[value]) {
            largest = value;
        }
    }
    return largest;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Frobenius Number", () => {
    it("matches brute-force representability for coprime coin sets", () => {
        const sets = [
            [2, 3],
            [3, 5],
            [4, 7],
            [6, 9, 20],
            [5, 7, 11],
            [4, 9, 11],
        ];
        for (const coins of sets) {
            const frames = [...mod.run({ coins })];
            checkFrames(frames);
            expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(bruteFrobenius(coins));
        }
    });

    it("returns the sentinel when denominations share a factor", () => {
        for (const coins of [
            [4, 6],
            [6, 9, 21],
            [10, 15],
        ]) {
            const frames = [...mod.run({ coins })];
            expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(-1);
            expect(frames[frames.length - 1]?.meta["exists"]).toBe(false);
        }
    });

    it("solves the classical McNuggets case", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(43);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
