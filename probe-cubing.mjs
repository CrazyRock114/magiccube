import { cube3x3x3 } from 'cubing/puzzles'
import { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search'

const kp = await cube3x3x3.kpuzzle()
const solved = KPuzzle.prototype.defaultPattern.call(kp)

// Test edge slot order
for (const move of ['R', 'U', 'F', 'L', 'D', 'B']) {
  const after = solved.applyMove(move)
  const changed = []
  for (let i = 0; i < 12; i++) {
    if (after.patternData.EDGES.pieces[i] !== i || after.patternData.EDGES.orientation[i] !== 0) {
      changed.push(`E${i}=P${after.patternData.EDGES.pieces[i]}(o${after.patternData.EDGES.orientation[i]})`)
    }
  }
  console.log(`${move}: ${changed.join(', ')}`)
}
