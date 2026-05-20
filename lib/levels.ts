import { GRID_SIZE, projectAll, Voxels, voxelsFromArray } from "./voxel";

export type Level = {
  id: string;
  name: string;
  hint: string;
  // 「最少方塊數」目標：在符合三視圖前提下的最小方塊數。
  // 若 null 則只比對視圖。
  minCubes: number | null;
  targetVoxels: [number, number, number][];
};

// 注意：座標都在 [0, GRID_SIZE) = [0,4) 內。x=左右、y=上下、z=前後。
export const LEVELS: Level[] = [
  {
    id: "L1",
    name: "第 1 關 · 三個方塊一字排開",
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
    name: "第 2 關 · 階梯",
    hint: "像樓梯一樣，從低到高。",
    minCubes: 3,
    targetVoxels: [
      [0, 0, 0],
      [1, 1, 0],
      [2, 2, 0],
    ],
  },
  {
    id: "L3",
    name: "第 3 關 · L 型轉角",
    hint: "需要往深度方向延伸。",
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
    name: "第 4 關 · 2x2 底座 + 高塔",
    hint: "底層有四個方塊組成正方形，再往上疊。",
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
    name: "第 5 關 · 不可見的方塊",
    hint: "提示：俯視圖和側視圖會「藏」掉一些方塊。",
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
    name: "第 6 關 · T 型",
    hint: "從俯視圖看像 T 字。",
    minCubes: 5,
    targetVoxels: [
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
      [1, 0, 0],
      [1, 0, 2],
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
