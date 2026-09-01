// 3D 魔方组件
import { useRef, useState, useEffect, useMemo, useCallback, JSX } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Face, COLOR_HEX, FACE_ORDER, faceOf } from '../cube/state'

const CUBIE_SIZE = 0.95
const STICKER_INSET = 0.06

function stickerPos(face: Face, pos: number): [number, number, number] {
  const col = pos % 3
  const row = Math.floor(pos / 3)
  const x = col - 1
  const y = 1 - row
  switch (face) {
    case 'U': return [x, 1, -y]
    case 'D': return [x, -1, y]
    case 'F': return [x, y, 1]
    case 'B': return [-x, y, -1]
    case 'L': return [-1, y, x]
    case 'R': return [1, y, -x]
  }
}

function faceRotation(face: Face): [number, number, number] {
  switch (face) {
    case 'U': return [-Math.PI / 2, 0, 0]
    case 'D': return [Math.PI / 2, 0, 0]
    case 'F': return [0, 0, 0]
    case 'B': return [0, Math.PI, 0]
    case 'L': return [0, -Math.PI / 2, 0]
    case 'R': return [0, Math.PI / 2, 0]
  }
}

interface CubieColors { U: Face | 0; D: Face | 0; F: Face | 0; B: Face | 0; L: Face | 0; R: Face | 0 }

function parseStickerString(s: string): Record<string, CubieColors> {
  const result: Record<string, CubieColors> = {}
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const key = `${x},${y},${z}`
        result[key] = { U: 0, D: 0, F: 0, B: 0, L: 0, R: 0 }
      }
  for (const face of FACE_ORDER) {
    const f = faceOf(s, face)
    for (let pos = 0; pos < 9; pos++) {
      const [x, y, z] = stickerPos(face, pos)
      const key = `${x},${y},${z}`
      if (result[key]) result[key][face] = f[pos] as Face
    }
  }
  return result
}

function Cubie({ position, colors }: { position: [number, number, number]; colors: CubieColors }) {
  const stickers: JSX.Element[] = []
  for (const face of FACE_ORDER) {
    const color = colors[face]
    if (color === 0) continue
    const [nx, ny, nz] = [0, 0, 0]
    let ox = 0, oy = 0, oz = 0
    if (face === 'U') oy = 1; if (face === 'D') oy = -1
    if (face === 'F') oz = 1; if (face === 'B') oz = -1
    if (face === 'L') ox = -1; if (face === 'R') ox = 1
    const offset = 0.5 + STICKER_INSET
    const stickerPos3D: [number, number, number] = [
      position[0] + ox * offset,
      position[1] + oy * offset,
      position[2] + oz * offset,
    ]
    const rot = faceRotation(face)
    stickers.push(
      <mesh key={face} position={stickerPos3D} rotation={rot}>
        <planeGeometry args={[CUBIE_SIZE * 0.92, CUBIE_SIZE * 0.92]} />
        <meshStandardMaterial color={COLOR_HEX[color]} roughness={0.4} metalness={0.1} />
      </mesh>
    )
  }
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
        <meshStandardMaterial color="#0a0a14" roughness={0.6} metalness={0.3} />
      </mesh>
      {stickers}
    </group>
  )
}

function getLayerAxis(move: string): { axis: 'x' | 'y' | 'z'; layer: number; angle: number } | null {
  const face = move[0] as Face
  const isPrime = move.includes("'")
  const isDouble = move.includes('2')
  const sign = isPrime ? 1 : -1
  const baseAngle = (isDouble ? Math.PI : Math.PI / 2) * sign
  let axis: 'x' | 'y' | 'z'
  let layer: number
  let angle = baseAngle
  switch (face) {
    case 'U': axis = 'y'; layer = 1; break
    case 'D': axis = 'y'; layer = -1; break
    case 'F': axis = 'z'; layer = 1; break
    case 'B': axis = 'z'; layer = -1; break
    case 'R': axis = 'x'; layer = 1; break
    case 'L': axis = 'x'; layer = -1; break
    default: return null
  }
  return { axis, layer, angle }
}

function isInLayer(pos: [number, number, number], axis: 'x' | 'y' | 'z', layer: number): boolean {
  const v = pos[axis === 'x' ? 0 : axis === 'y' ? 1 : 2]
  return Math.abs(v - layer) < 0.5
}

interface AnimationState {
  move: string
  startTime: number
  duration: number
  axis: 'x' | 'y' | 'z'
  layer: number
  angle: number
}

interface CubeSceneProps {
  stickerString: string
  animation: AnimationState | null
  onAnimationComplete?: () => void
  scale?: number
  enableControls?: boolean
}

