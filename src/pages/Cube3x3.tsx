import { useState, useRef, useCallback } from 'react'
import { Cube3D, MiniCube2D } from '../components/Cube3D'
import { newCube, applyMoveInPlace, getStickerString, isSolved, parseMoves, invertMoves, cloneCube } from '../cube/state'
import { CubeState } from '../cube/state'

const FACE_MOVES = ['U', "U'", 'D', "D'", 'R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"]
const SCRAMBLE_PRESETS = [
  { label: 'Easiest', moves: "R U R' U'" },
  { label: 'Easy', moves: "R U R' F' R U R' U' R' F R2 U'" },
  { label: 'Sune + Anti-Sune', moves: "R U R' U R U2 R' L' U' L U' L' U2 L" },
  { label: 'T-Perm', moves: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { label: 'Random 20', moves: "" },
]

function randomScramble(): string {
  const faces = ['U', 'D', 'R', 'L', 'F', 'B']
  const modifiers = ['', "'", '2']
  const result: string[] = []
  let lastFace = ''
  for (let i = 0; i < 20; i++) {
    let f = faces[Math.floor(Math.random() * 6)]
    while (f === lastFace) f = faces[Math.floor(Math.random() * 6)]
    lastFace = f
    const m = modifiers[Math.floor(Math.random() * 3)]
    result.push(f + m)
  }
  return result.join(' ')
}

export function Cube3x3() {
  const [cube, setCube] = useState<CubeState>(() => newCube(3))
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const [moveLog, setMoveLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  // 重要：state 在动画开始时**不变** — 由 Cube3D 的 group rotation 推动 cubie 视觉转动。
  // 只有动画结束 (onMoveApplied) 才把当前 move apply 到 state 上。
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

  const doMove = useCallback((m: string) => {
    if (busy) return
    setBusy(true)
    setMoveLog(log => [...log, m])
    queueRef.current = [m]
    triggerNext()
  }, [busy, triggerNext])

  const onMoveApplied = useCallback(() => {
    // 动画结束：把刚播完的 move apply 到 state
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
    if (list.length === 0) return
    if (busy) return
    setBusy(true)
    setMoveLog(log => [...log, ...list])
    queueRef.current = [...list]
    triggerNext()
  }, [busy, triggerNext])

  const reset = () => {
    setCube(newCube(3))
    setMoveLog([])
    setPendingMove(null)
    setBusy(false)
    queueRef.current = []
    currentMoveRef.current = null
  }

  const invert = () => {
    if (moveLog.length === 0) return
    const inv = invertMoves(moveLog.join(' '))
    doMoves(inv)
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/3x3</div>
        <h1 className="h1">三阶魔方</h1>
        <p className="lead">3.4 cm × 3.4 cm × 3.4 cm 物理尺寸的 3×3×3，状态空间 4.3 × 10¹⁹。下面你可以旋转、打乱、回退、看每步效果。</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <Cube3D
            state={cube}
            pendingMove={pendingMove}
            onMoveApplied={onMoveApplied}
            height={460}
          />
        </div>
        <div className="space-y-4">
          <div className="card">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">当前状态</div>
            <MiniCube2D state={cube} />
            <div className="mt-3 text-sm font-mono text-cube-muted">
              步数: <span className="text-cube-text">{moveLog.length}</span> · {isSolved(cube) ? '已复原 ✓' : '未复原'}
            </div>
          </div>
          <div className="card">
            <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">单步转动</div>
            <div className="grid grid-cols-4 gap-2">
              {FACE_MOVES.map(m => (
                <button key={m} className="btn font-mono" onClick={() => doMove(m)} disabled={busy}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">预设公式</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {SCRAMBLE_PRESETS.map(s => (
            <button
              key={s.label}
              className="btn"
              onClick={() => doMoves(s.label === 'Random 20' ? randomScramble() : s.moves)}
              disabled={busy}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={reset} disabled={busy}>↺ 重置</button>
          <button className="btn-ghost" onClick={invert} disabled={busy || moveLog.length === 0}>↶ 撤销</button>
        </div>
      </section>

      <section className="card">
        <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">自定义公式</div>
        <CustomScrambleInput onSubmit={doMoves} disabled={busy} />
      </section>

      <section className="card">
        <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">历史</div>
        <div className="font-mono text-sm break-all text-cube-text/80">
          {moveLog.length === 0 ? <span className="text-cube-muted">（空）</span> : moveLog.join(' ')}
        </div>
      </section>
    </div>
  )
}

function CustomScrambleInput({ onSubmit, disabled }: { onSubmit: (s: string) => void; disabled: boolean }) {
  const [val, setVal] = useState('')
  return (
    <form
      onSubmit={e => { e.preventDefault(); if (val.trim()) { onSubmit(val); setVal('') } }}
      className="flex gap-2"
    >
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="例如 R U R' U' R' F R2 U' R' U' R U R' F'"
        className="flex-1 bg-cube-bg border border-cube-border rounded px-3 py-2 font-mono text-sm text-cube-text placeholder:text-cube-muted/50 focus:border-cube-accent focus:outline-none"
        disabled={disabled}
      />
      <button type="submit" className="btn-primary" disabled={disabled || !val.trim()}>播放</button>
    </form>
  )
}
