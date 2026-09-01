// 3D 魔方组件 — N×N cubie-based 渲染 + 正确 animation
//
// 修复了原版的 4 个 bug：
//   1. 时钟用 performance.now()/1000（与 React 一致），不再混 R3F clock
//   2. layer cubie 放进临时 group，group 绕 axis 旋转 → 正确 axis
//   3. 动画结束后由 parent 更新 state，group 自动消失 → cubie 不会消失
//   4. cube state 必须在动画**完成后**才更新（parent 控制）

import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  CubeState, Cubie, Sticker, Axis,
  COLOR_HEX, FACE_ORDER, parseMoveToken,
  getStickerString,
} from '../cube/state'
import type { Quat, Vec3 } from '../cube/quat'
import { quatPlaneToNormal } from './quat-helpers'

const CUBIE_SIZE = 0.95
const STICKER_INSET = 0.005

function StickerMesh({ sticker, cubieSize }: { sticker: Sticker; cubieSize: number }) {
  const stickerSize = cubieSize * 0.92
  const offset = cubieSize / 2 + STICKER_INSET
  const pos: Vec3 = [
    sticker.normal[0] * offset,
    sticker.normal[1] * offset,
    sticker.normal[2] * offset,
  ]
  const quat = useMemo(() => quatPlaneToNormal(sticker.normal), [sticker.normal])
  return (
    <mesh position={pos as unknown as [number, number, number]} quaternion={quat as unknown as [number, number, number, number]}>
      <planeGeometry args={[stickerSize, stickerSize]} />
      <meshStandardMaterial color={COLOR_HEX[sticker.color]} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

function CubieMesh({ cubie, cubieSize }: { cubie: Cubie; cubieSize: number }) {
  return (
    <group
      position={cubie.pos as unknown as [number, number, number]}
      quaternion={cubie.ori as unknown as [number, number, number, number]}
    >
      <mesh>
        <boxGeometry args={[cubieSize, cubieSize, cubieSize]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.6} metalness={0.3} />
      </mesh>
      {cubie.stickers.map((s, i) => (
        <StickerMesh key={i} sticker={s} cubieSize={cubieSize} />
      ))}
    </group>
  )
}

interface AnimationState {
  move: string
  startTime: number  // performance.now() / 1000 (seconds)
  duration: number   // milliseconds
  axis: Axis
  layers: number[]
  angle: number
}

interface LayerInfo {
  axis: Axis
  layers: number[]
  angle: number
}

function getLayerInfo(state: CubeState, move: string): LayerInfo | null {
  let info
  try {
    info = parseMoveToken(move)
  } catch {
    return null
  }
  if (!'URFDLB'.includes(info.face)) return null
  const half = (state.size - 1) / 2
  let axis: Axis
  let outerLayer: number
  switch (info.face) {
    case 'R': axis = 'x'; outerLayer = half; break
    case 'L': axis = 'x'; outerLayer = -half; break
    case 'U': axis = 'y'; outerLayer = half; break
    case 'D': axis = 'y'; outerLayer = -half; break
    case 'F': axis = 'z'; outerLayer = half; break
    case 'B': axis = 'z'; outerLayer = -half; break
  }
  const layers = (info.wide && state.size === 4)
    ? [outerLayer, outerLayer > 0 ? outerLayer - 1 : outerLayer + 1]
    : [outerLayer]

  // Visual rotation angle (NOT the position-permutation angle).
  // R/U/F (faces whose normal points in +axis): "no prime" = -90° around +axis = CW from face view.
  // L/D/B (normal in -axis): "no prime" = +90° around +axis = CW from face view (mirrored on opposite side).
  // Prime reverses direction. Double = 180°.
  // 关键：要把"动画旋转"和"position permutation"解耦 — 后者用 totalTurns=3 走 inverse 公式
  // 给出正确的位置终点，但前者的 angle 必须落在 [-π, π] 范围内，否则 R3F 动画会从 0
  // 走到 -3π/2，视觉上 cubie 绕远路转 270° 才到位。
  const faceIsPositive = info.face === 'R' || info.face === 'U' || info.face === 'F'
  const sign = faceIsPositive ? -1 : 1
  const turnSign = info.prime ? -1 : 1
  const magnitude = info.double ? 2 : 1
  const angle = (Math.PI / 2) * sign * turnSign * magnitude

  return { axis, layers, angle }
}

function isInLayers(pos: Vec3, axis: Axis, layers: number[]): boolean {
  const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  return layers.some(l => Math.abs(pos[idx] - l) < 0.1)
}

interface CubeSceneProps {
  state: CubeState
  animation: AnimationState | null
  onAnimationComplete?: () => void
  scale?: number
  enableControls?: boolean
}

function CubeScene({ state, animation, onAnimationComplete, scale = 1, enableControls = true }: CubeSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const completedRef = useRef(false)
  const animRef = useRef<AnimationState | null>(null)
  const startTimeRef = useRef<number>(0)

  // 同步新的 animation
  useEffect(() => {
    if (animation) {
      animRef.current = animation
      completedRef.current = false
      startTimeRef.current = performance.now() / 1000
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0)
    } else {
      animRef.current = null
    }
  }, [animation])

  // 用 (cubie, originalIndex) 包一层。key 用原始 index（state.cubies 数组下标，applyMove 保留顺序）
  // —— 让同一个 cubie 跨 state 变化保持同一 React element，避免 mesh/material 被卸载重建。
  const { staticCubies, rotatingCubies } = useMemo(() => {
    if (!animation) {
      return {
        staticCubies: state.cubies.map((c, i) => ({ c, i })),
        rotatingCubies: [] as { c: Cubie; i: number }[],
      }
    }
    const s: { c: Cubie; i: number }[] = []
    const r: { c: Cubie; i: number }[] = []
    for (let i = 0; i < state.cubies.length; i++) {
      const c = state.cubies[i]
      if (isInLayers(c.pos, animation.axis, animation.layers)) r.push({ c, i })
      else s.push({ c, i })
    }
    return { staticCubies: s, rotatingCubies: r }
  }, [state.cubies, animation])

  useFrame(() => {
    if (!animRef.current || !groupRef.current) return
    const a = animRef.current
    const now = performance.now() / 1000
    const elapsed = now - startTimeRef.current
    const t = Math.min(1, elapsed / (a.duration / 1000))
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const angle = ease * a.angle
    groupRef.current.rotation.set(0, 0, 0)
    if (a.axis === 'x') groupRef.current.rotation.x = angle
    if (a.axis === 'y') groupRef.current.rotation.y = angle
    if (a.axis === 'z') groupRef.current.rotation.z = angle
    if (t >= 1 && !completedRef.current) {
      completedRef.current = true
      animRef.current = null
      // 关键修复：动画完成时**不要**把 group rotation 重置为 0。
      // 此时 React 还没收到 state 更新（onMoveApplied 是异步 schedule 的），
      // 如果这里把 group 拉到 0，R3F 会用"group 在 0 + 内部 cubie 在 OLD 位置"渲染一帧，
      // 视觉上整层 cubie 突然从最终位置跳回原位置；state 更新后又跳回最终位置 → 闪烁。
      // 让 group 停在最终角度，R3F 下一帧之前 React 会卸载这个 group（因为 animation=null
      // 时 rotatingCubies 为空），cubie 改用 NEW 位置以 static 渲染，视觉无缝衔接。
      onAnimationComplete?.()
    }
  })

  return (
    <group scale={scale}>
      {staticCubies.map(({ c, i }) => (
        <CubieMesh key={i} cubie={c} cubieSize={CUBIE_SIZE} />
      ))}
      {animation && (
        <group ref={groupRef}>
          {rotatingCubies.map(({ c, i }) => (
            <CubieMesh key={i} cubie={c} cubieSize={CUBIE_SIZE} />
          ))}
        </group>
      )}
      {enableControls && (
        <OrbitControls enablePan={false} minDistance={2} maxDistance={20} enableDamping dampingFactor={0.1} />
      )}
    </group>
  )
}

interface Cube3DProps {
  state: CubeState
  pendingMove?: string | null
  onMoveApplied?: () => void
  onMoveStarted?: (move: string) => void
  scale?: number
  height?: string | number
  showControls?: boolean
}

export function Cube3D({
  state,
  pendingMove,
  onMoveApplied,
  onMoveStarted,
  scale = 1,
  height = 480,
  showControls = true,
}: Cube3DProps) {
  const [animation, setAnimation] = useState<AnimationState | null>(null)
  const lastProcessedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pendingMove) return
    if (pendingMove === lastProcessedRef.current) return
    const info = getLayerInfo(state, pendingMove)
    if (!info) return
    lastProcessedRef.current = pendingMove
    onMoveStarted?.(pendingMove)
    setAnimation({
      move: pendingMove,
      startTime: performance.now(),
      duration: 280,
      axis: info.axis,
      layers: info.layers,
      angle: info.angle,
    })
  }, [pendingMove, state, onMoveStarted])

  // pendingMove 清空时 reset lastProcessed（让 parent 能再次触发相同 move）
  useEffect(() => {
    if (!pendingMove) lastProcessedRef.current = null
  }, [pendingMove])

  const handleComplete = useCallback(() => {
    setAnimation(null)
    onMoveApplied?.()
  }, [onMoveApplied])

  // Camera distance by cube size
  const camPos: [number, number, number] = state.size === 2
    ? [2.5, 2.2, 2.8]
    : state.size === 3
    ? [4, 3.5, 4.5]
    : [5.5, 4.8, 6.2]

  return (
    <div style={{ width: '100%', height, position: 'relative' }} className="rounded-lg overflow-hidden bg-cube-bg border border-cube-border">
      <Canvas
        camera={{ position: camPos, fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'radial-gradient(circle at 50% 50%, #13131f 0%, #0a0a14 100%)' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />
        <directionalLight position={[-5, -3, -3]} intensity={0.3} />
        <CubeScene
          state={state}
          animation={animation}
          onAnimationComplete={handleComplete}
          scale={scale}
          enableControls={showControls}
        />
      </Canvas>
    </div>
  )
}

// ---- MiniCube2D: 2D 展开图，自动检测 size ----

interface MiniCube2DProps {
  state?: CubeState
  stickerString?: string
}

export function MiniCube2D({ state, stickerString }: MiniCube2DProps) {
  const s = state ? getStickerString(state) : (stickerString ?? '')
  const size = Math.max(1, Math.round(Math.sqrt(s.length / 6)))
  return (
    <div className="inline-block">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, auto)' }}>
        <div></div>
        <FaceGrid stickerString={s} face="U" size={size} />
        <div></div>
        <div></div>
        <FaceGrid stickerString={s} face="L" size={size} />
        <FaceGrid stickerString={s} face="F" size={size} />
        <FaceGrid stickerString={s} face="R" size={size} />
        <FaceGrid stickerString={s} face="B" size={size} />
        <div></div>
        <FaceGrid stickerString={s} face="D" size={size} />
        <div></div>
        <div></div>
      </div>
    </div>
  )
}

function FaceGrid({ stickerString, face, size }: { stickerString: string; face: import('../cube/state').Face; size: number }) {
  const i = FACE_ORDER.indexOf(face)
  const f = stickerString.slice(i * size * size, (i + 1) * size * size)
  const cell = size === 2 ? 32 : size === 3 ? 18 : 14
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] text-cube-muted mb-1 font-mono">{face}</div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }}>
        {Array.from({ length: size * size }).map((_, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{ width: cell, height: cell, backgroundColor: COLOR_HEX[f[i] as import('../cube/state').Face] }}
          />
        ))}
      </div>
    </div>
  )
}
