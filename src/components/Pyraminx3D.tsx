// 3D Pyraminx 渲染器 — R3F 简化版
//
// Pyraminx 14 件：
//   4 tip  = 4 个顶点上的小三角锥
//   6 edge = 6 条边上的菱形块
//   4 center = 4 个面中心的大三角
//
// 我们用简化的 mesh：
//   - tip: small ConeGeometry 沿 tip 方向
//   - edge: small BoxGeometry 在 edge 中点
//   - center: large ConeGeometry/TriangleGeometry 在 face 中心
//
// 颜色：4 个 face 各一色（red/green/blue/yellow）。
// 块的"home color"是它在 solved 状态下显示的颜色。

import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  PyraminxState,
  PYRAMINX_TIP_SLOTS,
  PYRAMINX_EDGE_SLOTS,
  PYRAMINX_CENTER_SLOTS,
  applyPyraminxMove,
  newPyraminxState,
} from '../cube/pyraminx'

// 4 个 face color (按 Pyraminx 标准配色)
const TIP_COLORS = ['#ff4444', '#00cc44', '#0044cc', '#ffdd00']  // 红/绿/蓝/黄
const EDGE_COLORS = ['#ff8888', '#88ff88', '#8888ff', '#ffff88', '#ff88ff', '#88ffff']
const CENTER_COLORS = ['#cc0000', '#009933', '#0033aa', '#ccaa00']  // 4 个面中心

interface AnimationState {
  move: string
  startTime: number
  duration: number
  // 简化为：所有受影响的 tip/edge/center 一起转
  affectedPieces: { type: 'tip' | 'edge' | 'center'; indices: number[] }[]
  axis: [number, number, number]
  pivot: [number, number, number]
  angle: number  // 实际旋转角度（弧度）
}

