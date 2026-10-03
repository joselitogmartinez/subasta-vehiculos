// Prueba de que eslint.config.js detecta de verdad un identificador sin
// declarar. Un verificador que no falla cuando debe no sirve de nada, as
// que aqui se comprueba a proposito.
//
// Uso: node scripts/probar-eslint.mjs

import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ejecutar = promisify(execFile)

const OBJETIVO = path.join(raiz, 'src', 'components', 'PanelPuja.jsx')

console.log('\n=== Prueba del verificador no-undef ===\n')

// 1. El archivo real, que ya fue corregido.
const limpio = await readFile(OBJETIVO, 'utf8')

// Se invoca el entrypoint de ESLint con node, y no el ejecutable
// `eslint` del PATH ni el envoltorio `.cmd` de npm.
//
// En Windows hay tres trampas, y las tres aparecieron:
//   1. execFile no resuelve los envoltorios .cmd que crea npm, asi que
//      `npx` fallaba en silencio desde Node aunque funcionara en la
//      terminal.
//   2. Con shell:true, execFile concatena sin escapar y la ruta del
//      proyecto ("TAREA 2 - SUBASTA VEHICULOS") se parte en el espacio.
//   3. cmd.exe /s /c exige un formato de comillas que Node hacia pasar
//      literalmente.
//
// Llamar a node con la ruta del script resuelve las tres, porque execFile
// pasa cada argumento como uno solo sin interpretarlo.
const ESLINT_JS = path.join(raiz, 'node_modules', 'eslint', 'bin', 'eslint.js')

async function correrEslint() {
  try {
    const { stdout, stderr } = await ejecutar(
      process.execPath,
      [ESLINT_JS, 'src', '--no-warn-ignored'],
      { cwd: raiz },
    )
    return { ok: true, salida: `${stdout}${stderr}` }
  } catch (e) {
    return {
      ok: false,
      salida: `${e.stdout ?? ''}${e.stderr ?? ''}`,
      motivo: e.code ?? e.message,
    }
  }
}

const antes = await correrEslint()
console.log(`  ${antes.ok ? 'OK   ' : 'FALLA'} codigo correcto sin errores`)
if (!antes.ok) {
  console.log(`         motivo: ${antes.motivo}`)
  console.log(`         salida : ${antes.salida.trim().slice(0, 300)}`)
}

// 2. Se reintroduce el bug real que tumbó la página.
const conBug = limpio.replace(
  'const minimoAlcanzado = montoNumerico !== null && montoNumerico >= minimo',
  '',
)

await writeFile(OBJETIVO, conBug, 'utf8')
const durante = await correrEslint()

await writeFile(OBJETIVO, limpio, 'utf8')
const despues = await correrEslint()

const detecto = !durante.ok && /minimoAlcanzado/.test(durante.salida)

console.log(`  ${detecto ? 'OK   ' : 'FALLA'} detecta "minimoAlcanzado" sin declarar`)
if (durante.salida) {
  const linea = durante.salida.split('\n').find((l) => l.includes('minimoAlcanzado'))
  if (linea) console.log(`         ${linea.trim()}`)
}

console.log(`  ${despues.ok ? 'OK   ' : 'FALLA'} archivo restaurado y vuelve a estar limpio`)
console.log(`\n  Archivo intacto: ${(await readFile(OBJETIVO, 'utf8')) === limpio ? 'si' : 'NO'}\n`)

// 3. El segundo bug histórico: useCallback sin importar.
const HOME = path.join(raiz, 'src', 'pages', 'Home.jsx')
const homeLimpio = await readFile(HOME, 'utf8')

await writeFile(
  HOME,
  homeLimpio.replace("import { useCallback, useEffect, useMemo, useState }", "import { useEffect, useMemo, useState }"),
  'utf8',
)
const sinHook = await correrEslint()
await writeFile(HOME, homeLimpio, 'utf8')

const detectoHook = !sinHook.ok && /useCallback/.test(sinHook.salida)
console.log(`  ${detectoHook ? 'OK   ' : 'FALLA'} detecta "useCallback" sin importar`)
console.log(`  ${(await readFile(HOME, 'utf8')) === homeLimpio ? 'OK   ' : 'FALLA'} Home.jsx restaurado\n`)

const todoBien = detecto && detectoHook && antes.ok && despues.ok
console.log(`  ${todoBien ? 'TODO OK' : 'REVISAR'}: el verificador sirve como barrera\n`)
process.exit(todoBien ? 0 : 1)