// Voxel grid lives in [0, GRID_SIZE) on each axis.
// Coordinate convention (right-handed, matches Three.js camera at +Z looking at origin):
//   x: 左右   (右為 +)
//   y: 上下   (上為 +)
//   z: 前後   (前/近 viewer 為 +)
//
// 三視圖投影：
//   front  正視圖 — 沿 -z 觀察，看到 (x, y) 平面（畫面左右=x，畫面上下=y）
//   top    俯視圖 — 沿 -y 觀察，看到 (x, z) 平面（畫面左右=x，畫面上下=z；z 越大越靠近觀察者，畫在下方）
//   side   側視圖（右側）— 沿 -x 觀察，看到 (z, y) 平面（畫面左右=z，z 越大越靠左；畫面上下=y）

export const GRID_SIZE = 3;

export type Voxels = Set<string>;

export const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export const parseKey = (k: string): [number, number, number] => {
  const [x, y, z] = k.split(",").map(Number);
  return [x, y, z];
};

export const inBounds = (x: number, y: number, z: number) =>
  x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE && z >= 0 && z < GRID_SIZE;

export type ViewName = "front" | "top" | "side";

// 2D mask: mask[row][col] === true 表示該格被填充。
// row 對應「畫面上下」（row 0 = 上方），col 對應「畫面左右」（col 0 = 左側）。
export type ViewMask = boolean[][];

export function emptyMask(rows: number, cols: number): ViewMask {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

export function projectFront(voxels: Voxels): ViewMask {
  // 畫面：col = x, row = (GRID_SIZE-1) - y  (上方 y 大)
  const mask = emptyMask(GRID_SIZE, GRID_SIZE);
  for (const k of voxels) {
    const [x, y] = parseKey(k);
    const row = GRID_SIZE - 1 - y;
    mask[row][x] = true;
  }
  return mask;
}

export function projectTop(voxels: Voxels): ViewMask {
  // 畫面：col = x, row = (GRID_SIZE-1) - z  (上方 = 遠離 viewer，z 小)
  const mask = emptyMask(GRID_SIZE, GRID_SIZE);
  for (const k of voxels) {
    const [x, , z] = parseKey(k);
    const row = GRID_SIZE - 1 - z;
    mask[row][x] = true;
  }
  return mask;
}

export function projectSide(voxels: Voxels): ViewMask {
  // 右側視圖：沿 -x 觀察。畫面左側 = z 大（近 viewer）。
  // col = (GRID_SIZE-1) - z, row = (GRID_SIZE-1) - y
  const mask = emptyMask(GRID_SIZE, GRID_SIZE);
  for (const k of voxels) {
    const [, y, z] = parseKey(k);
    const row = GRID_SIZE - 1 - y;
    const col = GRID_SIZE - 1 - z;
    mask[row][col] = true;
  }
  return mask;
}

export function projectAll(voxels: Voxels): Record<ViewName, ViewMask> {
  return {
    front: projectFront(voxels),
    top: projectTop(voxels),
    side: projectSide(voxels),
  };
}

export function maskEquals(a: ViewMask, b: ViewMask): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

export function viewsEqual(
  a: Record<ViewName, ViewMask>,
  b: Record<ViewName, ViewMask>
): { ok: boolean; mismatches: ViewName[] } {
  const mismatches: ViewName[] = [];
  for (const v of ["front", "top", "side"] as const) {
    if (!maskEquals(a[v], b[v])) mismatches.push(v);
  }
  return { ok: mismatches.length === 0, mismatches };
}

export function voxelsToArray(voxels: Voxels): [number, number, number][] {
  return Array.from(voxels, parseKey);
}

export function voxelsFromArray(arr: [number, number, number][]): Voxels {
  return new Set(arr.map(([x, y, z]) => key(x, y, z)));
}

export const VIEW_LABEL: Record<ViewName, string> = {
  front: "前視圖",
  top: "上視圖",
  side: "右視圖",
};
