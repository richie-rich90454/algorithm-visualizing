/**
 * tit-for-tat-strategy.test.ts - Independent simulation, mirroring property, frames.
 */
import { describe, expect, it } from "vitest";
import mod from "./tit-for-tat-strategy";
import type { VisualFrame } from "@/types";

type Payoffs = { cc: [number, number]; cd: [number, number]; dc: [number, number]; dd: [number, number] };
const PAY: Payoffs = { cc: [3, 3], cd: [0, 5], dc: [5, 0], dd: [1, 1] };

/** Reference simulation written as a single forward pass over move pairs. */
function reference(rounds: number, strategy: string) {
    let a = "C";
    let totalA = 0;
    let totalB = 0;
    const history: string[] = [];
    for (let r = 0; r < rounds; r += 1) {
        let b = "D";
        if (strategy === "always-cooperate") b = "C";
        else if (strategy === "grim") b = history.some((h) => h.includes("D")) ? "D" : "C";
        else if (strategy === "alternator") b = r % 2 === 0 ? "C" : "D";
        const key = `${a}${b}`;
        const payoff = key === "CC" ? PAY.cc : key === "CD" ? PAY.cd : key === "DC" ? PAY.dc : PAY.dd;
        totalA += payoff[0];
        totalB += payoff[1];
        history.push(key);
        a = b;
    }
    return { totalA, totalB, history };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Tit-for-Tat Strategy", () => {
    it("matches an independent repeated-game simulation", () => {
        for (const strategy of ["always-defect", "always-cooperate", "grim", "alternator"]) {
            const frames = [...mod.run({ rounds: 8, opponent: strategy })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(8, strategy);
            expect(final?.["totalA"]).toBe(expected.totalA);
            expect(final?.["totalB"]).toBe(expected.totalB);
            expect(final?.["history"]).toEqual(expected.history);
        }
    });

    it("mirrors the opponent's previous move from round two", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const history = frames[frames.length - 1]?.meta["history"] as string[];
        expect(history[0]?.[0]).toBe("C");
        for (let r = 1; r < history.length; r += 1) {
            expect(history[r]?.[0]).toBe(history[r - 1]?.[1]);
        }
        expect(frames[frames.length - 1]?.meta["totalA"]).toBe(9);
        expect(frames[frames.length - 1]?.meta["totalB"]).toBe(14);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