function CubeScene({ stickerString, animation, onAnimationComplete, scale = 1, enableControls = true }: CubeSceneProps) {
  const colors = useMemo(() => parseStickerString(stickerString), [stickerString])
  const animationGroupRef = useRef<THREE.Group>(null)
  const animStateRef = useRef<AnimationState | null>(animation)
  const completedRef = useRef(false)

  useEffect(() => {
    if (animation) {
      animStateRef.current = animation
      completedRef.current = false
      if (animationGroupRef.current) animationGroupRef.current.rotation.set(0, 0, 0)
    }
  }, [animation])

  const cubies = useMemo(() => {
    const list: Array<{ pos: [number, number, number]; colors: CubieColors }> = []
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const key = `${x},${y},${z}`
          list.push({ pos: [x, y, z] as [number, number, number], colors: colors[key] })
        }
    return list
  }, [colors])

  const animatingCubies = useMemo(() => {
    if (!animation) return []
    return cubies.filter(c => isInLayer(c.pos, animation.axis, animation.layer))
  }, [cubies, animation])

  const staticCubies = useMemo(() => {
    if (!animation) return cubies
    return cubies.filter(c => !isInLayer(c.pos, animation.axis, animation.layer))
  }, [cubies, animation])

  useFrame((state) => {
    if (!animStateRef.current) return
    const anim = animStateRef.current
    const now = state.clock.getElapsedTime() * 1000
    const elapsed = now - anim.startTime
    const t = Math.min(1, elapsed / anim.duration)
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const angle = ease * anim.angle
    if (animationGroupRef.current) {
      animationGroupRef.current.rotation.set(0, 0, 0)
      if (anim.axis === 'x') animationGroupRef.current.rotation.x = angle
      if (anim.axis === 'y') animationGroupRef.current.rotation.y = angle
      if (anim.axis === 'z') animationGroupRef.current.rotation.z = angle
    }
    if (t >= 1 && !completedRef.current) {
      completedRef.current = true
      if (animationGroupRef.current) animationGroupRef.current.rotation.set(0, 0, 0)
      animStateRef.current = null
      onAnimationComplete?.()
    }
  })

  return (
    <group scale={scale}>
      {staticCubies.map((c, i) => (
        <Cubie key={`s-${c.pos.join(',')}-${i}`} position={c.pos} colors={c.colors} />
      ))}
      {animation && (
        <group ref={animationGroupRef}>
          {animatingCubies.map((c, i) => (
            <Cubie key={`a-${c.pos.join(',')}-${i}`} position={c.pos} colors={c.colors} />
          ))}
        </group>
      )}
      {enableControls && (
        <OrbitControls enablePan={false} minDistance={4} maxDistance={10} enableDamping dampingFactor={0.1} />
      )}
    </group>
  )
}

interface Cube3DProps {
  stickerString: string
  pendingMove?: string | null
  onMoveApplied?: () => void
  onMoveStarted?: (move: string) => void
  scale?: number
  height?: string | number
  showControls?: boolean
}

export function Cube3D({
  stickerString,
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
    if (!pendingMove || pendingMove === lastProcessedRef.current) return
    const animInfo = getLayerAxis(pendingMove)
    if (!animInfo) return
    lastProcessedRef.current = pendingMove
    onMoveStarted?.(pendingMove)
    setAnimation({
      move: pendingMove,
      startTime: performance.now(),
      duration: 280,
      axis: animInfo.axis,
      layer: animInfo.layer,
      angle: animInfo.angle,
    })
  }, [pendingMove, onMoveStarted])

  const handleComplete = useCallback(() => {
    setAnimation(null)
    onMoveApplied?.()
  }, [onMoveApplied])

  return (
    <div style={{ width: '100%', height, position: 'relative' }} className="rounded-lg overflow-hidden bg-cube-bg border border-cube-border">
      <Canvas
        camera={{ position: [4, 3.5, 4.5], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'radial-gradient(circle at 50% 50%, #13131f 0%, #0a0a14 100%)' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />
        <directionalLight position={[-5, -3, -3]} intensity={0.3} />
        <CubeScene
          stickerString={stickerString}
          animation={animation}
          onAnimationComplete={handleComplete}
          scale={scale}
          enableControls={showControls}
        />
      </Canvas>
    </div>
  )
}

export function MiniCube2D({ stickerString }: { stickerString: string }) {
  return (
    <div className="inline-block">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, auto)' }}>
        <div></div>
        <FaceGrid stickerString={stickerString} face="U" label="U" />
        <div></div>
        <div></div>
        <FaceGrid stickerString={stickerString} face="L" label="L" />
        <FaceGrid stickerString={stickerString} face="F" label="F" />
        <FaceGrid stickerString={stickerString} face="R" label="R" />
        <FaceGrid stickerString={stickerString} face="B" label="B" />
        <div></div>
        <FaceGrid stickerString={stickerString} face="D" label="D" />
        <div></div>
        <div></div>
      </div>
    </div>
  )
}

function FaceGrid({ stickerString, face, label }: { stickerString: string; face: Face; label: string }) {
  const f = faceOf(stickerString, face)
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] text-cube-muted mb-1 font-mono">{label}</div>
      <div className="grid grid-cols-3 gap-[2px] w-14 h-14">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-sm"
            style={{ backgroundColor: COLOR_HEX[f[i] as Face] }}
          />
        ))}
      </div>
    </div>
  )
}
