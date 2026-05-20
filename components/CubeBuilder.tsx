"use client";

import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import { GRID_SIZE, Voxels, key, parseKey, inBounds } from "@/lib/voxel";

type Props = {
  voxels: Voxels;
  onChange?: (v: Voxels) => void;
  readonly?: boolean;
  color?: string;
};

// 計算所有「可放置」的空位：地板九格 + 既有方塊的相鄰空格。
function computePlaceable(voxels: Voxels): string[] {
  const set = new Set<string>();
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const k = key(x, 0, z);
      if (!voxels.has(k)) set.add(k);
    }
  }
  for (const k of voxels) {
    const [x, y, z] = parseKey(k);
    const nbrs: [number, number, number][] = [
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y + 1, z],
      [x, y - 1, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ];
    for (const [nx, ny, nz] of nbrs) {
      if (!inBounds(nx, ny, nz)) continue;
      const nk = key(nx, ny, nz);
      if (!voxels.has(nk)) set.add(nk);
    }
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
      <boxGeometry args={[0.92, 0.92, 0.92]} />
      <meshStandardMaterial
        color={hovered ? "#22c55e" : "#64748b"}
        transparent
        opacity={hovered ? 0.5 : 0.1}
      />
    </mesh>
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
      {/* 九宮格底線（深色，看得清楚） */}
      <gridHelper
        args={[GRID_SIZE, GRID_SIZE, "#334155", "#64748b"]}
        position={[GRID_SIZE / 2, 0.002, GRID_SIZE / 2]}
      />
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
      <axesHelper args={[GRID_SIZE + 0.3]} />
    </Canvas>
  );
}
