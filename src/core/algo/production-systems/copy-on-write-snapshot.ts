/**
 * copy-on-write-snapshot.ts - Copy-on-Write Snapshots
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Copy-on-write lets many snapshots share the same physical pages until one of
 * them is modified. Each page carries a reference count. Taking a snapshot only
 * increments counts; writing a page with count above one first duplicates that
 * page, lowers the old count, and then writes the private copy. This module
 * replays a write and snapshot workload and reports the page table at every
 * step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P) per operation for P pages when a copy is needed
 *   Space: O(P * S) worst case for S snapshots over P pages
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per logical page shows its current value.
 *   - A page with more than one reference is BLUE (comparing/shared).
 *   - The page just written is GREEN (sorted); freshly copied pages are ACTIVE.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Operation =
    | { op: "snapshot"; label: string }
    | { op: "write"; page: number; value: number };

interface Input {
    initial?: number[];
    operations?: Operation[];
}

const DEFAULT_INPUT: Required<Input> = {
    initial: [10, 20, 30, 40],
    operations: [
        { op: "snapshot", label: "v1" },
        { op: "write", page: 1, value: 99 },
        { op: "write", page: 2, value: 88 },
        { op: "snapshot", label: "v2" },
        { op: "write", page: 1, value: 77 },
    ],
};

function makeCells(
    values: number[],
    states: Map<number, EntityState>,
    refs: number[],
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-page-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, page: index, refs: refs[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const raw = (input as Input | null) ?? {};
    const initial: number[] = raw.initial ?? DEFAULT_INPUT.initial;
    const operations: Operation[] = raw.operations ?? DEFAULT_INPUT.operations;
    const pageCount = initial.length;

    const physical = new Map<number, number>();
    const refcount = new Map<number, number>();
    const current: number[] = [];
    initial.forEach((value, index) => {
        physical.set(index, value);
        refcount.set(index, 1);
        current[index] = index;
    });
    let nextPhysicalId = initial.length;
    let copies = 0;
    const snapshots = new Map<string, number[]>();

    const currentValues = (): number[] => current.map((id) => physical.get(id) ?? 0);
    const currentRefs = (): number[] => current.map((id) => refcount.get(id) ?? 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(currentValues(), new Map(), currentRefs()),
        edges: [],
        description: `Initialized ${pageCount} page(s); all pages are private with one reference each.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: pageCount, snapshots: 0, copies, pages: pageCount },
    };
    step += 1;

    for (const operation of operations) {
        const states = new Map<number, EntityState>();
        let message: string;
        if (operation.op === "snapshot") {
            for (const id of current) {
                refcount.set(id, (refcount.get(id) ?? 0) + 1);
            }
            snapshots.set(operation.label, [...current]);
            message = `Snapshot ${operation.label} shares all ${pageCount} page(s); reference counts increased by one.`;
        } else {
            const page = operation.page;
            if (page < 0 || page >= pageCount) {
                continue;
            }
            const oldId = current[page];
            if ((refcount.get(oldId ?? -1) ?? 0) > 1) {
                refcount.set(oldId ?? -1, (refcount.get(oldId ?? -1) ?? 0) - 1);
                physical.set(nextPhysicalId, operation.value);
                refcount.set(nextPhysicalId, 1);
                current[page] = nextPhysicalId;
                nextPhysicalId += 1;
                copies += 1;
                states.set(page, "active");
                message = `Write to page ${page} copied it to a new physical page before changing its value to ${operation.value}.`;
            } else {
                physical.set(oldId ?? -1, operation.value);
                states.set(page, "sorted");
                message = `Write to page ${page} updated its private page in place to ${operation.value}.`;
            }
        }
        currentRefs().forEach((refs, index) => {
            if (!states.has(index) && refs > 1) {
                states.set(index, "comparing");
            }
        });
        yield {
            stepNumber: step,
            entities: makeCells(currentValues(), states, currentRefs()),
            edges: [],
            description: message,
            codeLineNumber: operation.op === "snapshot" ? 1 : 3,
            layout: "grid",
            meta: {
                rows: 1,
                cols: pageCount,
                snapshots: snapshots.size,
                copies,
                physicalPages: physical.size,
                operation: operation.op,
            },
        };
        step += 1;
    }

    const snapshotValues: Record<string, number[]> = {};
    for (const [label, pageIds] of snapshots) {
        snapshotValues[label] = pageIds.map((id) => physical.get(id) ?? 0);
    }
    yield {
        stepNumber: step,
        entities: makeCells(currentValues(), new Map(), currentRefs()),
        edges: [],
        description: `Workload complete: ${snapshots.size} snapshot(s), ${copies} page copy/copies, ${physical.size} physical page(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 1,
            cols: pageCount,
            snapshots: snapshots.size,
            copies,
            physicalPages: physical.size,
            currentValues: currentValues(),
            snapshotLabels: Object.keys(snapshotValues),
            snapshotFlat: Object.values(snapshotValues).flat(),
            totalRefs: [...refcount.values()].reduce((sum, value) => sum + value, 0),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A snapshot normally costs a full copy of the data, which is wasteful if nothing changes. Copy-on-write postpones the copy: snapshots keep pointing at the same pages, and only a page that is about to be written is duplicated first. Read-heavy workloads therefore share almost everything.",
        invariants: [
            "A page with reference count above one is never modified in place.",
            "Copying a shared page decrements the old reference count and creates a private copy with count one.",
            "Every snapshot keeps a stable view of the values as of its creation.",
        ],
        correctness:
            "A snapshot stores the physical page ids in use at that moment and increments their counts, so later writes cannot alter those ids without first duplicating them. By induction over the operation sequence, each snapshot continues to resolve to its original values, while the live view reflects all writes. The sum of reference counts equals one live reference plus one per snapshot for every logical page.",
        complexityRationale:
            "A snapshot touches all P page counts, and a write touches one page, so each operation is O(P) in the worst case when a copy is made. Storage grows only by the number of pages actually copied, at most one per write.",
        uses: [
            "Filesystem snapshots such as Btrfs and ZFS",
            "Persistent data structures and in-memory database forks",
            "Virtual machine memory deduplication",
        ],
        references: [
            "Ousterhout et al., The Design and Implementation of the Sun Network Filesystem, 1985",
            "Okasaki, Purely Functional Data Structures, Chapter 2, 1998",
        ],
        workedExample:
            "Starting from pages [10, 20, 30], taking snapshot v1 gives all pages two references. Writing page 1 with value 99 copies that page, decrements its old count to one, and leaves v1 seeing 20 while the live view sees 99.",
    },
    id: "copy-on-write-snapshot",
    name: "Copy-on-Write Snapshot",
    category: "production-systems",
    complexity: { time: "O(P) per operation", space: "O(P * S) worst case" },
    defaultInput: DEFAULT_INPUT,
    visualType: "grid",
    run,
    pseudocode: [
        "give each initial page a physical id and one reference",
        "on snapshot increment references for every current page",
        "on write to a page with count above one copy it first",
        "decrement the old page count and write the private copy",
        "on write to a unique page change the value in place",
        "report snapshot views, copy count and reference totals",
    ],
};

export default module;
