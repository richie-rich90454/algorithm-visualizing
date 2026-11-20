/** sticky-sampling.test.ts - Frequent-item properties, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./sticky-sampling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(Number(e.value)))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("StickySampling", () => {
    it("reports the genuinely frequent items and never invents one", () => {
        const stream = [
            ...Array(24).fill("hot"),
            ...Array(4).fill("warm"),
            ...Array.from({ length: 12 }, (_, i) => `cold${i}`),
        ];
        const input = { stream, support: 0.5, error: 0.05, seed: 777 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        const reported = last.meta["reported"] as string[];
        expect(reported).toContain("hot");
        expect(reported).not.toContain("warm");
        expect(reported.every((item) => stream.includes(item))).toBe(true);
    });

    it("is deterministic for a fixed seed", () => {
        const input = mod.defaultInput as { support: number; error: number; seed: number };
        const first = [...mod.run(input)];
        const second = [...mod.run(input)];
        expect(first.length).toBe(second.length);
        expect(first[first.length - 1]?.meta["reported"]).toEqual(second[second.length - 1]?.meta["reported"]);
        expect(first[first.length - 1]?.meta["estimates"]).toEqual(second[second.length - 1]?.meta["estimates"]);
    });

    it("halves the rate at decays, terminates cleanly, and tolerates an empty stream", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(generator.next().done).toBe(true);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(Number(last.meta["decays"])).toBeGreaterThan(0);
        expect(Number(last.meta["sampleRate"])).toBeLessThan(1);
        expect(Number(last.meta["streamLength"])).toBe(40);

        const empty = [...mod.run({ stream: [], support: 0.2, error: 0.05, seed: 1 })];
        checkFrames(empty);
        expect((empty[empty.length - 1] as VisualFrame).meta["reported"]).toEqual([]);
    });
});
