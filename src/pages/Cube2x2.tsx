import { useState, useRef, useCallback } from 'react'
import { Cube3D, MiniCube2D } from '../components/Cube3D'
import { CubeModel, newCube, applyMove, applyMoves, getStickerString, fromStickerString, parseMoves, isSolved } from '../cube/state'
import { ALGORITHMS_2X2 } from '../cube/algorithms'

const FACE_MOVES_2X2 = ['R', "R'", 'U', "U'", 'F', "F'", 'L', "L'", 'D', "D'", 'B', "B'"]

function randomScramble2x2(): string {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B']
  const modifiers = ['', "'"]
  const result: string[] = []
  let lastFace = ''
  for (let i = 0; i < 10; i++) {
    let f = faces[Math.floor(Math.random() * 6)]
    while (f === lastFace) f = faces[Math.floor(Math.random() * 6)]
    lastFace = f
    const m = modifiers[Math.floor(Math.random() * 2)]
    result.push(f + m)
  }
  return result.join(' ')
}

export function Cube2x2() {
  const [cube, setCube] = useState<CubeModel>(newCube())
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const queueRef = useRef<string[]>([])

  const stickerString = getStickerString(cube)

  const onMoveApplied = useCallback(() => {
    setPendingMove(null)
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!
      setCube(c => {
        const nc = fromStickerString(getStickerString(c))
        applyMove(nc, next)
        return nc
      })
      setPendingMove(next)
    }
  }, [])

  const doMoves = (ms: string) => {
    const list = parseMoves(ms)
    if (list.length === 0 || busy) return
    setBusy(true)
    queueRef.current = [...list]
    const first = queueRef.current.shift()!
    setCube(c => {
      const nc = fromStickerString(getStickerString(c))
      applyMove(nc, first)
      return nc
    })
    setPendingMove(first)
  }

  const doMove = (m: string) => {
    if (busy) return
    setBusy(true)
    setCube(c => {
      const nc = fromStickerString(getStickerString(c))
      applyMove(nc, m)
      return nc
    })
    setPendingMove(m)
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/2x2</div>
        <h1 className="h1">二阶魔方 (Pocket Cube)</h1>
        <p className="lead">只有 8 个角块，没有棱块和中心。状态空间 3,674,160（≈ 3.7 × 10⁶），比 3 阶小了 13 个数量级。</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <Cube3D stickerString={stickerString} pendingMove={pendingMove} onMoveApplied={onMoveApplied} height={420} />
        <div className="space-y-4">
          <div className="card">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">状态</div>
            <MiniCube2D stickerString={stickerString} />
            <div className="mt-3 text-sm font-mono text-cube-muted">{isSolved(cube) ? '已复原 ✓' : '未复原'}</div>
          </div>
          <div className="card">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">单步</div>
            <div className="grid grid-cols-4 gap-2">
              {FACE_MOVES_2X2.map(m => (
                <button key={m} className="btn font-mono" onClick={() => doMove(m)} disabled={busy}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">预设</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => doMoves("R U R' U' R' F R2 U' R' U' R U R' F'")} disabled={busy}>T-perm</button>
          <button className="btn" onClick={() => doMoves(randomScramble2x2())} disabled={busy}>随机打乱</button>
          <button className="btn-ghost" onClick={() => { setCube(newCube()); setPendingMove(null); setBusy(false); queueRef.current = [] }}>↺ 重置</button>
        </div>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">2×2 群论特点</h2>
        <ul className="space-y-2 text-cube-text/90 leading-relaxed">
          <li>· 群阶 = 8! × 3⁷ / 3 = 3,674,160（角块排列 8! × 方向 3⁸，但整体可旋转 3 轴 24 = 3 × 2¹¹ 但实际除以 3 因为整体方向不影响）</li>
          <li>· 没有奇偶性问题（无棱块置换，所有置换都满足奇偶约束）</li>
          <li>· 任何状态可在 ≤ 11 步（face turn metric, FTM）内复原</li>
          <li>· 二阶的 OLL = 顶面定向（没有 PLL 概念，因为没有棱块定位问题），但有 PBL（Permute Both Layers）</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">2×2 公式</h2>
        <div className="space-y-3">
          {ALGORITHMS_2X2.map(algo => (
            <div key={algo.name} className="border-t border-cube-border pt-3 first:border-0 first:pt-0">
              <div className="flex items-start justify-between mb-1">
                <div className="font-semibold text-sm">{algo.name}</div>
                <div className="text-xs text-cube-accent font-mono">{algo.group}</div>
              </div>
              <div className="font-mono text-sm text-cube-text/80 mb-1">{algo.notation}</div>
              <div className="text-xs text-cube-muted">{algo.description}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
