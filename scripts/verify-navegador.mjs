// Carga el build de produccion en un navegador real de verdad y
// comprueba que React pinte algo. Sin esto, un import faltante pasa el
// lint, pasa el build y deja el sitio en blanco en produccion: el error
// solo existe cuando el codigo se ejecuta.
//
// Uso: node scripts/verify-navegador.mjs

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dist = path.join(raiz, 'dist')
const PUERTO = 4177

const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

// Servidor estatico con el mismo comportamiento que un host de SPA:
// cualquier ruta desconocida devuelve index.html.
const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`)
  let archivo = path.join(dist, decodeURIComponent(url.pathname))

  try {
    const info = await stat(archivo)
    if (info.isDirectory()) archivo = path.join(archivo, 'index.html')
  } catch {
    archivo = path.join(dist, 'index.html')
  }

  try {
    const cuerpo = await readFile(archivo)
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] ?? 'application/octet-stream' })
    res.end(cuerpo)
  } catch {
    res.writeHead(404).end('no encontrado')
  }
})

await new Promise((r) => servidor.listen(PUERTO, r))
console.log(`\n=== Verificacion en navegador real ===\n  servidor local en :${PUERTO}\n`)

const perfil = path.join(raiz, '.tmp-chrome-perfil')
const destino = `http://localhost:${PUERTO}/`

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=${perfil}`,
    '--virtual-time-budget=9000',
    '--dump-dom',
    destino,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)

let salida = ''
let errores = ''
chrome.stdout.on('data', (d) => (salida += d.toString()))
chrome.stderr.on('data', (d) => (errores += d.toString()))

const codigo = await new Promise((resolve) => {
  chrome.on('close', resolve)
  setTimeout(() => {
    chrome.kill()
    resolve('timeout')
  }, 60000)
})

servidor.close()

if (codigo === 'timeout') {
  console.log('  FALLO  el navegador no termino a tiempo\n')
  process.exit(1)
}

const html = salida

// Un error de JavaScript deja <div id="root"></div> vacio.
const raizVacia = /<div id="root"><\/div>/.test(html)
const largoRoot = (html.match(/<div id="root">([\s\S]*?)<\/div>\s*<\/body>/) ?? ['', ''])[1].length

const marcadores = [
  ['navbar de la marca', /Subasta<span/],
  ['enlace Inicio', />Inicio</],
  ['titulo del hero', /Puja en vivo por el veh/],
  ['seccion del catalogo', /Vehiculos en subasta/],
  ['contador de subastas', /En vivo ahora/],
  ['pie de pagina', /Proyecto academico de WebDev/],
]

console.log('  --- contenido renderizado por React ---')
for (const [nombre, patron] of marcadores) {
  console.log(`  ${patron.test(html) ? 'OK   ' : 'FALLA'} ${nombre}`)
}

const renderiza = !raizVacia && largoRoot > 500

console.log('')
console.log(`  root vacio        : ${raizVacia ? 'SI (React no pinto nada)' : 'no'}`)
console.log(`  contenido en root : ${largoRoot} bytes`)

// Errores de JavaScript que el navegador reporto.
const erroresJs = [...html.matchAll(/Uncaught[^<\n]*/g)].map((m) => m[0])
const referencia = (errores + salida).match(/ReferenceError: \w+ is not defined/g) ?? []

console.log('')
if (erroresJs.length || referencia.length) {
  console.log('  errores detectados:')
  for (const e of new Set([...erroresJs, ...referencia])) console.log(`    ${e}`)
}

console.log(`\n  ${renderiza ? 'OK: React renderizo la aplicacion' : 'FALLO: la app quedo en blanco'}\n`)

process.exit(renderiza ? 0 : 1)