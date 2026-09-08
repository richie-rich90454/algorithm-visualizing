/**
 * consistent-hashing.ts – Consistent Hashing.
 * Three nodes × 2 virtual nodes share ring 0..99; five keys land on
 * their clockwise successor. Removing N1 re-homes only its own keys —
 * the minimal disruption that makes the ring famous.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function hash32(s: string): number {
    let h = 2166136261;
    for (const ch of s) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 100;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { nodes?: string[]; keys?: string[]; drop?: string } | null) ?? {};
    const nodes =
        Array.isArray(cfg.nodes) && cfg.nodes.length > 0
            ? (cfg.nodes as string[])
            : ["N0", "N1", "N2"];
    const keys =
        Array.isArray(cfg.keys) && cfg.keys.length > 0
            ? (cfg.keys as string[])
            : ["a", "b", "c", "d", "e"];
    const drop = typeof cfg.drop === "string" ? cfg.drop : "N1";
    const ring = (alive: string[]): Array<[number, string]> =>
        alive
            .flatMap((n) => [0, 1].map((v) => [hash32(`${n}#${v}`), n] as [number, string]))
            .sort((a, b) => a[0] - b[0]);
    const owner = (key: string, r: Array<[number, string]>): string => {
        const h = hash32(key);
        const hit = r.find(([pos]) => pos >= h);
        return (hit ?? r[0] ?? [0, "?"])[1];
    };
    let step = 0;
    const frame = (
        assign: Map<string, string>,
        desc: string,
        line: number,
        moved: Set<string>,
    ): VisualFrame => {
        const entities: VisualEntity[] = keys.map((k, i) => ({
            id: `key-${k}`,
            type: "cell" as const,
            label: `${k}→${assign.get(k) ?? "?"}`,
            value: assign.get(k) ?? "?",
            state: (moved.has(k) ? "swapped" : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: { moved: moved.size },
        };
    };
    const full = ring(nodes);
    const before = new Map(keys.map((k) => [k, owner(k, full)]));
    yield frame(
        before,
        `Virtual ring 0..99: ${full.map(([pos, n]) => `${n}@${pos}`).join(" ")}.`,
        0,
        new Set(),
    );
    step += 1;
    yield frame(
        before,
        `Keys hash on ([${keys.map((k) => `${k}@${hash32(k)}`).join(" ")}]) and walk clockwise to an owner.`,
        1,
        new Set(),
    );
    step += 1;
    const alive = nodes.filter((n) => n !== drop);
    if (alive.length === 0) {
        yield frame(before, "Cannot drop the last node — assignment unchanged.", 1, new Set());
        return;
    }
    const slim = ring(alive);
    const after = new Map(keys.map((k) => [k, owner(k, slim)]));
    const moved = new Set(keys.filter((k) => before.get(k) !== after.get(k)));
    yield frame(
        after,
        `Ownership table: ${keys.map((k) => `${k}:${before.get(k)}→${after.get(k)}`).join(" ")}.`,
        2,
        moved,
    );
    step += 1;
    yield frame(
        after,
        `Dropped ${drop}: only {${[...moved].join(", ") || "none"}} moved (${moved.size}/${keys.length} keys).`,
        1,
        moved,
    );
    step += 1;
    yield frame(
        after,
        `Stable again: survivors kept their keys; only ${drop}'s share was re-homed.`,
        2,
        moved,
    );
}

const module: AlgorithmModule = {
    id: "consistent-hashing",
    name: "Consistent Hashing",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n·v)" },
    defaultInput: { nodes: ["N0", "N1", "N2"], keys: ["a", "b", "c", "d", "e"], drop: "N1" },
    visualType: "grid",
    run,
};

export default module;
