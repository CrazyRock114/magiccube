// 3D Skewb 渲染器 — 用 R3F 画 8 个独立角块 + 转动动画
//
// 跟 Cube3D 一样的模式：
// - state（cubie 位置 + 朝向）
// - 3 cycling corner 用 group rotation 一次性旋转
// - 在 place 自旋的 corner 用 local rotation
// - 动画结束后由 parent commit 新 state

import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  SkewbState,
  SKEWB_SLOTS,
  SKEWB_MOVES,
  skewbStickerNormals,
  skewbStickerColors,
  skewbCycleCornerSlots,
  skewbRotationAxisAndPivot,
  applySkewbMove,
} from '../cube/skewb'
import type { Vec3 } from '../cube/quat'

const CUBIE_SIZE = 0.95
const STICKER_INSET = 0.005

function StickerMesh({ normal, color, cubieSize }: { normal: Vec3; color: string; cubieSize: number }) {
  const stickerSize = cubieSize * 0.9
  const offset = cubieSize / 2 + STICKER_INSET
  const pos: Vec3 = [normal[0] * offset, normal[1] * offset, normal[2] * offset]
  // 算 quaternion 让 plane 指向 normal
  const quat = useMemo(() => {
    const n = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize()
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
    return q
  }, [normal])
  return (
    <mesh
      position={pos as unknown as [number, number, number]}
      quaternion={quat}
    >
      <planeGeometry args={[stickerSize, stickerSize]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

function CornerCubie({
  pos,
  ori,
  cubieSize,
}: {
  pos: Vec3
  ori: number // mod 3, rotation around its own axis (from slot to center)
  cubieSize: number
}) {
  // ori = 角块本地旋转。绕"从 slot 中心指向 cube 中心"的轴旋转 (mod 3 = 120° 步)
  const localQuat = useMemo(() => {
    if (ori === 0) return new THREE.Quaternion()
    // axis = -pos normalized (从 slot 中心指向 cube 中心)
    const len = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]) || 1
    const axis = new THREE.Vector3(-pos[0] / len, -pos[1] / len, -pos[2] / len)
    return new THREE.Quaternion().setFromAxisAngle(axis, (ori * 2 * Math.PI) / 3)
  }, [pos, ori])

  // 角块在 slot 位置处的"本地坐标"：它的 3 个 sticker 指向 ±X/±Y/±Z
  // 角块在 solved 状态下：sticker normal = 该 slot 的 sign
  // 我们用 slot 位置（sgn）反推 normals
  const stickerNormals = useMemo(() => {
    // 角块本身在 pos，它朝外的 3 个面 = pos 的 sign 方向
    return [
      [Math.sign(pos[0]), 0, 0] as Vec3,
      [0, Math.sign(pos[1]), 0] as Vec3,
      [0, 0, Math.sign(pos[2])] as Vec3,
    ]
  }, [pos])
  const stickerCols = useMemo(
    () => [
      ['#ff4444', '#ff8800'][pos[0] > 0 ? 0 : 1],
      ['#ffffff', '#ffdd00'][pos[1] > 0 ? 0 : 1],
      ['#00cc44', '#0044cc'][pos[2] > 0 ? 0 : 1],
    ],
    [pos],
  )

  return (
    <group
      position={pos as unknown as [number, number, number]}
      quaternion={localQuat}
    >
      <mesh>
        <boxGeometry args={[cubieSize, cubieSize, cubieSize]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.6} metalness={0.3} />
      </mesh>
      {stickerNormals.map((n, i) => (
        <StickerMesh key={i} normal={n} color={stickerCols[i]} cubieSize={cubieSize} />
      ))}
    </group>
  )
}

interface AnimationState {
  move: string
  startTime: number
  duration: number
  cyclingSlots: number[]
  axis: Vec3
  pivot: Vec3
  // in-place 旋转的角块（slot index → delta）
  inPlaceDeltas: Map<number, number>
}

function SkewbScene({
  state,
  anim,
}: {
  state: SkewbState
  anim: AnimationState | null
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const localQuatRefs = useRef<Map<number, THREE.Quaternion>>(new Map())
  const [t, setT] = useState(0)

  useFrame(() => {
    if (!anim) {
      setT(1)
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0)
      return
    }
    const elapsed = performance.now() / 1000 - anim.startTime
    const progress = Math.min(1, elapsed / (anim.duration / 1000))
    setT(progress)
    // group rotation around axis * 120° * progress
    if (groupRef.current) {
      const angle = (progress * 2 * Math.PI) / 3 // 120° = 2π/3
      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(anim.axis[0], anim.axis[1], anim.axis[2]),
        angle,
      )
      groupRef.current.quaternion.copy(q)
    }
  })

  // 哪些角块在 cycling group 里
  const cyclingSet = useMemo(() => new Set(anim?.cyclingSlots ?? []), [anim])
  const inPlace = anim?.inPlaceDeltas ?? new Map<number, number>()

  return (
    <group>
      {/* Cycling group — 3 个角块一起旋转 */}
      <group
        ref={groupRef}
        position={(anim?.pivot ?? [0, 0, 0]) as unknown as [number, number, number]}
      >
        {/* 把 pivot 平移还原 */}
        <group
          position={
            anim
              ? [-anim.pivot[0], -anim.pivot[1], -anim.pivot[2]] as unknown as [number, number, number]
              : [0, 0, 0] as unknown as [number, number, number]
          }
        >
          {SKEWB_SLOTS.map((pos, slotIdx) => {
            if (!cyclingSet.has(slotIdx)) return null
            const pieceId = state.corners[slotIdx]
            const ori = state.cornerOri[slotIdx]
            return (
              <CornerCubie
                key={`cycle-${slotIdx}-${pieceId}`}
                pos={pos}
                ori={ori}
                cubieSize={CUBIE_SIZE}
              />
            )
          })}
        </group>
      </group>
      {/* 静止或 in-place 自旋的角块 */}
      {SKEWB_SLOTS.map((pos, slotIdx) => {
        if (cyclingSet.has(slotIdx)) return null
        const pieceId = state.corners[slotIdx]
        const ori = state.cornerOri[slotIdx]
        const inPlaceDelta = inPlace.get(slotIdx) ?? 0
        // in-place 旋转：绕 axis = -pos normalized 旋转 120° * inPlaceDelta * t
        const localOri = (ori + inPlaceDelta) % 3 // 静态部分（动画完成后）
        return (
          <InPlaceCubie
            key={`inplace-${slotIdx}-${pieceId}`}
            pos={pos}
            ori={localOri}
            inPlaceDelta={inPlaceDelta}
            animT={t}
            cubieSize={CUBIE_SIZE}
            active={inPlaceDelta !== 0}
          />
        )
      })}
    </group>
  )
}

