import { useState, useCallback, useRef } from 'react'
import { Cube3D, MiniCube2D } from '../components/Cube3D'
import { newCube, applyMoveInPlace, parseMoves, isSolved, cloneCube } from '../cube/state'
import { CubeState } from '../cube/state'
import { ALGORITHMS_4X4 } from '../cube/algorithms'

const FACE_MOVES_4X4 = ['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'B', "B'"]
const WIDE_MOVES_4X4 = ['Rw', "Rw'", 'Lw', "Lw'", 'Uw', "Uw'", 'Dw', "Dw'", 'Fw', "Fw'", 'Bw', "Bw'"]

function randomScramble4x4(): string {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B']
  const wide = ['', 'w']
  const modifiers = ['', "'", '2']
  const result: string[] = []
  let lastFace = ''
  for (let i = 0; i < 40; i++) {
    let f = faces[Math.floor(Math.random() * 6)]
    while (f === lastFace) f = faces[Math.floor(Math.random() * 6)]
    lastFace = f
    const w = wide[Math.floor(Math.random() * 2)]
    const m = modifiers[Math.floor(Math.random() * 3)]
    result.push(f + w + m)
  }
  return result.join(' ')
}

export function Cube4x4() {
  const [cube, setCube] = useState<CubeState>(() => newCube(4))
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const queueRef = useRef<string[]>([])
  const currentMoveRef = useRef<string | null>(null)

  const triggerNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      currentMoveRef.current = null
      setPendingMove(null)
      setBusy(false)
      return
    }
    const next = queueRef.current.shift()!
    currentMoveRef.current = next
    setPendingMove(next)
  }, [])

  const onMoveApplied = useCallback(() => {
    const finishedMove = currentMoveRef.current
    if (finishedMove) {
      setCube(c => {
        const nc = cloneCube(c)
        applyMoveInPlace(nc, finishedMove)
        return nc
      })
    }
    triggerNext()
  }, [triggerNext])

  const doMoves = useCallback((ms: string) => {
    const list = parseMoves(ms)
    if (list.length === 0 || busy) return
    setBusy(true)
    queueRef.current = [...list]
    triggerNext()
  }, [busy, triggerNext])

  const doMove = useCallback((m: string) => {
    if (busy) return
    setBusy(true)
    queueRef.current = [m]
    triggerNext()
  }, [busy, triggerNext])

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/4x4</div>
        <h1 className="h1">四阶魔方 (Revenge)</h1>
        <p className="lead">4×4×4 魔方引入了 3×3 没有的概念：<b>奇偶性问题</b>。两组 center（每面 4 个）和两组 edge pair（每条边 2 块），可以独立打乱。</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <Cube3D state={cube} pendingMove={pendingMove} onMoveApplied={onMoveApplied} height={460} />
        <div className="space-y-4">
          <div className="card">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">状态（56 个可视 cubie）</div>
            <MiniCube2D state={cube} />
            <div className="mt-3 text-sm font-mono text-cube-muted">
              步数: 0 · {isSolved(cube) ? '已复原 ✓' : '未复原'}
            </div>
          </div>
          <div className="card">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">单层 (R, U, F, L, D, B)</div>
            <div className="grid grid-cols-4 gap-2">
              {FACE_MOVES_4X4.map(m => (
                <button key={m} className="btn font-mono" onClick={() => doMove(m)} disabled={busy}>{m}</button>
              ))}
            </div>
            <div className="text-xs text-cube-muted mt-3 mb-1 font-mono">双层 wide (Rw, Uw, Fw, ...)</div>
            <div className="grid grid-cols-4 gap-2">
              {WIDE_MOVES_4X4.map(m => (
                <button key={m} className="btn font-mono" onClick={() => doMove(m)} disabled={busy}>{m}</button>
              ))}
            </div>
            <div className="text-xs text-cube-muted mt-2">
              <b>w</b> = wide（双层）。Rw = 同时转 R 和 r（内右层）。
            </div>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">预设</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => doMoves("Rw U2 Rw2 U2 Rw U2 Rw2 U2 Rw2 U2 Rw2 U2")} disabled={busy}>OLL parity (示意)</button>
          <button className="btn" onClick={() => doMoves("r2 U2 r2 Uw2 r2 Uw2 U2")} disabled={busy}>PLL parity (示意)</button>
          <button className="btn" onClick={() => doMoves(randomScramble4x4())} disabled={busy}>随机打乱</button>
          <button className="btn-ghost" onClick={() => { setCube(newCube(4)); setPendingMove(null); setBusy(false); queueRef.current = []; currentMoveRef.current = null }}>↺ 重置</button>
        </div>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">奇偶性问题（核心概念）</h2>
        <p className="text-cube-text/90 leading-relaxed mb-3">
          3 阶魔方有个定理：<b>角块置换的奇偶性 = 棱块置换的奇偶性</b>。所以单角互换永远不可能，需要换两个角（一个 3-cycle）。
        </p>
        <p className="text-cube-text/90 leading-relaxed mb-3">
          4 阶魔方打破了这条约束，因为它有：
        </p>
        <ul className="space-y-1 text-cube-text/90 ml-6 list-disc leading-relaxed">
          <li><b>24 个 center</b>（每面 4 个），可独立排列</li>
          <li><b>24 个 wing edge</b>（外层棱块）+ <b>24 个 wing center</b>（中层）</li>
        </ul>
        <p className="text-cube-text/90 leading-relaxed mt-3">
          结果是 4 阶可能出现 <b>仅有一对 wing edge 需要互换</b> 的状态（PLL parity），或 <b>仅有一个 single edge 需要翻转</b>（OLL parity）。这两种状态在 3 阶里不可能存在。
        </p>
        <p className="text-cube-text/90 leading-relaxed mt-3">
          解法：CFOP 公式做完后，如果出现 PLL parity，跑 PLL parity 算法；如果出现 OLL parity，跑 OLL parity 算法。
        </p>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">4×4 群论特点</h2>
        <ul className="space-y-1 text-cube-text/90 leading-relaxed">
          <li>· 群阶 = 8! × 3⁷ × 24! × 2²⁴ / 24 ≈ 7.4 × 10⁴⁵</li>
          <li>· 状态空间比 3 阶大约 10²⁶ 倍</li>
          <li>· God Number ≈ 31（更复杂的最优解问题）</li>
          <li>· 没有固定中心（每面 4 个），所以可以"转动中心"</li>
          <li>· 单 edge 翻转（OLL parity）= 中间层两块的奇偶错位</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="h3 mb-3">公式示例</h2>
        <div className="space-y-3">
          {ALGORITHMS_4X4.map(algo => (
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
        <div className="text-xs text-cube-muted mt-3">
          注：4×4 公式涉及 wide moves (Rw, Uw 等)。
        </div>
      </section>
    </div>
  )
}
