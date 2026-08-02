/**
 * engine.test.ts – Smoke tests for the StepEngine.
 *
 * The engine is the backbone of playback, so it deserves a minimal test even
 * though it is not an algorithm module: these checks guarantee that loading a
 * generator buffers frames, stepping moves the pointer, and bounds are
 * respected at both ends of the sequence.
 */

import { describe, expect, it } from "vitest";
import { StepEngine } from "./engine";
import type { AlgorithmModule, VisualFrame } from "@/types";

/**
 * A tiny throwaway algorithm used purely to exercise the engine.
 * It yields three frames, each holding one idle bar entity.
 */
const stubModule: AlgorithmModule = {
    id: "stub",
    name: "Stub",
    category: "sorting",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: [1, 2, 3],
    visualType: "array",
    run: function* (): Generator<VisualFrame, void, unknown> {
        for (let i = 0; i < 3; i += 1) {
            yield {
                stepNumber: i,
                entities: [
                    {
                        id: `bar-${i}`,
                        type: "bar",
                        label: String(i),
                        value: i,
                        state: "idle",
                        x: 0,
                        y: 0,
                        width: 10,
                        height: 10,
                        metadata: {},
                    },
                ],
                edges: [],
                description: `frame ${i}`,
                layout: "array",
                meta: {},
            };
        }
    },
};

describe("StepEngine", () => {
    it("buffers every frame produced by the generator", () => {
        const engine = new StepEngine();
        const count = engine.load(stubModule, undefined);
        expect(count).toBe(3);
        expect(engine.totalFrames).toBe(3);
    });

    it("starts at the first frame and steps forward", () => {
        const engine = new StepEngine();
        engine.load(stubModule, undefined);
        expect(engine.step).toBe(0);
        expect(engine.next()).toBe(true);
        expect(engine.step).toBe(1);
        expect(engine.getCurrentFrame()?.description).toBe("frame 1");
    });

    it("refuses to step past the final frame", () => {
        const engine = new StepEngine();
        engine.load(stubModule, undefined);
        engine.next();
        engine.next();
        expect(engine.next()).toBe(false);
        expect(engine.step).toBe(2);
    });

    it("refuses to step before the first frame and can reset", () => {
        const engine = new StepEngine();
        engine.load(stubModule, undefined);
        expect(engine.prev()).toBe(false);
        engine.next();
        engine.reset();
        expect(engine.step).toBe(0);
    });
});
