import {
  GRID_SIZE,
  key,
  parseKey,
  projectAll,
  ViewMask,
  ViewName,
} from "./voxel";

// 隨機產生「腳踏實地」形狀（每個方塊都有從 y=0 連續往上的支撐）。
// difficulty 1-10：方塊數、垂直延伸範圍都會隨難度增加。

export type GeneratedPuzzle = {
  voxels: [number, number, number][];
  views: Record<ViewName, ViewMask>;
  difficulty: number;
  cubeCount: number;
};

export function generatePuzzle(difficulty: number): GeneratedPuzzle {
  const d = Math.max(1, Math.min(10, Math.floor(difficulty)));

  // Cube count by difficulty:
  //   d=1 → 3, d=2 → 3-4, d=5 → 5-6, d=8 → 6-7, d=10 → 7-9
  const minCubes = 2 + Math.ceil(d * 0.5);
  const maxCubes = 3 + Math.ceil(d * 0.6);
  const cubeCount =
    minCubes + Math.floor(Math.random() * (maxCubes - minCubes + 1));

  // 垂直限制：低難度只給平面、中難度允許 y=1、高難度允許 y=2
  const maxY = d <= 3 ? 0 : d <= 6 ? 1 : 2;

  const voxels = new Set<string>();

  // 第一個方塊隨機放地板
  const x0 = Math.floor(Math.random() * GRID_SIZE);
  const z0 = Math.floor(Math.random() * GRID_SIZE);
  voxels.add(key(x0, 0, z0));

  // 之後依「可放置位置」隨機長
  while (voxels.size < cubeCount) {
    const placeable = computePlaceable(voxels, maxY);
    if (placeable.length === 0) break;
    const pick = placeable[Math.floor(Math.random() * placeable.length)];
    voxels.add(pick);
  }

  const voxelArr: [number, number, number][] = Array.from(voxels, (k) => {
    const [x, y, z] = parseKey(k);
    return [x, y, z];
  });
  return {
    voxels: voxelArr,
    views: projectAll(voxels),
    difficulty: d,
    cubeCount: voxelArr.length,
  };
}

function computePlaceable(voxels: Set<string>, maxY: number): string[] {
  const set = new Set<string>();
  // 地板 9 格
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const k = key(x, 0, z);
      if (!voxels.has(k)) set.add(k);
    }
  }
  // 各 column 頂端往上一格（不超過 maxY）
  const maxYByColumn = new Map<string, number>();
  for (const k of voxels) {
    const [x, y, z] = parseKey(k);
    const col = `${x},${z}`;
    const prev = maxYByColumn.get(col) ?? -1;
    if (y > prev) maxYByColumn.set(col, y);
  }
  for (const [col, my] of maxYByColumn) {
    if (my + 1 > maxY) continue;
    const [x, z] = col.split(",").map(Number);
    const k = key(x, my + 1, z);
    if (!voxels.has(k)) set.add(k);
  }
  return Array.from(set);
}
