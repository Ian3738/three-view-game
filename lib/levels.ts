import { GRID_SIZE, projectAll, Voxels, voxelsFromArray } from "./voxel";

export type Level = {
  id: string;
  name: string;
  hint: string;
  // 達成相同三視圖的最少方塊數。用 null 表示不檢查。
  minCubes: number | null;
  targetVoxels: [number, number, number][];
};

// 注意：所有方塊必須「腳踏實地」——同一直立柱從 y=0 連續往上才能放。
// 座標 x、y、z 都在 [0, 3)。
export const LEVELS: Level[] = [
  // ── 入門 ─────────────────────────────────────
  {
    id: "L1",
    name: "第 1 關 · 三塊一字排",
    hint: "把方塊沿著左右方向排成一直線就好。",
    minCubes: 3,
    targetVoxels: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ],
  },
  {
    id: "L2",
    name: "第 2 關 · 簡單樓梯",
    hint: "兩塊平排，右邊那塊再往上多一塊。",
    minCubes: 3,
    targetVoxels: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ],
  },
  {
    id: "L3",
    name: "第 3 關 · L 型轉角",
    hint: "需要往深度方向也延伸。",
    minCubes: 4,
    targetVoxels: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
  },
  {
    id: "L4",
    name: "第 4 關 · 2×2 底 + 角塔",
    hint: "底層四塊組成正方形，再蓋一塊到角落。",
    minCubes: 5,
    targetVoxels: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [0, 1, 0],
    ],
  },
  {
    id: "L5",
    name: "第 5 關 · 四角不可見",
    hint: "上視圖和右視圖會「藏」掉一些方塊。",
    minCubes: 4,
    targetVoxels: [
      [0, 0, 0],
      [2, 0, 0],
      [0, 0, 2],
      [2, 0, 2],
    ],
  },
  {
    id: "L6",
    name: "第 6 關 · 平地 T 字",
    hint: "從上視圖看像 T 字，整層只放在底部。",
    minCubes: 5,
    targetVoxels: [
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
      [1, 0, 0],
      [1, 0, 2],
    ],
  },

  // ── 進階：開始要疊起來 ──────────────────────
  {
    id: "L7",
    name: "第 7 關 · 雙柱門廊",
    hint: "左右兩根柱子（兩塊高），後面再放一塊。三個位置都不同深度。",
    minCubes: 5,
    targetVoxels: [
      [0, 0, 0],
      [0, 1, 0],
      [2, 0, 0],
      [2, 1, 0],
      [1, 0, 2],
    ],
  },
  {
    id: "L8",
    name: "第 8 關 · 完整三階階梯",
    hint: "前視圖看是三階樓梯。中間和高處都要墊到底，不能浮空。",
    minCubes: 6,
    targetVoxels: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 1, 0],
      [2, 1, 0],
      [2, 2, 0],
    ],
  },
  {
    id: "L9",
    name: "第 9 關 · 中心 T 塔",
    hint: "上視圖是 T 字形，中心再往上長兩層。",
    minCubes: 7,
    targetVoxels: [
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
      [1, 0, 0],
      [1, 0, 2],
      [1, 1, 1],
      [1, 2, 1],
    ],
  },

  // ── 高階：隱藏方塊 / 視覺欺騙 ────────────────
  {
    id: "L10",
    name: "第 10 關 · 雙塔對峙",
    hint: "兩根高塔距離開、高度不同。位置（在哪個角）和高度都要對。",
    minCubes: 5,
    targetVoxels: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [2, 0, 2],
      [2, 1, 2],
    ],
  },
  {
    id: "L11",
    name: "第 11 關 · 隱身的高塔",
    hint: "從前面和右邊看，四個角都好像頂到天花板？其實最少只要 2 根高塔 + 2 塊角落填補。",
    minCubes: 8,
    targetVoxels: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [2, 0, 2],
      [2, 1, 2],
      [2, 2, 2],
      [0, 0, 2],
      [2, 0, 0],
    ],
  },
  {
    id: "L12",
    name: "第 12 關 · 田字底 + 中柱",
    hint: "底層 3×3 全滿，中心再往上長兩層。重點：哪些方塊真的「必要」？",
    minCubes: 11,
    targetVoxels: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
      [0, 0, 2],
      [1, 0, 2],
      [2, 0, 2],
      [1, 1, 1],
      [1, 2, 1],
    ],
  },
];

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelTargetViews(level: Level): {
  targetVoxels: Voxels;
  views: ReturnType<typeof projectAll>;
} {
  const targetVoxels = voxelsFromArray(level.targetVoxels);
  return { targetVoxels, views: projectAll(targetVoxels) };
}

export const LEVEL_GRID_SIZE = GRID_SIZE;
