import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./ac6-arc-consistency";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("cell");
    });
}

function domainsOf(frame: VisualFrame): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    for (const entity of frame.entities) {
        const name = String(entity.metadata.variable);
        const raw = String(entity.metadata.domain);
        result[name] = raw === "" ? [] : raw.split(",").map(Number);
    }
    return result;
}

function bruteForce(
    domains: Record<string, number[]>,
    constraints: Array<[string, string]>,
): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    for (const [key, values] of Object.entries(domains)) result[key] = [...values];
    let changed = true;
    while (changed) {
        changed = false;
        for (const [u, v] of constraints) {
            for (const [xi, xj] of [
                [u, v],
                [v, u],
            ]) {
                const kept = (result[xi] ?? []).filter((a) => (result[xj] ?? []).some((b) => b !== a));
                if (kept.length !== (result[xi] ?? []).length) {
                    result[xi] = kept;
                    changed = true;
                    if (kept.length === 0) return result;
                }
            }
        }
    }
    return result;
}

describe("AC-6 Arc Consistency", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(500);
    });

    it("matches a brute-force arc-consistency fixpoint", () => {
        let seed = 556677;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 100; trial += 1) {
            const makeDomain = (): number[] => {
                const values = new Set<number>();
                const count = 1 + (next() % 3);
                for (let i = 0; i < count; i += 1) values.add(1 + (next() % 4));
                return [...values];
            };
            const domains: Record<string, number[]> = { X: makeDomain(), Y: makeDomain(), Z: makeDomain() };
            const frames = collect({ domains });
            checkFrames(frames);
            const expected = bruteForce(domains, [
                ["X", "Y"],
                ["Y", "Z"],
            ]);
            const actual = domainsOf(frames[frames.length - 1] as VisualFrame);
            expect(actual).toEqual(expected);
            for (const frame of frames) {
                const current = domainsOf(frame);
                for (const variable of Object.keys(domains)) {
                    for (const value of current[variable] ?? []) {
                        expect(domains[variable]).toContain(value);
                    }
                }
            }
        }
    });

    it("detects unsatisfiable domains", () => {
        const frames = collect({
            domains: { X: [1], Y: [1], Z: [1] },
            constraints: [
                ["X", "Y"],
                ["Y", "Z"],
            ],
        });
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(last.description.toLowerCase()).toContain("unsatisfiable");
    });
});
