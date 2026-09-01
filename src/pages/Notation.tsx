import { Cube3D, MiniCube2D } from '../components/Cube3D'
import { newCube, applyMoveInPlace, getStickerString, cloneCube } from '../cube/state'
import { CubeState } from '../cube/state'
import { useState } from 'react'

const FACES = [
  { code: 'U', name: 'Up', cn: '上', color: '#f5f5f5', textColor: '#0a0a14', desc: '顶面（朝上）' },
  { code: 'D', name: 'Down', cn: '下', color: '#ffd500', textColor: '#0a0a14', desc: '底面（朝下）' },
  { code: 'R', name: 'Right', cn: '右', color: '#b71234', textColor: '#fff', desc: '右面（朝右）' },
  { code: 'L', name: 'Left', cn: '左', color: '#ff5900', textColor: '#0a0a14', desc: '左面（朝左）' },
  { code: 'F', name: 'Front', cn: '前', color: '#009b48', textColor: '#fff', desc: '前面（朝你）' },
  { code: 'B', name: 'Back', cn: '后', color: '#0046ad', textColor: '#fff', desc: '后面（朝背）' },
]

export function Notation() {
  const [demo, setDemo] = useState<CubeState>(() => newCube(3))
  const [pendingMove, setPendingMove] = useState<string | null>(null)

  const showMove = (m: string) => {
    const c = newCube(3)
    applyMoveInPlace(c, m)
    setDemo(c)
    setPendingMove(m)
  }

  const onMoveApplied = () => setPendingMove(null)

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/3x3/notation</div>
        <h1 className="h1">Singmaster 记号</h1>
        <p className="lead">所有公式都用这套 6 个字母 + 修饰符写。理解记号 = 看得懂任何公式。</p>
      </header>

      <section className="card">
        <h2 className="h2 mb-3">六个面</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {FACES.map(f => (
            <div key={f.code} className="flex items-center gap-3 p-3 rounded border border-cube-border bg-cube-bg/50">
              <div
                className="w-10 h-10 rounded font-mono font-bold text-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: f.color, color: f.textColor }}
              >{f.code}</div>
              <div className="text-sm">
                <div className="font-semibold">{f.cn} · {f.name}</div>
                <div className="text-cube-muted text-xs">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">修饰符</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cube-muted text-xs uppercase">
              <th className="text-left p-2">写法</th>
              <th className="text-left p-2">含义</th>
              <th className="text-left p-2">阶（重复几次回到原状）</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr className="border-t border-cube-border">
              <td className="p-2"><span className="pill-move bg-cube-bg text-cube-text">F</span></td>
              <td className="p-2">顺时针 90°（看这个面）</td>
              <td className="p-2">4</td>
            </tr>
            <tr className="border-t border-cube-border">
              <td className="p-2"><span className="pill-move bg-cube-bg text-cube-text">F'</span></td>
              <td className="p-2">逆时针 90°（看这个面）</td>
              <td className="p-2">4</td>
            </tr>
            <tr className="border-t border-cube-border">
              <td className="p-2"><span className="pill-move bg-cube-bg text-cube-text">F2</span></td>
              <td className="p-2">180°</td>
              <td className="p-2">2</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">怎么判定顺时针？</h2>
        <p className="text-cube-text/90 leading-relaxed">
          <b>看着这个面</b>（不是看魔方的整体）。例如 R 是你看着右面顺时针转 90°；
          B 是你看着后面（从背面看）顺时针转 90°，不是从前看。
        </p>
        <p className="text-cube-text/90 leading-relaxed mt-3">
          <b>关键陷阱</b>：对面（D、L、B）的 CW 方向是反的。例：D 顺时针看着下面 = 上面看着是 CCW。
          公式里 6 个面写哪个就是转哪个，不存在"全局 CW"。
        </p>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">交互演示：每个面转一下会变什么</h2>
        <p className="text-sm text-cube-muted mb-4">点下面按钮看具体转动的效果（高亮 9 个受影响 sticker）。</p>
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <Cube3D state={demo} pendingMove={pendingMove} onMoveApplied={onMoveApplied} height={360} />
          </div>
          <div>
            <div className="grid grid-cols-3 gap-2">
              {FACES.map(f => (
                <button
                  key={f.code}
                  className="btn font-mono"
                  onClick={() => showMove(f.code)}
                  style={{ borderLeft: `4px solid ${f.color}` }}
                >
                  {f.code}
                </button>
              ))}
              {FACES.map(f => (
                <button
                  key={f.code + "'"}
                  className="btn font-mono"
                  onClick={() => showMove(f.code + "'")}
                  style={{ borderLeft: `4px solid ${f.color}` }}
                >
                  {f.code}'
                </button>
              ))}
              {FACES.map(f => (
                <button
                  key={f.code + '2'}
                  className="btn font-mono"
                  onClick={() => showMove(f.code + '2')}
                  style={{ borderLeft: `4px solid ${f.color}` }}
                >
                  {f.code}2
                </button>
              ))}
            </div>
            <div className="mt-4">
              <MiniCube2D state={demo} />
            </div>
            <div className="mt-3 text-xs text-cube-muted font-mono">
              当前执行: {pendingMove || '（无）'}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="h2 mb-3">广义的"slice" / "wide" 转动</h2>
        <p className="text-cube-text/90 leading-relaxed">
          公式里偶尔会看到小写 <span className="font-mono text-cube-accent">r</span>、
          <span className="font-mono text-cube-accent">u</span> 等。这是"双层转动"——同时转两层。
          大写 = 单层，小写 = 双层。<span className="font-mono">M</span>（middle）= 中间一层平行于 R/L 方向转。
          <span className="font-mono">S</span>（standing）= 中间一层平行于 F/B 方向转。<span className="font-mono">E</span>（equator）= 中间一层平行于 U/D 方向转。
        </p>
        <p className="text-sm text-cube-muted mt-3">
          CFOP 高阶公式和 WCA 比赛里这些都是常见扩展。
        </p>
      </section>
    </div>
  )
}
