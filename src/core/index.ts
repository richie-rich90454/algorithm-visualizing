/**
 * index.ts – The algorithm registry.
 *
 * The registry is a central lookup table that maps kebab-case algorithm ids
 * (e.g. `"bubble-sort"`) to their `AlgorithmModule` objects. The sidebar
 * builds its category tree from `getAllAlgorithms()`, and the store resolves
 * a selected id with `getAlgorithm()`.
 *
 * Every algorithm file registers itself here, so this file grows exactly in
 * lockstep with the algorithm library. Keeping registration explicit (rather
 * than glob-importing the folder) keeps the module graph obvious and lets the
 * TypeScript compiler verify every reference at build time.
 */

import type { AlgorithmModule } from "@/types";

// ----------------------------------------------------------------------
// Algorithm registrations.
//
// Every algorithm module registers itself here with a single import + call,
// so the registry grows exactly in lockstep with the algorithm library.
// ----------------------------------------------------------------------

import bubbleSort from "./algo/sort/bubble-sort";
import bucketSort from "./algo/sort/bucket-sort";
import cocktailShakerSort from "./algo/sort/cocktail-shaker-sort";
import combSort from "./algo/sort/comb-sort";
import countingSort from "./algo/sort/counting-sort";
import heapSort from "./algo/sort/heap-sort";
import insertionSort from "./algo/sort/insertion-sort";
import introsort from "./algo/sort/introsort";
import mergeSortBottomUp from "./algo/sort/merge-sort-bottom-up";
import mergeSortTopDown from "./algo/sort/merge-sort-top-down";
import monkeySort from "./algo/sort/monkey-sort";
import patienceSort from "./algo/sort/patience-sort";
import quickSort3Way from "./algo/sort/quick-sort-3-way";
import quickSortHoare from "./algo/sort/quick-sort-hoare";
import quickSortLomuto from "./algo/sort/quick-sort-lomuto";
import radixSortLsd from "./algo/sort/radix-sort-lsd";
import radixSortMsd from "./algo/sort/radix-sort-msd";
import selectionSort from "./algo/sort/selection-sort";
import shellSort from "./algo/sort/shell-sort";
import smoothSort from "./algo/sort/smooth-sort";
import timSort from "./algo/sort/tim-sort";
import linearSearch from "./algo/search/linear-search";
import binarySearchIterative from "./algo/search/binary-search-iterative";
import binarySearchLowerBound from "./algo/search/binary-search-lower-bound";
import binarySearchRecursive from "./algo/search/binary-search-recursive";
import binarySearchUpperBound from "./algo/search/binary-search-upper-bound";
import exponentialSearch from "./algo/search/exponential-search";
import interpolationSearch from "./algo/search/interpolation-search";
import jumpSearch from "./algo/search/jump-search";
import ternarySearch from "./algo/search/ternary-search";
import bfs from "./algo/graph/bfs";
import bidirectionalBfs from "./algo/graph/bidirectional-bfs";
import dfsIterative from "./algo/graph/dfs-iterative";
import dfsRecursive from "./algo/graph/dfs-recursive";
import floodFillBfs from "./algo/graph/flood-fill-bfs";
import floodFillDfs from "./algo/graph/flood-fill-dfs";
import gabowScc from "./algo/graph/gabow-scc";
import hierholzerEulerian from "./algo/graph/hierholzer-eulerian";
import hopcroftKarp from "./algo/flow/hopcroft-karp";
import hungarian from "./algo/flow/hungarian";
import kosarajuScc from "./algo/graph/kosaraju-scc";
import aStar from "./algo/path/a-star";
import bellmanFord from "./algo/path/bellman-ford";
import blossom from "./algo/flow/blossom";
import dijkstraFibonacci from "./algo/path/dijkstra-fibonacci";
import dijkstraHeap from "./algo/path/dijkstra-heap";
import dijkstraMatrix from "./algo/path/dijkstra-matrix";
import floydWarshall from "./algo/path/floyd-warshall";
import johnson from "./algo/path/johnson";
import karpMinimumMeanCycle from "./algo/path/karp-minimum-mean-cycle";
import shortestPathDag from "./algo/path/shortest-path-dag";
import spfa from "./algo/path/spfa";
import kruskal from "./algo/mst/kruskal";
import treeCenter from "./algo/tree/tree-center";
import treeDiameter from "./algo/tree/tree-diameter";
import treeEulerTour from "./algo/tree/tree-euler-tour";
import treeIsomorphism from "./algo/tree/tree-isomorphism";
import lcaBinaryLifting from "./algo/tree/lca-binary-lifting";
import lcaEulerSparse from "./algo/tree/lca-euler-sparse";
import lcaTarjanOffline from "./algo/tree/lca-tarjan-offline";
import centroidDecomposition from "./algo/tree/centroid-decomposition";
import heavyLightDecomposition from "./algo/tree/heavy-light-decomposition";
import rerootingDp from "./algo/tree/rerooting-dp";
import knuthMorrisPratt from "./algo/string/knuth-morris-pratt";
import zAlgorithm from "./algo/string/z-algorithm";
import rabinKarpSingle from "./algo/string/rabin-karp-single";
import rabinKarpDouble from "./algo/string/rabin-karp-double";
import manacher from "./algo/string/manacher";
import suffixArrayDoubling from "./algo/string/suffix-array-doubling";
import suffixArrayDc3 from "./algo/string/suffix-array-dc3";
import lcpKasai from "./algo/string/lcp-kasai";
import suffixAutomaton from "./algo/string/suffix-automaton";
import suffixTreeUkkonen from "./algo/string/suffix-tree-ukkonen";
import boruvka from "./algo/mst/boruvka";
import primHeap from "./algo/mst/prim-heap";
import primMatrix from "./algo/mst/prim-matrix";
import secondBestMst from "./algo/mst/second-best-mst";
import fordFulkerson from "./algo/flow/ford-fulkerson";
import edmondsKarp from "./algo/flow/edmonds-karp";
import minCut from "./algo/flow/min-cut";
import minCostMaxFlow from "./algo/flow/min-cost-max-flow";
import boykovKolmogorov from "./algo/flow/boykov-kolmogorov";
import costScaling from "./algo/flow/cost-scaling";
import dinic from "./algo/flow/dinic";
import pushRelabel from "./algo/flow/push-relabel";
import lexicographicBfs from "./algo/graph/lexicographic-bfs";
import tarjanArticulationPoints from "./algo/graph/tarjan-articulation-points";
import tarjanBridges from "./algo/graph/tarjan-bridges";
import tarjanScc from "./algo/graph/tarjan-scc";
import topologicalSortDfs from "./algo/graph/topological-sort-dfs";
import topologicalSortKahn from "./algo/graph/topological-sort-kahn";
register(binarySearchIterative);
register(binarySearchLowerBound);
register(binarySearchRecursive);
register(binarySearchUpperBound);
register(bfs);
register(bidirectionalBfs);
register(dfsIterative);
register(dfsRecursive);
register(aStar);
register(bellmanFord);
register(blossom);
register(dijkstraFibonacci);
register(dijkstraHeap);
register(dijkstraMatrix);
register(floydWarshall);
register(johnson);
register(karpMinimumMeanCycle);
register(kruskal);
register(boruvka);
register(primHeap);
register(primMatrix);
register(secondBestMst);
register(fordFulkerson);
register(edmondsKarp);
register(minCut);
register(minCostMaxFlow);
register(boykovKolmogorov);
register(costScaling);
register(dinic);
register(pushRelabel);
register(shortestPathDag);
register(spfa);
register(treeCenter);
register(treeDiameter);
register(treeEulerTour);
register(treeIsomorphism);
register(lcaBinaryLifting);
register(lcaEulerSparse);
register(lcaTarjanOffline);
register(centroidDecomposition);
register(heavyLightDecomposition);
register(rerootingDp);
register(knuthMorrisPratt);
register(zAlgorithm);
register(rabinKarpSingle);
register(rabinKarpDouble);
register(manacher);
register(suffixArrayDoubling);
register(suffixArrayDc3);
register(lcpKasai);
register(suffixAutomaton);
register(suffixTreeUkkonen);
register(exponentialSearch);
register(floodFillBfs);
register(floodFillDfs);
register(gabowScc);
register(hierholzerEulerian);
register(hopcroftKarp);
register(hungarian);
register(kosarajuScc);
register(lexicographicBfs);
register(tarjanArticulationPoints);
register(tarjanBridges);
register(tarjanScc);
register(topologicalSortDfs);
register(topologicalSortKahn);
register(interpolationSearch);
register(jumpSearch);
register(ternarySearch);
register(bubbleSort);
register(bucketSort);
register(cocktailShakerSort);
register(combSort);
register(countingSort);
register(heapSort);
register(insertionSort);
register(introsort);
register(mergeSortBottomUp);
register(mergeSortTopDown);
register(monkeySort);
register(patienceSort);
register(quickSort3Way);
register(quickSortHoare);
register(quickSortLomuto);
register(radixSortLsd);
register(radixSortMsd);
register(selectionSort);
register(shellSort);
register(smoothSort);
register(timSort);
register(linearSearch);

/** The one source of truth: id → module. */
const registry = new Map<string, AlgorithmModule>();

/**
 * Insert a module into the registry.
 *
 * @param module The algorithm module to register.
 * @throws When an algorithm with the same id is already registered, so that
 *         duplicate ids are caught at load time rather than silently shadowed.
 */
export function register(module: AlgorithmModule): void {
    if (registry.has(module.id)) {
        throw new Error(`Duplicate algorithm id: ${module.id}`);
    }
    registry.set(module.id, module);
}

/**
 * Look up an algorithm by its kebab-case id.
 *
 * @param id The algorithm identifier, e.g. `"binary-search"`.
 * @returns The matching module, or `null` when unknown.
 */
export function getAlgorithm(id: string): AlgorithmModule | null {
    return registry.get(id) ?? null;
}

/**
 * @returns Every registered algorithm module, in registration order.
 */
export function getAllAlgorithms(): AlgorithmModule[] {
    return [...registry.values()];
}
