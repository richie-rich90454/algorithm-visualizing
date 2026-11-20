/**
 * bitcoin-nngc.test.ts - Leader schedule and fork-choice scoring, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bitcoin-nngc";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(Number(frame.meta["rows"]) * Number(frame.meta["cols"]));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bitcoin-NG Consensus", () => {
    it("elects the scheduled leaders and follows the heavier chain", () => {
        const input = mod.defaultInput as { miners: number; rounds: number; microblocks: number; forkRound: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;

        const leaders = final["leaders"] as number[];
        expect(leaders).toEqual(Array.from({ length: input.rounds }, (_, round) => (round * 7 + 3) % input.miners));
        expect(Number(final["mainKeyBlocks"])).toBe(input.rounds);
        expect(Number(final["mainMicroblocks"])).toBe(input.rounds * input.microblocks);

        const expectedMainWork = Number(final["mainKeyBlocks"]) * 100 + Number(final["mainMicroblocks"]);
        const expectedForkWork = Number(final["forkKeyBlocks"]) * 100 + Number(final["forkMicroblocks"]);
        expect(Number(final["mainWork"])).toBe(expectedMainWork);
        expect(Number(final["forkWork"])).toBe(expectedForkWork);
        const expectedChoice = expectedMainWork > expectedForkWork ? "main" : "fork";
        expect(String(final["chosen"])).toBe(expectedChoice);
        expect(String(final["chosen"])).toBe("main");
    });

    it("scores chains independently on alternate inputs", () => {
        const frames = [...mod.run({ miners: 3, rounds: 6, microblocks: 2, forkRound: 4 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const mainWork = Number(final["mainWork"]);
        const forkWork = Number(final["forkWork"]);
        expect(String(final["chosen"])).toBe(mainWork >= forkWork ? "main" : "fork");
        expect((final["leaders"] as number[]).length).toBe(6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
