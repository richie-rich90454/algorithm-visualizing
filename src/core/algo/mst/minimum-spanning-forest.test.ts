import { describe, expect, it } from "vitest";
import mod from "./minimum-spanning-forest";

type E = [string, string, number];
type Input = { vertices: string[]; edges: E[] };

function components(vertices: string[], edges: E[]): string[][] {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
        const p = parent.get(x) ?? x;
        if (p !== x) {
            const r = find(p);
            parent.set(x, r);
            return r;
        }
        return x;
    };
    for (const v of vertices) {
        parent.set(v, v);
    }
    for (const [a, b] of edges) {
        parent.set(find(a), find(b));
    }
    const groups = new Map<string, string[]>();
    for (const v of vertices) {
        const r = find(v);
        if (!groups.has(r)) {
            groups.set(r, []);
        }
        (groups.get(r) as string[]).push(v);
    }
    return [...groups.values()];
}

/** True brute force: try every edge subset of the right size. */
function bruteForestWeight(input: Input): number {
    const groups = components(input.vertices, input.edges);
    const need = input.vertices.length - groups.length;
    const edges = input.edges;
    let best = Infinity;
    for (let mask = 0; mask < 1 << edges.length; mask += 1) {
        let count = 0;
        for (let i = 0; i < edges.length; i += 1) {
            if (mask & (1 << i)) {
                count += 1;
            }
        }
        if (count !== need) {
            continue;
        }
        const parent = new Map<string, string>();
        const find = (x: string): string => {
            const p = parent.get(x) ?? x;
            if (p !== x) {
                const r = find(p);
                parent.set(x, r);
                return r;
            }
            return x;
        };
        for (const v of input.vertices) {
            parent.set(v, v);
        }
        let cyclic = false;
        let weight = 0;
        for (let i = 0; i < edges.length && !cyclic; i += 1) {
            if (!(mask & (1 << i))) {
                continue;
            }
            const [a, b, w] = edges[i] as E;
            if (find(a) === find(b)) {
                cyclic = true;
            } else {
                parent.set(find(a), find(b));
                weight += w;
            }
        }
        if (cyclic) {
            continue;
        }
        let spanning = true;
        for (const group of groups) {
            const root = find(group[0] as string);
            for (const v of group) {
                if (find(v) !== root) {
                    spanning = false;
                }
            }
        }
        if (spanning) {
            best = Math.min(best, weight);
        }
    }
    return best;
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Minimum Spanning Forest", () => {
    it("matches true brute force on the disconnected default graph", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const expected = bruteForestWeight(input);
        expect(Number.isFinite(expected)).toBe(true);
        expect(frames[frames.length - 1]?.meta.totalWeight).toBe(expected);
        expect(frames[frames.length - 1]?.meta.components).toBe(components(input.vertices, input.edges).length);
    });

    it("agrees with brute force on random disconnected graphs", () => {
        const random = seeded(90210);
        for (let trial = 0; trial < 30; trial += 1) {
            const left = ["A", "B", "C"];
            const right = ["D", "E"];
            const vertices = [...left, ...right];
            const edges: E[] = [];
            const add = (a: string, b: string): void => {
                edges.push([a, b, 1 + Math.floor(random() * 9)]);
            };
            add("A", "B");
            if (random() < 0.7) {
                add("B", "C");
            }
            if (random() < 0.5) {
                add("A", "C");
            }
            add("D", "E");
            if (random() < 0.5) {
                add("A", "E");
            }
            if (random() < 0.4) {
                add("C", "D");
            }
            const input = { vertices, edges };
            const frames = [...mod.run(input)];
            const expected = bruteForestWeight(input);
            expect(frames[frames.length - 1]?.meta.totalWeight, `trial ${trial}`).toBe(expected);
        }
    });

    it("the final forest is acyclic and spans every component", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        const chosen = (last?.edges ?? [])
            .filter((e) => e.state === "sorted")
            .map((e) => input.edges[Number((e.id as string).split("-")[1])] as E);
        const groups = components(input.vertices, input.edges);
        expect(chosen).toHaveLength(input.vertices.length - groups.length);

        const parent = new Map<string, string>();
        const find = (x: string): string => {
            const p = parent.get(x) ?? x;
            if (p !== x) {
                const r = find(p);
                parent.set(x, r);
                return r;
            }
            return x;
        };
        for (const v of input.vertices) {
            parent.set(v, v);
        }
        for (const [a, b] of chosen) {
            expect(find(a)).not.toBe(find(b));
            parent.set(find(a), find(b));
        }
        for (const group of groups) {
            const root = find(group[0] as string);
            for (const v of group) {
                expect(find(v)).toBe(root);
            }
        }
        expect(chosen.reduce((sum, e) => sum + e[2], 0)).toBe(last?.meta.totalWeight);
        expect(last?.meta.componentSizes).toEqual(groups.map((g) => g.length).sort((a, b) => a - b));
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        expect(frames).toHaveLength(input.edges.length + 2);
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("graph");
            expect(typeof frame.meta.totalWeight).toBe("number");
            expect(typeof frame.meta.components).toBe("number");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const e of frame.entities) {
                expect(typeof e.id).toBe("string");
                expect(typeof e.label).toBe("string");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
                expect(Number.isFinite(e.width)).toBe(true);
                expect(Number.isFinite(e.height)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });

    it("handles an empty graph without throwing", () => {
        const frames = [...mod.run({ vertices: [], edges: [] })];
        expect(frames).toHaveLength(1);
        expect(frames[0]?.entities.length).toBe(0);
        expect(frames[0]?.description.length).toBeGreaterThanOrEqual(10);
    });
});
