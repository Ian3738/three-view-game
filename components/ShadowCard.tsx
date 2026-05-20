"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { GRID_SIZE, ViewMask, ViewName } from "@/lib/voxel";

type Props = {
  views: Record<ViewName, ViewMask>;
  // 哪些視圖判定為錯（顯示紅色提示）
  highlightBad?: ViewName[];
  // 是否允許旋轉視角
  interactive?: boolean;
  // 高度（px）。預設 320。
  heightPx?: number;
};

// 投影對應的世界座標（filled 表示該格有陰影）
// front view (z=0 後牆)：mask[row][col] = true 對應世界 (x=col, y=(GRID-1)-row, z=0)
// top view (y=0 地板)：mask[row][col] = true 對應世界 (x=col, y=0, z=(GRID-1)-row)
// side view (x=0 左牆)：mask[row][col] = true 對應世界 (x=0, y=(GRID-1)-row, z=(GRID-1)-col)

const SHADOW = "#1e293b"; // slate-800
const SHADOW_BAD = "#dc2626"; // red-600
const WALL = "#f8fafc"; // slate-50
const WALL_BG = "#cbd5e1"; // slate-300 — 露出來形成格線間隙

// 每面牆 9 格，靠 cell 之間的留白自然形成格線。
function Cell({
  position,
  rotation,
  size,
  filled,
  color,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  size: number;
  filled: boolean;
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        color={filled ? color : WALL}
        side={2}
        transparent={!filled}
        opacity={filled ? 1 : 0.9}
      />
    </mesh>
  );
}

function BackWall({
  mask,
  bad,
}: {
  mask: ViewMask;
  bad: boolean;
}) {
  // z=0 的牆面。Cell at world (x+0.5, y+0.5, 0)。
  const cells: React.ReactElement[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const filled = mask[row][col];
      const x = col;
      const y = GRID_SIZE - 1 - row;
      cells.push(
        <Cell
          key={`b-${row}-${col}`}
          position={[x + 0.5, y + 0.5, 0.002]}
          rotation={[0, 0, 0]}
          size={0.96}
          filled={filled}
          color={bad ? SHADOW_BAD : SHADOW}
        />
      );
    }
  }
  return (
    <group>
      <mesh position={[GRID_SIZE / 2, GRID_SIZE / 2, 0]}>
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial color={WALL_BG} side={2} />
      </mesh>
      {cells}
    </group>
  );
}

function Floor({
  mask,
  bad,
}: {
  mask: ViewMask;
  bad: boolean;
}) {
  // y=0 的地板。Cell at world (x+0.5, 0, z+0.5)。
  const cells: React.ReactElement[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const filled = mask[row][col];
      const x = col;
      const z = GRID_SIZE - 1 - row;
      cells.push(
        <Cell
          key={`f-${row}-${col}`}
          position={[x + 0.5, 0.002, z + 0.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          size={0.96}
          filled={filled}
          color={bad ? SHADOW_BAD : SHADOW}
        />
      );
    }
  }
  return (
    <group>
      <mesh
        position={[GRID_SIZE / 2, 0, GRID_SIZE / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial color={WALL_BG} side={2} />
      </mesh>
      {cells}
    </group>
  );
}

function LeftWall({
  mask,
  bad,
}: {
  mask: ViewMask;
  bad: boolean;
}) {
  // x=0 的左牆。Cell at world (0, y+0.5, z+0.5)，z = (GRID-1)-col。
  const cells: React.ReactElement[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const filled = mask[row][col];
      const y = GRID_SIZE - 1 - row;
      const z = GRID_SIZE - 1 - col;
      cells.push(
        <Cell
          key={`l-${row}-${col}`}
          position={[0.002, y + 0.5, z + 0.5]}
          rotation={[0, Math.PI / 2, 0]}
          size={0.96}
          filled={filled}
          color={bad ? SHADOW_BAD : SHADOW}
        />
      );
    }
  }
  return (
    <group>
      <mesh
        position={[0, GRID_SIZE / 2, GRID_SIZE / 2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
        <meshBasicMaterial color={WALL_BG} side={2} />
      </mesh>
      {cells}
    </group>
  );
}

function AxisLabels() {
  // 每面牆角落貼個小標籤
  return (
    <group>
      <Html
        position={[GRID_SIZE / 2, GRID_SIZE + 0.3, 0]}
        center
        distanceFactor={GRID_SIZE * 4}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="rounded bg-slate-900 text-white text-xs px-1.5 py-0.5 font-semibold">
          前視圖
        </div>
      </Html>
      <Html
        position={[GRID_SIZE + 0.3, 0, GRID_SIZE / 2]}
        center
        distanceFactor={GRID_SIZE * 4}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="rounded bg-slate-900 text-white text-xs px-1.5 py-0.5 font-semibold">
          上視圖
        </div>
      </Html>
      <Html
        position={[0, GRID_SIZE + 0.3, GRID_SIZE / 2]}
        center
        distanceFactor={GRID_SIZE * 4}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="rounded bg-slate-900 text-white text-xs px-1.5 py-0.5 font-semibold">
          右視圖
        </div>
      </Html>
    </group>
  );
}

export default function ShadowCard({
  views,
  highlightBad = [],
  interactive = true,
  heightPx = 320,
}: Props) {
  return (
    <div
      className="w-full rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden"
      style={{ height: heightPx }}
    >
      <Canvas
        camera={{
          position: [GRID_SIZE * 1.9, GRID_SIZE * 1.7, GRID_SIZE * 1.9],
          fov: 40,
        }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#f1f5f9"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 8, 5]} intensity={0.4} />
        {interactive && (
          <OrbitControls
            target={[GRID_SIZE / 2, GRID_SIZE / 2, GRID_SIZE / 2]}
            enablePan={false}
            minDistance={GRID_SIZE * 1.5}
            maxDistance={GRID_SIZE * 4}
          />
        )}
        <BackWall mask={views.front} bad={highlightBad.includes("front")} />
        <Floor mask={views.top} bad={highlightBad.includes("top")} />
        <LeftWall mask={views.side} bad={highlightBad.includes("side")} />
        <AxisLabels />
      </Canvas>
    </div>
  );
}
