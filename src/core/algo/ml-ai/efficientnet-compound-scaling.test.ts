/**
 * efficientnet-compound-scaling.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./efficientnet-compound-scaling";
import type { VisualFrame } from "@/types";

interface ScalingInput {
    baseDepth: number; baseWidth: number; baseResolution: number;
    alpha: number; beta: number; gamma: number; phi: number;
}

function resolve(input: unknown): ScalingInput {
    const t = (input as Partial<ScalingInput> | null) ?? {};
    return {
        baseDepth: typeof t.baseDepth === "number" ? t.baseDepth : 1,
        baseWidth: typeof t.baseWidth === "number" ? t.baseWidth : 16,
        baseResolution: typeof t.baseResolution === "number" ? t.baseResolution : 32,
        alpha: typeof t.alpha === "number" ? t.alpha : 1.2,
        beta: typeof t.beta === "number" ? t.beta : 1.1,
        gamma: typeof t.gamma === "number" ? t.gamma : 1.15,
        phi: typeof t.phi === "number" ? t.phi : 1,
    };
}

function roundEight(v: number): number { return Math.max(8, Math.round(v / 8) * 8); }

function reference(cfg: ScalingInput) {
    const depth = Math.max(1, Math.round(cfg.baseDepth * cfg.alpha ** cfg.phi));
    const width = roundEight(cfg.baseWidth * cfg.beta ** cfg.phi);
    const resolution = roundEight(cfg.baseResolution * cfg.gamma ** cfg.phi);
    const baseF = cfg.baseDepth * cfg.baseWidth ** 2 * cfg.baseResolution ** 2;
    const scaledF = depth * width ** 2 * resolution ** 2;
    return { depth, width, resolution, flopsFactor: scaledF / baseF, target: (cfg.alpha * cfg.beta ** 2 * cfg.gamma ** 2) ** cfg.phi };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe(mod.visualType);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("EfficientNet compound scaling", () => {
    it("matches an independent scaling reference for several phi values", () => {
        for (const phi of [0, 1, 2, 3]) {
            const cfg = resolve({ ...mod.defaultInput, phi });
            const frames = [...mod.run(cfg)];
            checkFrames(frames);
            const expected = reference(cfg);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["depth"])).toBe(expected.depth);
            expect(Number(final?.["width"])).toBe(expected.width);
            expect(Number(final?.["resolution"])).toBe(expected.resolution);
            expect(Number(final?.["flopsFactor"])).toBeCloseTo(expected.flopsFactor, 6);
        }
    });

    it("leaves the base network unchanged at phi zero and respects rounding", () => {
        const cfg = resolve({ ...mod.defaultInput, phi: 0 });
        const frames = [...mod.run(cfg)];
        const base = frames[0]?.meta;
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["depth"]).toBe(base?.["depth"]);
        expect(final?.["width"]).toBe(base?.["width"]);
        expect(final?.["resolution"]).toBe(base?.["resolution"]);
        const scaled = [...mod.run(mod.defaultInput)][4]?.meta;
        expect(Number(scaled?.["width"]) % 8).toBe(0);
        expect(Number(scaled?.["resolution"]) % 8).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
