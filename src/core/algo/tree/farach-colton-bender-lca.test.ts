import { describe, expect, it } from "vitest";
import mod from "./farach-colton-bender-lca";
import type { VisualFrame } from "@/types";

type Input = { parentMap: Record<string, string | null>; ids: string[]; queries: Array<[string, string]> };

function naiveLca(parentMap: Record<string, string | null>, a: string, b: string): string {
    const ancestors = new Set<string>();
    let cur: string | null = a;
    while (cur) {
        ancestors.add(cur);
        cur = parentMap[cur] ?? null;
    }
    cur = b;
    while (cur) {
        if (ancestors.has(cur)) {
            return cur;
        }
        cur = parentMap[cur] ?? null;
    }
    return "";
}

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Farach-Colton-Bender LCA", () => {
    it("answers all pairs correctly on the default tree", () => {
        const input = mod.defaultInput as Input;
        const ids = input.ids;
        const queries: Array<[string, string]> = [];
        for (const a of ids) {
            for (const b of ids) {
                queries.push([a, b]);
            }
        }
        const frames = [...mod.run({ ...input, queries })];
        checkFrames(frames, ids.length);
        const answers = (frames[frames.length - 1]?.meta["answers"] as string[]) ?? [];
        expect(answers).toHaveLength(queries.length);
        queries.forEach(([a, b], i) => {
            expect(answers[i]).toBe(naiveLca(input.parentMap, a, b));
        });
    });

    it("matches a naive LCA on random trees", () => {
        for (let trial = 0; trial < 6; trial += 1) {
            const ids = Array.from({ length: 2 + trial }, (_, i) => `n${i}`);
            const parentMap: Record<string, string | null> = {};
            parentMap[ids[0] as string] = null;
            for (let i = 1; i < ids.length; i += 1) {
                parentMap[ids[i] as string] = ids[Math.floor(Math.random() * i)] as string;
            }
            const queries: Array<[string, string]> = [];
            for (const a of ids) {
                for (const b of ids) {
                    queries.push([a, b]);
                }
            }
            const frames = [...mod.run({ ids, parentMap, queries })];
            const answers = (frames[frames.length - 1]?.meta["answers"] as string[]) ?? [];
            queries.forEach(([a, b], i) => {
                expect(answers[i]).toBe(naiveLca(parentMap, a, b));
            });
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
