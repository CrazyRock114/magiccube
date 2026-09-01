import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Home } from './pages/Home'
import { Cube3x3 } from './pages/Cube3x3'
import { Notation } from './pages/Notation'
import { AlgorithmViz } from './pages/AlgorithmViz'
import { GraphTheory } from './pages/GraphTheory'
import { Cube2x2 } from './pages/Cube2x2'
import { Cube4x4 } from './pages/Cube4x4'
import { OtherShapes } from './pages/OtherShapes'

const NAV = [
  { to: '/', label: '首页', desc: '总览' },
  { to: '/3x3', label: '三阶', desc: '标准 3×3 教学' },
  { to: '/3x3/notation', label: '记号', desc: 'Singmaster 记号系统' },
  { to: '/3x3/algos', label: '公式', desc: 'CFOP 可视化拆解' },
  { to: '/3x3/graph', label: '图论', desc: 'Cayley 图与群论视角' },
  { to: '/2x2', label: '二阶', desc: 'Pocket Cube' },
  { to: '/4x4', label: '四阶', desc: '奇偶性问题' },
  { to: '/shapes', label: '异形', desc: 'Skewb / Pyraminx / Megaminx' },
]

function Sidebar() {
  const loc = useLocation()
  return (
    <aside className="w-60 shrink-0 border-r border-cube-border bg-cube-panel/40 p-4 hidden md:flex md:flex-col gap-1">
      <div className="text-xl font-bold mb-4 tracking-tight">
        <span className="text-cube-accent">M</span>agic<span className="text-cube-accent">C</span>ube
      </div>
      <div className="text-[10px] text-cube-muted uppercase tracking-widest mb-2 px-2">导航</div>
      {NAV.map(n => {
        const active = loc.pathname === n.to
        return (
          <Link
            key={n.to}
            to={n.to}
            className={`flex flex-col px-3 py-2 rounded text-sm transition-colors ${
              active ? 'bg-cube-accent/20 text-cube-text border-l-2 border-cube-accent'
                     : 'text-cube-muted hover:text-cube-text hover:bg-cube-bg border-l-2 border-transparent'
            }`}
          >
            <span className="font-semibold">{n.label}</span>
            <span className="text-[10px] text-cube-muted/80">{n.desc}</span>
          </Link>
        )
      })}
      <div className="mt-auto text-[10px] text-cube-muted/60 px-2 leading-relaxed">
        <p>基于 R3F + cubejs</p>
        <p className="mt-1">教学 · 可视化 · 图论</p>
      </div>
    </aside>
  )
}

function MobileNav() {
  const loc = useLocation()
  return (
    <div className="md:hidden border-b border-cube-border bg-cube-panel/60 px-3 py-2 overflow-x-auto whitespace-nowrap">
      <div className="flex gap-2 text-xs">
        {NAV.map(n => {
          const active = loc.pathname === n.to
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-1.5 rounded font-mono ${
                active ? 'bg-cube-accent text-white' : 'text-cube-muted hover:text-cube-text'
              }`}
            >
              {n.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/3x3" element={<Cube3x3 />} />
          <Route path="/3x3/notation" element={<Notation />} />
          <Route path="/3x3/algos" element={<AlgorithmViz />} />
          <Route path="/3x3/graph" element={<GraphTheory />} />
          <Route path="/2x2" element={<Cube2x2 />} />
          <Route path="/4x4" element={<Cube4x4 />} />
          <Route path="/shapes" element={<OtherShapes />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