function InPlaceCubie({
  pos,
  ori,
  inPlaceDelta,
  animT,
  cubieSize,
  active,
}: {
  pos: Vec3
  ori: number
  inPlaceDelta: number
  animT: number
  cubieSize: number
  active: boolean
}) {
  // 动画时：ori = base + inPlaceDelta * t（mod 3）
  // 实际显示的 ori = (ori + inPlaceDelta * animT) mod 3
  // 但 t 是个连续值，不是整数；我们用 3 段插值让 sticker 视觉上 120° 跳
  // 简单做法：ori = base + inPlaceDelta * animT（连续，物理上正确）
  const displayOri = (ori + inPlaceDelta * animT) % 3

  return (
    <CornerCubie pos={pos} ori={displayOri} cubieSize={cubieSize} />
  )
}

interface Skewb3DProps {
  state: SkewbState
  anim: AnimationState | null
  width?: number | string
  height?: number | string
}

export function Skewb3D({ state, anim, width = '100%', height = '100%' }: Skewb3DProps) {
  return (
    <div style={{ width: width as any, height: height as any, position: 'relative', background: 'transparent' }}>
      <Canvas camera={{ position: [3.5, 3, 4.5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-3, -2, -3]} intensity={0.3} />
        <SkewbScene state={state} anim={anim} />
        <OrbitControls enablePan={false} enableDamping />
      </Canvas>
    </div>
  )
}

// 工厂函数：构造一个 animation state
export function makeSkewbAnim(
  move: string,
  duration = 400,
): AnimationState {
  const { axis, pivot } = skewbRotationAxisAndPivot(move)
  const cycling = skewbCycleCornerSlots(move)
  // in-place slots: 那些 active 但不在 cycling 里的
  const inPlaceMap = new Map<number, number>()
  // 从 skewb state engine 查 in-place delta
  const isPrime = move.endsWith("'")
  const base = isPrime ? move.slice(0, -1) : move
  // 直接从 SKEWB_MOVES 表拿
  const t = SKEWB_MOVES[base]
  if (t) {
    for (let i = 0; i < 8; i++) {
      if (t.cornerDelta[i] !== 0 && t.cornerPerm[i] === i) {
        inPlaceMap.set(i, t.cornerDelta[i])
      }
    }
  }
  return {
    move,
    startTime: performance.now() / 1000,
    duration,
    cyclingSlots: cycling,
    axis,
    pivot,
    inPlaceDeltas: inPlaceMap,
  }
}