function PyraminxScene({ state, anim }: { state: PyraminxState; anim: AnimationState | null }) {
  const groupRef = useRef<THREE.Group>(null!)
  const [, setT] = useState(0)

  useFrame(() => {
    if (!anim || !groupRef.current) {
      setT(1)
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0)
      return
    }
    const elapsed = performance.now() / 1000 - anim.startTime
    const progress = Math.min(1, elapsed / (anim.duration / 1000))
    setT(progress)
    groupRef.current.quaternion.setFromAxisAngle(
      new THREE.Vector3(anim.axis[0], anim.axis[1], anim.axis[2]),
      anim.angle * progress,
    )
  })

  const isAnimating = !!anim
  const affectedSet = useMemo(() => {
    if (!anim) return new Set<string>()
    const s = new Set<string>()
    for (const group of anim.affectedPieces) {
      for (const idx of group.indices) {
        s.add(`${group.type}-${idx}`)
      }
    }
    return s
  }, [anim])

  return (
    <group ref={groupRef}>
      {/* Tip pieces */}
      {PYRAMINX_TIP_SLOTS.map((pos, slotIdx) => {
        const inAnim = affectedSet.has(`tip-${slotIdx}`)
        if (isAnimating && inAnim) return null // 动画中由 group 处理
        const pieceId = state.tips[slotIdx]
        const color = TIP_COLORS[pieceId]
        const [x, y, z] = pos
        const len = Math.sqrt(x * x + y * y + z * z)
        const dir: [number, number, number] = [x / len, y / len, z / len]
        return <TipPiece key={`tip-${slotIdx}-${pieceId}`} pos={pos as any} dir={dir} color={color} />
      })}
      {/* Edge pieces */}
      {PYRAMINX_EDGE_SLOTS.map((pos, slotIdx) => {
        const inAnim = affectedSet.has(`edge-${slotIdx}`)
        if (isAnimating && inAnim) return null
        const pieceId = state.edges[slotIdx]
        const color = EDGE_COLORS[pieceId]
        return <EdgePiece key={`edge-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
      })}
      {/* Center pieces */}
      {PYRAMINX_CENTER_SLOTS.map((pos, slotIdx) => {
        const inAnim = affectedSet.has(`center-${slotIdx}`)
        if (isAnimating && inAnim) return null
        const pieceId = state.centers[slotIdx]
        const color = CENTER_COLORS[pieceId]
        return <CenterPiece key={`center-${slotIdx}-${pieceId}`} pos={pos as any} color={color} />
      })}
    </group>
  )
}

function TipPiece({
  pos,
  dir,
  color,
}: {
  pos: [number, number, number]
  dir: [number, number, number]
  color: string
}) {
  // 一个向外的小三角锥（cone）
  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir[0], dir[1], dir[2]))
    return q
  }, [dir])
  // 把它放在顶点位置，但稍微向内（让它看起来像顶在角上）
  return (
    <group position={pos} quaternion={quat}>
      <mesh position={[0, -0.3, 0]}>
        <coneGeometry args={[0.4, 0.6, 4]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  )
}

function EdgePiece({ pos, color }: { pos: [number, number, number]; color: string }) {
  // 一个小菱形（box 旋转 45°）
  return (
    <mesh position={pos} rotation={[0, Math.PI / 4, Math.PI / 4]}>
      <boxGeometry args={[0.35, 0.35, 0.35]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

function CenterPiece({ pos, color }: { pos: [number, number, number]; color: string }) {
  // 一个小三角片（用大点的 cone 模拟）
  return (
    <mesh position={pos}>
      <coneGeometry args={[0.4, 0.5, 3]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

interface Pyraminx3DProps {
  state: PyraminxState
  anim: AnimationState | null
  width?: number | string
  height?: number | string
}

export function Pyraminx3D({ state, anim, width = '100%', height = '100%' }: Pyraminx3DProps) {
  return (
    <div style={{ width: width as any, height: height as any, position: 'relative' }}>
      <Canvas camera={{ position: [2.5, 2, 3], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-3, -2, -3]} intensity={0.3} />
        <PyraminxScene state={state} anim={anim} />
        <OrbitControls enablePan={false} enableDamping />
      </Canvas>
    </div>
  )
}

// 工厂：构造 animation
// 简化：4 个 face move 各自对应的 axis：
//   r: 绕 (+1, -1, -1) tip 方向 = 转动 120°
//   l: 绕 (-1, +1, -1) tip 方向
//   u: 绕 (-1, -1, +1) tip 方向
//   b: 绕 (+1, +1, +1) tip 方向（"back" 是顶面 tip 0 的对面）
// 这些 axis 大致等于对应的 tip slot 方向
export function makePyraminxAnim(move: string, duration = 400): AnimationState {
  const isPrime = move.endsWith("'")
  const base = move[0]
  const axisMap: Record<string, [number, number, number]> = {
    r: [1, -1, -1],
    l: [-1, 1, -1],
    u: [-1, -1, 1],
    b: [1, 1, 1],
  }
  const axis = axisMap[base] ?? [1, 1, 1]
  // normalize
  const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2)
  const norm: [number, number, number] = [axis[0] / len, axis[1] / len, axis[2] / len]
  // 简化：所有受影响的 piece 一起转（r/l/u/b 转 3 个 tip + 3 个 edge + 1 个 center）
  // 这里我们只能简化处理：因为不知道准确的 piece subsets
  // 简化为：转那 1 个 center face（与 base 对应的 center）和相关 tip
  const affectedPieces = [
    { type: 'tip' as const, indices: tipIndicesForMove(base) },
    { type: 'edge' as const, indices: edgeIndicesForMove(base) },
    { type: 'center' as const, indices: [centerIndexForMove(base)] },
  ]
  return {
    move,
    startTime: performance.now() / 1000,
    duration,
    affectedPieces,
    axis: norm,
    pivot: [0, 0, 0],
    angle: isPrime ? (-2 * Math.PI) / 3 : (2 * Math.PI) / 3,
  }
}

function tipIndicesForMove(base: string): number[] {
  // r 动 tip 0（+X+Y+Z 方向，绕自己转）
  // l 动 tip 1
  // u 动 tip 2
  // b 动 tip 3
  const map: Record<string, number[]> = {
    r: [0], l: [1], u: [2], b: [3],
  }
  return map[base] ?? []
}

function edgeIndicesForMove(base: string): number[] {
  // 简化：3 个 edge
  const map: Record<string, number[]> = {
    r: [0, 1, 2], l: [0, 3, 4], u: [1, 3, 5], b: [2, 4, 5],
  }
  return map[base] ?? []
}

function centerIndexForMove(base: string): number {
  // r 动哪个 face center？
  const map: Record<string, number> = {
    r: 0, l: 1, u: 2, b: 3,
  }
  return map[base] ?? 0
}
