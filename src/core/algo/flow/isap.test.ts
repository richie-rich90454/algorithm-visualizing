import { describe, expect, it } from "vitest";
import mod from "./isap";

type Edge = [string, string, number];

/** Independent Edmonds-Karp reference (BFS shortest augmenting paths). */
function bruteMaxFlow(vertices: string[], edges: Edge[], source: string, sink: string): number {
    const cap = new Map<string, number>();
    for (const [u, v, c] of edges) {
        cap.set(`${u}->${v}`, (cap.get(`${u}->${v}`) ?? 0) + c);
        if (!cap.has(`${v}->${u}`)) {
            cap.set(`${v}->${u}`, 0);
        }
    }
    let flow = 0;
    for (let guard = 0; guard < 10000; guard += 1) {
        const parent = new Map<string, string>();
        const seen = new Set<string>([source]);
        const queue = [source];
        for (let head = 0; head < queue.length && !seen.has(sink); head += 1) {
            const u = queue[head] as string;
            for (const v of vertices) {
                if (seen.has(v) || (cap.get(`${u}->${v}`) ?? 0) <= 0) {
                    continue;
                }
                seen.add(v);
                parent.set(v, u);
                queue.push(v);
            }
        }
        if (!seen.has(sink)) {
            break;
        }
        let bottleneck = Infinity;
        let cursor = sink;
        while (cursor !== source) {
            const prev = parent.get(cursor) as string;
            bottleneck = Math.min(bottleneck, cap.get(`${prev}->${cursor}`) ?? 0);
            cursor = prev;
        }
        cursor = sink;
        while (cursor !== source) {
            const prev = parent.get(cursor) as string;
            cap.set(`${prev}->${cursor}`, (cap.get(`${prev}->${cursor}`) ?? 0) - bottleneck);
            cap.set(`${cursor}->${prev}`, (cap.get(`${cursor}->${prev}`) ?? 0) + bottleneck);
            cursor = prev;
        }
        flow += bottleneck;
    }
    return flow;
}

/** Deterministic linear-congruential generator for reproducible random graphs. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function framesFor(input: unknown) {
    return [...mod.run(input)];
}

describe("Isap", () => {
    it("matches an independent Edmonds-Karp reference on random networks", () => {
        const rand = makeRandom(20261119);
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 3 + Math.floor(rand() * 4);
            const vertices = Array.from({ length: n }, (_, i) => `V${i}`);
            const edges: Edge[] = [];
            const edgeCount = n + Math.floor(rand() * (n * 2));
            for (let i = 0; i < edgeCount; i += 1) {
                const u = Math.floor(rand() * n);
                let v = Math.floor(rand() * n);
                if (v === u) {
                    v = (v + 1) % n;
                }
                edges.push([`V${u}`, `V${v}`, 1 + Math.floor(rand() * 6)]);
            }
            const input = { vertices, edges, source: "V0", sink: `V${n - 1}` };
            const frames = framesFor(input);
            const last = frames[frames.length - 1];
            expect(last?.meta.maxFlow, `trial ${trial}`).toBe(
                bruteMaxFlow(vertices, edges, "V0", `V${n - 1}`),
            );
            expect(last?.meta.flow).toBe(last?.meta.maxFlow);
        }
    });

    it("emits well-formed graph frames with sequential step numbers", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("graph");
            expect(frame.entities.length).toBe(4);
            expect(frame.edges.length).toBe(5);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect((mod.pseudocode ?? []).length).toBeGreaterThan(frame.codeLineNumber ?? 0);
            expect(typeof frame.meta.flow).toBe("number");
            for (const entity of frame.entities) {
                expect(entity.type).toBe("node");
            }
        });
    });

    it("terminates cleanly when source and sink coincide", () => {
        const generator = mod.run({
            vertices: ["S"],
            edges: [],
            source: "S",
            sink: "S",
        });
        let count = 0;
        let result = generator.next();
        while (!result.done) {
            count += 1;
            result = generator.next();
        }
        expect(count).toBe(1);
    });
});
