// 3D Megaminx 渲染器 — R3F 简化版
//
// Megaminx 62 件：
//   20 corner = dodecahedron 顶点
//   30 edge = dodecahedron 边中点
//   12 center = dodecahedron 面中心
//
// 简化：用 SphereGeometry/BoxGeometry/ConeGeometry 代替真实几何

import { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  MegaminxState,
  MEGAMINX_CORNER_SLOTS,
  MEGAMINX_EDGE_SLOTS,
  MEGAMINX_CENTER_SLOTS,
  MEGAMINX_COLORS,
  applyMegaminxMove,
  newMegaminxState,
} from '../cube/megaminx'

interface AnimationState {
  move: string
  startTime: number
  duration: number
  affectedCorners: number[]
  affectedEdges: number[]
  affectedCenters: number[]
  axis: [number, number, number]
  pivot: [number, number, number]
  angle: number
}

function MegaminxScene({ state, anim }: { state: MegaminxState; anim: AnimationState | null }) {
  const cornerGroupRef = useRef<THREE.Group>(null!)
  const edgeGroupRef = useRef<THREE.Group>(null!)
  const centerGroupRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    const progress = anim
      ? Math.min(1, (performance.now() / 1000 - anim.startTime) / (anim.duration / 1000))
      : 1
    const angle = anim ? anim.angle * progress : 0
    const setQuat = (ref: React.RefObject<THREE.Group>) => {
      if (!ref.current) return
      if (!anim) {
        ref.current.quaternion.identity()
        return
      }
      ref.current.quaternion.setFromAxisAngle(
        new THREE.Vector3(anim.axis[0], anim.axis[1], anim.axis[2]),
        angle,
      )
    }
    setQuat(cornerGroupRef as any)
    setQuat(edgeGroupRef as any)
    setQuat(centerGroupRef as any)
  })

  const isAnimating = !!anim
  const cornerSet = useMemo(() => new Set(anim?.affectedCorners ?? []), [anim])
  const edgeSet = useMemo(() => new Set(anim?.affectedEdges ?? []), [anim])
  const centerSet = useMemo(() => new Set(anim?.affectedCenters ?? []), [anim])

  return (
    <>
      {/* Corner pieces */}
      <group ref={cornerGroupRef}>
        {MEGAMINX_CORNER_SLOTS.map((pos, slotIdx) => {
          if (isAnimating && cornerSet.has(slotIdx)) {
            const pieceId = state.corners[slotIdx]
            const color = MEGAMINX_COLORS[pieceId % 12]
            return <CornerPiece key={`c-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
          }
          if (isAnimating) return null
          const pieceId = state.corners[slotIdx]
          const color = MEGAMINX_COLORS[pieceId % 12]
          return <CornerPiece key={`c-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
        })}
      </group>
      {/* Edge pieces */}
      <group ref={edgeGroupRef}>
        {MEGAMINX_EDGE_SLOTS.map((pos, slotIdx) => {
          if (isAnimating && !edgeSet.has(slotIdx)) return null
          const pieceId = state.edges[slotIdx]
          const color = MEGAMINX_COLORS[pieceId % 12]
          return <EdgePiece key={`e-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
        })}
      </group>
      {/* Center pieces */}
      <group ref={centerGroupRef}>
        {MEGAMINX_CENTER_SLOTS.map((pos, slotIdx) => {
          if (isAnimating && !centerSet.has(slotIdx)) return null
          const pieceId = state.centers[slotIdx]
          const color = MEGAMINX_COLORS[pieceId]
          return <CenterPiece key={`f-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
        })}
      </group>
      {/* 静止的 piece（不在 animation 里） */}
      {!isAnimating && null}
      {isAnimating && MEGAMINX_CORNER_SLOTS.map((pos, slotIdx) => {
        if (cornerSet.has(slotIdx)) return null
        const pieceId = state.corners[slotIdx]
        const color = MEGAMINX_COLORS[pieceId % 12]
        return <CornerPiece key={`cs-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
      })}
      {isAnimating && MEGAMINX_EDGE_SLOTS.map((pos, slotIdx) => {
        if (edgeSet.has(slotIdx)) return null
        const pieceId = state.edges[slotIdx]
        const color = MEGAMINX_COLORS[pieceId % 12]
        return <EdgePiece key={`es-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
      })}
      {isAnimating && MEGAMINX_CENTER_SLOTS.map((pos, slotIdx) => {
        if (centerSet.has(slotIdx)) return null
        const pieceId = state.centers[slotIdx]
        const color = MEGAMINX_COLORS[pieceId]
        return <CenterPiece key={`fs-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
      })}
    </>
  )
}

function CornerPiece({ pos, color }: { pos: [number, number, number]; color: string }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.18, 8, 8]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

function EdgePiece({ pos, color }: { pos: [number, number, number]; color: string }) {
  return (
    <mesh position={pos}>
      <boxGeometry args={[0.18, 0.12, 0.18]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

function CenterPiece({ pos, color }: { pos: [number, number, number]; color: string }) {
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.25, 12, 12]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

interface Megaminx3DProps {
  state: MegaminxState
  anim: AnimationState | null
  width?: number | string
  height?: number | string
}

export function Megaminx3D({ state, anim, width = '100%', height = '100%' }: Megaminx3DProps) {
  return (
    <div style={{ width: width as any, height: height as any, position: 'relative' }}>
      <Canvas camera={{ position: [3, 2.5, 3.5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-3, -2, -3]} intensity={0.3} />
        <MegaminxScene state={state} anim={anim} />
        <OrbitControls enablePan={false} enableDamping />
      </Canvas>
    </div>
  )
}

// 工厂函数
export function makeMegaminxAnim(move: string, duration = 400): AnimationState {
  const isPrime = move.endsWith("'")
  const base = move[0].toUpperCase()
  // 简化：4 个基本 move 的 axis 和 affected pieces
  const moveConfig: Record<string, { axis: [number, number, number]; corners: number[]; edges: number[]; centers: number[] }> = {
    U: { axis: [0, 1, 0], corners: [0, 1, 2, 3, 4, 5, 6, 7], edges: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], centers: [5] },
    D: { axis: [0, -1, 0], corners: [12, 13, 14, 15, 16, 17, 18, 19], edges: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29], centers: [0] },
    R: { axis: [1, 0, 0], corners: [4, 5, 6, 14, 15, 16], edges: [4, 5, 15, 25, 26, 27], centers: [2] },
    F: { axis: [0, 0, 1], corners: [0, 1, 2, 6, 7, 8], edges: [2, 3, 8, 12, 13, 14], centers: [5] },
  }
  const cfg = moveConfig[base] ?? moveConfig.U
  return {
    move,
    startTime: performance.now() / 1000,
    duration,
    affectedCorners: cfg.corners,
    affectedEdges: cfg.edges,
    affectedCenters: cfg.centers,
    axis: cfg.axis,
    pivot: [0, 0, 0],
    angle: isPrime ? (-2 * Math.PI) / 3 : (2 * Math.PI) / 3,
  }
}
