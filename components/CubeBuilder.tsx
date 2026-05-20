"use client";

import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import { GRID_SIZE, Voxels, key, parseKey } from "@/lib/voxel";

export type BuilderMode = "add" | "remove";

type Props = {
  voxels: Voxels;
  onChange?: (v: Voxels) => void;
  mode?: BuilderMode;
  readonly?: boolean;
  color?: string;
};

function VoxelMesh({
  pos,
  onClick,
  color,
}: {
  pos: [number, number, number];
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  color: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={pos}
      onClick={onClick}
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
      <boxGeometry args={[0.97, 0.97, 0.97]} />
      <meshStandardMaterial color={hovered ? "#fbbf24" : color} roughness={0.5} />
    </mesh>
  );
}

function GroundPlane({
  onAdd,
  enabled,
}: {
  onAdd: (x: number, z: number) => void;
  enabled: boolean;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[GRID_SIZE / 2, 0, GRID_SIZE / 2]}
      onClick={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        const x = Math.floor(e.point.x);
        const z = Math.floor(e.point.z);
        if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) onAdd(x, z);
      }}
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      <meshStandardMaterial color="#f3f4f6" transparent opacity={0.6} />
    </mesh>
  );
}

export default function CubeBuilder({
  voxels,
  onChange,
  mode = "add",
  readonly = false,
  color = "#3b82f6",
}: Props) {
  const positions = useMemo(
    () =>
      Array.from(voxels, (k) => {
        const [x, y, z] = parseKey(k);
        return {
          k,
          pos: [x + 0.5, y + 0.5, z + 0.5] as [number, number, number],
        };
      }),
    [voxels]
  );

  const handleCubeClick = (k: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (readonly || !onChange) return;
    if (mode === "remove") {
      const next = new Set(voxels);
      next.delete(k);
      onChange(next);
      return;
    }
    const [x, y, z] = parseKey(k);
    const n = e.face?.normal;
    if (!n) return;
    const tx = x + Math.round(n.x);
    const ty = y + Math.round(n.y);
    const tz = z + Math.round(n.z);
    if (
      tx < 0 ||
      tx >= GRID_SIZE ||
      ty < 0 ||
      ty >= GRID_SIZE ||
      tz < 0 ||
      tz >= GRID_SIZE
    )
      return;
    const next = new Set(voxels);
    next.add(key(tx, ty, tz));
    onChange(next);
  };

  const addAtGround = (x: number, z: number) => {
    if (readonly || !onChange) return;
    if (mode !== "add") return;
    const k = key(x, 0, z);
    if (voxels.has(k)) return;
    const next = new Set(voxels);
    next.add(k);
    onChange(next);
  };

  return (
    <Canvas
      camera={{
        position: [GRID_SIZE * 1.7, GRID_SIZE * 1.5, GRID_SIZE * 1.7],
        fov: 45,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#fafafa"]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 7]} intensity={1.1} castShadow />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <OrbitControls
        target={[GRID_SIZE / 2, GRID_SIZE / 2 - 0.5, GRID_SIZE / 2]}
        enablePan={false}
        minDistance={GRID_SIZE}
        maxDistance={GRID_SIZE * 5}
      />
      <gridHelper
        args={[GRID_SIZE, GRID_SIZE, "#94a3b8", "#cbd5e1"]}
        position={[GRID_SIZE / 2, 0.001, GRID_SIZE / 2]}
      />
      <GroundPlane onAdd={addAtGround} enabled={!readonly && mode === "add"} />
      {positions.map(({ k, pos }) => (
        <VoxelMesh
          key={k}
          pos={pos}
          color={color}
          onClick={(e) => handleCubeClick(k, e)}
        />
      ))}
      <axesHelper args={[GRID_SIZE + 0.3]} />
    </Canvas>
  );
}
