/**
 * msi-protocol.test.ts - Invariant property checks, hand-computed final state,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./msi-protocol";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("MSI Cache Coherence Protocol", () => {
    it("keeps the coherence invariant on every frame", () => {
        const input = mod.defaultInput as { caches: number; blocks: number; accesses: unknown[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.caches * input.blocks);
        for (const frame of frames) {
            expect(frame.meta["invariantHolds"]).toBe(true);
            const states = frame.meta["states"] as string[][] | undefined;
            if (states) {
                let modified = 0;
                let shared = 0;
                for (const row of states) {
                    if (row[0] === "M") modified += 1;
                    if (row[0] === "S") shared += 1;
                }
                expect(modified).toBeLessThanOrEqual(1);
                expect(modified === 0 || shared === 0).toBe(true);
            }
        }
    });

    it("reaches the hand-computed final state", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const last = frames[frames.length - 1]!.meta;
        const states = last["states"] as string[][];
        expect(states[0][0]).toBe("S");
        expect(states[1][0]).toBe("S");
        expect(states[2][0]).toBe("S");
        expect(last["busTransactions"]).toBe(5);
    });

    it("serves a write hit locally without a bus transaction", () => {
        const access = (cache: number, action: "read" | "write") => ({ cache, action, block: 0 });
        const frames = [...mod.run({
            caches: 2,
            blocks: 1,
            accesses: [access(0, "write"), access(0, "write"), access(1, "write")],
        })];
        checkFrames(frames, 2);
        expect(frames[2]!.meta["transaction"]).toBe("none");
        expect(frames[3]!.meta["transaction"]).toBe("bus read exclusive");
        expect((frames[frames.length - 1]!.meta["states"] as string[][])[1][0]).toBe("M");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
