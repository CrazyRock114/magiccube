// probe kociemba D face formula
import { Cube as KCube, init } from 'kociemba-wasm'
import { newCube, applyMoveInPlace, parseMoves, getStickerString } from './src/cube/state'

await init()

// 应用 R U R' F' 让 D face 变化
const kc = new KCube()
kc.action('R')
kc.action('U')
kc.action("R'")
kc.action("F'")
const kStr = kc.toString()
console.log('kociemba:', kStr)

const s = newCube(3)
for (const m of parseMoves("R U R' F'")) applyMoveInPlace(s, m)
const myStr = getStickerString(s)
console.log('mine   :', myStr)

if (kStr !== myStr) {
  console.log('差异位置:')
  for (let i = 0; i < 54; i++) {
    if (kStr[i] !== myStr[i]) {
      const face = ['U', 'R', 'F', 'D', 'L', 'B'][Math.floor(i / 9)]
      const pos = i % 9
      console.log(`  pos ${i} (${face}${pos}): kociemba=${kStr[i]} mine=${myStr[i]}`)
    }
  }
}
