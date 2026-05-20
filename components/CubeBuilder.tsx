"use client";

import { Canvas, ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import { GRID_SIZE, Voxels, key, parseKey } from "@/lib/voxel";

type Props = {
  voxels: Voxels;
  onChange?: (v: Voxels) => void;
  readonly?: boolean;
  color?: string;
};

// 計算「可放置」的空位：
//   - 地板 9 格（y=0）
//   - 每個既有「方塊堆」的正上方一格（往上長）
// 不顯示橫向/側邊的鬼影格，畫面比較乾淨。
function computePlaceable(voxels: Voxels): string[] {
  const set = new Set<string>();
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const k = key(x, 0, z);
      if (!voxels.has(k)) set.add(k);
    }
  }
  // 每個 (x,z) column 找最高 y，提供一格往上放
  const maxYByColumn = new Map<string, number>();
  for (const k of voxels) {
    const [x, y, z] = parseKey(k);
    const colKey = `${x},${z}`;
    const prev = maxYByColumn.get(colKey) ?? -1;
    if (y > prev) maxYByColumn.set(colKey, y);
  }
  for (const [colKey, maxY] of maxYByColumn) {
    const [x, z] = colKey.split(",").map(Number);
    const ny = maxY + 1;
    if (ny >= GRID_SIZE) continue;
    const nk = key(x, ny, z);
    if (!voxels.has(nk)) set.add(nk);
  }
  return Array.from(set);
}

function posOf(k: string): [number, number, number] {
  const [x, y, z] = parseKey(k);
  return [x + 0.5, y + 0.5, z + 0.5];
}

function VoxelMesh({
  k,
  pos,
  color,
  onRemove,
}: {
  k: string;
  pos: [number, number, number];
  color: string;
  onRemove: (k: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={pos}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onRemove(k);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <boxGeometry args={[0.96, 0.96, 0.96]} />
      <meshStandardMaterial
        color={hovered ? "#f97316" : color}
        roughness={0.5}
      />
    </mesh>
  );
}

function GhostMesh({
  k,
  pos,
  onAdd,
}: {
  k: string;
  pos: [number, number, number];
  onAdd: (k: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={pos}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onAdd(k);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "crosshair";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <boxGeometry args={[0.9, 0.9, 0.9]} />
      <meshStandardMaterial
        color={hovered ? "#22c55e" : "#cbd5e1"}
        transparent
        opacity={hovered ? 0.55 : 0.18}
      />
    </mesh>
  );
}

// 場景中固定的方向指示：前邊紅、右邊藍 + 對應文字標籤
function DirectionMarkers() {
  return (
    <group>
      {/* 前邊（+z 邊）紅色長條 */}
      <mesh position={[GRID_SIZE / 2, 0.025, GRID_SIZE + 0.01]}>
        <boxGeometry args={[GRID_SIZE, 0.05, 0.08]} />
        <meshBasicMaterial color="#dc2626" />
      </mesh>
      {/* 右邊（+x 邊）藍色長條 */}
      <mesh position={[GRID_SIZE + 0.01, 0.025, GRID_SIZE / 2]}>
        <boxGeometry args={[0.08, 0.05, GRID_SIZE]} />
        <meshBasicMaterial color="#2563eb" />
      </mesh>
      {/* 前 標籤 */}
      <Html
        position={[GRID_SIZE / 2, 0.05, GRID_SIZE + 0.45]}
        center
        distanceFactor={GRID_SIZE * 4}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="rounded-md bg-rose-600 text-white font-bold px-2 py-0.5 text-sm whitespace-nowrap shadow">
          前
        </div>
      </Html>
      {/* 右 標籤 */}
      <Html
        position={[GRID_SIZE + 0.45, 0.05, GRID_SIZE / 2]}
        center
        distanceFactor={GRID_SIZE * 4}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div className="rounded-md bg-blue-600 text-white font-bold px-2 py-0.5 text-sm whitespace-nowrap shadow">
          右
        </div>
      </Html>
    </group>
  );
}

export default function CubeBuilder({
  voxels,
  onChange,
  readonly = false,
  color = "#3b82f6",
}: Props) {
  const filled = useMemo(
    () => Array.from(voxels, (k) => ({ k, pos: posOf(k) })),
    [voxels]
  );
  const ghosts = useMemo(() => {
    if (readonly) return [];
    return computePlaceable(voxels).map((k) => ({ k, pos: posOf(k) }));
  }, [voxels, readonly]);

  const add = (k: string) => {
    if (readonly || !onChange) return;
    const next = new Set(voxels);
    next.add(k);
    onChange(next);
  };
  const remove = (k: string) => {
    if (readonly || !onChange) return;
    const next = new Set(voxels);
    next.delete(k);
    onChange(next);
  };

  return (
    <Canvas
      camera={{
        position: [GRID_SIZE * 1.7, GRID_SIZE * 1.5, GRID_SIZE * 1.7],
        fov: 45,
      }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <color attach="background" args={["#fafafa"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 10, 7]} intensity={1.1} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <OrbitControls
        target={[GRID_SIZE / 2, GRID_SIZE / 2 - 0.5, GRID_SIZE / 2]}
        enablePan={false}
        minDistance={GRID_SIZE}
        maxDistance={GRID_SIZE * 5}
      />
      {/* 底層 3x3 格線 */}
      <gridHelper
        args={[GRID_SIZE, GRID_SIZE, "#334155", "#64748b"]}
        position={[GRID_SIZE / 2, 0.002, GRID_SIZE / 2]}
      />
      <DirectionMarkers />
      {filled.map(({ k, pos }) => (
        <VoxelMesh
          key={k}
          k={k}
          pos={pos}
          color={color}
          onRemove={remove}
        />
      ))}
      {ghosts.map(({ k, pos }) => (
        <GhostMesh key={k} k={k} pos={pos} onAdd={add} />
      ))}
    </Canvas>
  );
}
