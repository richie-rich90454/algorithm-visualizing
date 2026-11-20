import { describe, expect, it } from "vitest";
import mod from "./version-tree";

type Update = { key: string; value: number; parent?: number };
type Query = { version: number; key: string };

/** Independent oracle: keep a full Map snapshot for every version. */
function oracle(updates: Update[], queries: Query[]): Record<string, number | null> {
    const snapshots: Map<string, number>[] = [new Map()];
    for (let i = 1; i <= updates.length; i += 1) {
        const u = updates[i - 1];
        if (!u) continue;
        const requested = typeof u.parent === "number" ? Math.floor(u.parent) : 0;
        const parent = Math.max(0, Math.min(i - 1, requested));
        const copy = new Map(snapshots[parent] ?? new Map());
        copy.set(String(u.key), Number(u.value));
        snapshots[i] = copy;
    }
    const result: Record<string, number | null> = {};
    for (const q of queries) {
        const v = Math.max(0, Math.min(snapshots.length - 1, Math.floor(q.version)));
        const value = snapshots[v]?.get(q.key);
        result[`${q.version}:${q.key}`] = value === undefined ? null : value;
    }
    return result;
}

describe("version-tree", () => {
    it("matches full-snapshot oracle on branched histories", () => {
        const updates: Update[] = [
            { key: "a", value: 1 },
            { key: "b", value: 2, parent: 0 },
            { key: "a", value: 9, parent: 1 },
            { key: "c", value: 7, parent: 1 },
            { key: "b", value: 5, parent: 3 },
            { key: "a", value: 3, parent: 4 },
        ];
        const keys = ["a", "b", "c", "d"];
        const queries: Query[] = [];
        for (let v = 0; v <= updates.length; v += 1) {
            for (const key of keys) queries.push({ version: v, key });
        }
        const frames = Array.from(mod.run({ updates, queries }));
        const final = frames[frames.length - 1];
        expect(final?.meta["results"]).toEqual(oracle(updates, queries));
    });

    it("handles an empty update list", () => {
        const queries: Query[] = [{ version: 0, key: "x" }];
        const frames = Array.from(mod.run({ updates: [], queries }));
        expect(frames[frames.length - 1]?.meta["results"]).toEqual({ "0:x": null });
    });

    it("emits well-formed frames and terminates", () => {
        const frames = Array.from(mod.run(mod.defaultInput));
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.length).toBeLessThan(100);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("tree");
            expect(frame.meta).toBeDefined();
        });
    });
});
