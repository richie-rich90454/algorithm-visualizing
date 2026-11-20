/**
 * vertical-paxos.test.ts - Safety across reconfiguration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./vertical-paxos";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Vertical Paxos", () => {
    it("preserves the chosen value across a configuration change", () => {
        const input = mod.defaultInput as object;
        const frames = [...mod.run(input)];
        checkFrames(frames, 5);
        const recovery = frames.find((frame) => frame.meta["config"] === 1 && frame.meta["recovered"] === 10);
        expect(recovery).toBeDefined();
        expect(Number(recovery!.meta["recovered"])).toBe(10);
        expect(Number(recovery!.meta["intersection"])).toBe(1);

        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["chosen"])).toBe(10);
        const accepted = final["accepted"] as number[];
        for (const id of [2, 3, 4]) expect(accepted[id]).toBe(10);
    });

    it("never chooses a value the proposer requested after a prior value existed", () => {
        const frames = [...mod.run({ acceptors: 5, configs: [
            { acceptors: [0, 1, 2], primary: 0 },
            { acceptors: [2, 3, 4], primary: 3 },
        ], proposals: [42, 99] })];
        checkFrames(frames, 5);
        expect(Number(frames[frames.length - 1]!.meta["chosen"])).toBe(42);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
