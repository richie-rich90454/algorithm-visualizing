/** c4-5.test.ts - Brute-force entropy and gain-ratio checks. */

import { describe, expect, it } from "vitest";
import mod from "./c4-5";
import type { VisualFrame } from "@/types";

type Row = Record<string, string>;
interface Input {
    rows: Row[];
    attributes: string[];
    target: string;
    maxDepth: number;
}

const log2 = (x: number): number => (x <= 0 ? 0 : Math.log(x) / Math.LN2);

function entropy(rows: Row[], target: string): number {
    if (rows.length === 0) return 0;
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row[target] ?? "", (counts.get(row[target] ?? "") ?? 0) + 1);
    let h = 0;
    for (const c of counts.values()) h -= (c / rows.length) * log2(c / rows.length);
    return h;
}
function groups(rows: Row[], attr: string): Row[][] {
    const m = new Map<string, Row[]>();
    for (const row of rows) {
        const key = row[attr] ?? "";
        m.set(key, [...(m.get(key) ?? []), row]);
    }
    return [...m.values()];
}
function gain(rows: Row[], attr: string, target: string): number {
    const rest = groups(rows, attr).reduce((s, g) => s + (g.length / rows.length) * entropy(g, target), 0);
    return entropy(rows, target) - rest;
}
function splitInfo(rows: Row[], attr: string): number {
    return groups(rows, attr).reduce((s, g) => {
        const p = g.length / rows.length;
        return s - p * log2(p);
    }, 0);
}

function checkFrames(frames: VisualFrame[], attrs: number): void {
    expect(frames.length).toBe(attrs + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3 * attrs);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("C4.5 decision tree", () => {
    const input = mod.defaultInput as Input;

    it("matches independent entropy, gain, and gain-ratio computations", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.attributes.length);
        const final = frames[frames.length - 1]?.meta;
        const gains = final?.["gains"] as number[];
        const splits = final?.["splits"] as number[];
        const ratios = final?.["ratios"] as number[];
        input.attributes.forEach((attr, i) => {
            expect(gains[i] ?? 0).toBeCloseTo(gain(input.rows, attr, input.target), 9);
            expect(splits[i] ?? 0).toBeCloseTo(splitInfo(input.rows, attr), 9);
            expect(ratios[i] ?? 0).toBeCloseTo((gains[i] ?? 0) / (splits[i] ?? 1), 9);
        });
        const argmax = ratios.indexOf(Math.max(...ratios));
        expect(final?.["chosen"]).toBe(argmax);
    });

    it("classifies the consistent training data perfectly", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["accuracy"])).toBe(1);
        expect(final?.["correct"]).toBe(input.rows.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(input.attributes.length + 3);
        expect(generator.next().done).toBe(true);
    });
});
