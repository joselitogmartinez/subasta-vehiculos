// Comprueba que todo hook de React usado en un archivo este importado.
//
// El fallo que tumbó el sitio desplegado fue un useCallback sin
// importar: el build no falla, lint no lo marca y el error solo aparece
// cuando el componente se ejecuta en el navegador. Esta verificacion
// cubre esa clase de fallo de forma estatica.

import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dirSrc = path.join(raiz, 'src')

const HOOKS = [
  'useState',
  'useEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useContext',
  'useReducer',
  'useId',
  'useSyncExternalStore',
]

const errores = []
let revisados = 0

async function recorrer(dir) {
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const completa = path.join(dir, entrada.name)
    if (entrada.isDirectory()) {
      await recorrer(completa)
      continue
    }
    if (!/\.(jsx|js)$/.test(entrada.name)) continue

    const codigo = await readFile(completa, 'utf8')
    revisados++

    // Hooks que aparecen usados dentro del archivo.
    const usados = HOOKS.filter((hook) => {
      const usos = codigo.match(new RegExp(`\\b${hook}\\s*\\(`, 'g'))
      return usos && usos.length > 0
    })

    if (usados.length === 0) continue

    // Hooks que efectivamente llegan por un import desde 'react'.
    const desdeReact = codigo.match(/import\s*\{([^}]*)\}\s*from\s*['"]react['"]/s)
    const importados = desdeReact
      ? desdeReact[1]
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0])
          .filter(Boolean)
      : []

    // Hooks propios del proyecto (useAuth, useAhora, useSubastaEnVivo...).
    const otrosHooks = [...codigo.matchAll(/import\s*\{([^}]*)\}\s*from/g)].flatMap((m) =>
      m[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('use')),
    )

    for (const hook of usados) {
      const estaImportado = importados.includes(hook) || otrosHooks.includes(hook)
      if (!estaImportado) {
        errores.push({
          archivo: path.relative(raiz, completa),
          hook,
          linea: codigo.split('\n').findIndex((l) => new RegExp(`\\b${hook}\\s*\\(`).test(l)) + 1,
        })
      }
    }
  }
}

await recorrer(dirSrc)

console.log(`\n=== Verificacion de imports de hooks ===\n`)
console.log(`  ${revisados} archivos revisados`)

if (errores.length === 0) {
  console.log('\n  OK: todos los hooks usados estan importados\n')
  process.exit(0)
}

console.log(`\n  ${errores.length} hook(s) usado(s) sin importar:\n`)
for (const e of errores) {
  console.log(`  FALLA  ${e.archivo}:${e.linea}  falta ${e.hook}`)
}
console.log('')
process.exit(1)