/**
 * persistent-array.ts – Persistent Array (Fat Nodes)
 *
 * Fully persistent random access: each slot keeps every versioned value
 * it ever held, so reading version v means scanning back to the newest
 * write at or before v.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-note",
                  type: "cell" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { row: 0, col: 0 },
              },
          ];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            size?: number;
            writes?: Array<[number, number, number]>;
            read?: [number, number];
        } | null) ?? {};
    const size = task.size ?? 3;
    const writes = task.writes ?? [
        [0, 0, 7],
        [1, 1, 9],
    ];
    const read = task.read ?? [1, 0];
    let step = 0;

    const slots: Array<Array<[number, number]>> = Array.from({ length: size }, () => []);
    const readAt = (slot: number, ver: number): number => {
        const hist = slots[slot] ?? [];
        let ans = 0;
        for (const [v, val] of hist) {
            if (v <= ver) {
                ans = val;
            }
        }
        return ans;
    };
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        slots.forEach((hist, s) => {
            hist.forEach(([v, val], hi) => {
                entities.push({
                    id: `pa-${s}-${hi}`,
                    type: "cell" as const,
                    label: `v${v}:${val}`,
                    value: val,
                    state: (hot.has(`${s}:${hi}`) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: s, col: hi },
                });
            });
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { slots: size, versions: writes.length },
        };
    };

    yield snap(new Set(), `Persistent array of ${size} fat slots – all read 0.`, 0);
    step += 1;
    writes.forEach(([ver, slot, val], wi) => {
        (slots[slot] ?? []).push([ver, val]);
    });
    for (let wi = 0; wi < writes.length; wi += 1) {
        const [ver, slot, val] = writes[wi] ?? [0, 0, 0];
        yield snap(
            new Set([`${slot}:${(slots[slot] ?? []).length - 1}`]),
            `Version ${ver}: slot ${slot} records ${val}.`,
            1,
        );
        step += 1;
    }
    const [rv, rs] = read;
    const answer = readAt(rs, rv);
    yield snap(
        new Set(),
        `Read slot ${rs} at version ${rv} – newest write at or before is ${answer}.`,
        2,
    );
}

const module: AlgorithmModule = {
    id: "persistent-array",
    name: "Persistent Array",
    category: "data-structures",
    complexity: { time: "O(log versions) read", space: "O(writes)" },
    defaultInput: {
        size: 3,
        writes: [
            [0, 0, 7],
            [1, 1, 9],
        ],
        read: [1, 0],
    },
    visualType: "grid",
    run,
};

export default module;
