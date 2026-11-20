import { describe, expect, it } from "vitest";
import mod from "./berkman-vishkin-rmq";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Berkman-Vishkin RMQ", () => {
    it("answers the default query correctly", () => {
        const input = mod.defaultInput as { array: number[]; query: [number, number] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.array.length);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["answer"]).toBe(Math.min(...input.array.slice(1, 6)));
    });

    it("matches brute force on every range of random arrays", () => {
        for (let trial = 0; trial < 8; trial += 1) {
            const array = Array.from({ length: 3 + trial }, () => Math.floor(Math.random() * 30));
            for (let l = 0; l < array.length; l += 1) {
                for (let r = l; r < array.length; r += 1) {
                    const frames = [...mod.run({ array, query: [l, r] })];
                    const answer = frames[frames.length - 1]?.meta["answer"];
                    expect(answer).toBe(Math.min(...array.slice(l, r + 1)));
                }
            }
        }
    });

    it("handles an empty array and terminates cleanly", () => {
        expect([...mod.run({ array: [], query: [0, 0] })].length).toBe(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
