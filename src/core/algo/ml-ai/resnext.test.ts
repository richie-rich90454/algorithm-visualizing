/** resnext.test.ts - Brute-force grouped-parameter oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./resnext";
import type { VisualFrame } from "@/types";

interface Input {
    inChannels: number;
    outChannels: number;
    groups: number;
    kernel: number;
}

function reference(input: Input) {
    let groups = input.groups;
    groups = Math.max(1, Math.min(groups, Math.min(input.inChannels, input.outChannels)));
    if (input.inChannels % groups !== 0 || input.outChannels % groups !== 0) groups = 1;
    const inPerGroup = input.inChannels / groups;
    const outPerGroup = input.outChannels / groups;
    let perGroup = 0;
    for (let g = 0; g < groups; g += 1) {
        for (let ci = 0; ci < inPerGroup; ci += 1) {
            for (let co = 0; co < outPerGroup; co += 1) {
                perGroup += input.kernel * input.kernel;
            }
        }
        break;
    }
    const total = perGroup * groups;
    const dense = input.kernel * input.kernel * input.inChannels * input.outChannels;
    return { groups, inPerGroup, outPerGroup, perGroup, total, dense, reduction: dense / total };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ResNeXt Grouped Convolution", () => {
    it("matches a brute-force weight count", () => {
        const cases: Input[] = [
            { inChannels: 64, outChannels: 64, groups: 32, kernel: 3 },
            { inChannels: 48, outChannels: 96, groups: 8, kernel: 3 },
            { inChannels: 32, outChannels: 32, groups: 1, kernel: 5 },
            { inChannels: 100, outChannels: 100, groups: 7, kernel: 3 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["groups"]).toBe(expected.groups);
            expect(meta?.["inPerGroup"]).toBe(expected.inPerGroup);
            expect(meta?.["outPerGroup"]).toBe(expected.outPerGroup);
            const params = meta?.["params"] as number[];
            expect(params[0]).toBe(expected.perGroup);
            expect(params[1]).toBe(expected.total);
            expect(params[2]).toBe(expected.dense);
            expect(Number(meta?.["reduction"])).toBeCloseTo(expected.reduction, 8);
        }
    });

    it("keeps the dense total identical and reduces weights", () => {
        const input: Input = { inChannels: 64, outChannels: 64, groups: 16, kernel: 3 };
        const meta = [...mod.run(input)].at(-1)?.meta;
        const params = meta?.["params"] as number[];
        expect(Number(meta?.["reduction"])).toBeCloseTo(16, 8);
        expect(params[1] * 16).toBe(params[2]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
