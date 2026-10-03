// Carga varias rutas del build de produccion en un navegador real y
// comprueba que React renderice cada una. Complementa a
// verify-navegador.mjs, que solo revisa la portada.
//
// Uso: node scripts/verify-rutas.mjs

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dist = path.join(raiz, 'dist')
const PUERTO = 4178
const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
}

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

async function cargar(ruta, presupuesto = 9000) {
  const perfil = path.join(raiz, `.tmp-chrome-${Math.random().toString(36).slice(2)}`)
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--user-data-dir=${perfil}`,
      `--virtual-time-budget=${presupuesto}`,
      '--dump-dom',
      `http://localhost:${PUERTO}${ruta}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )

  let salida = ''
  chrome.stdout.on('data', (d) => (salida += d.toString()))

  await new Promise((resolve) => {
    chrome.on('close', resolve)
    setTimeout(() => {
      chrome.kill()
      resolve()
    }, 45000)
  })

  return salida
}

console.log('\n=== Verificacion de rutas en navegador real ===\n')

const RUTAS = [
  // --dump-dom entrega el HTML en latin-1 aunque el documento sea utf-8, y
  // ademas mete espacios entre etiquetas. Por eso los marcadores evitan
  // acentos, buscan en minusculas y toleran separacion interna: el texto
  // de la aplicacion si lleva tildes.
  { ruta: '/', espera: 'Portada', marcador: /puja en vivo por el veh/i },
  { ruta: '/login', espera: 'Inicio de sesion', marcador: /inicia\s*sesi/i },
  { ruta: '/registro', espera: 'Registro', marcador: /crea tu cuenta/i },
  // Un id con formato no-UUID debe caer en el aviso normal, no mostrar
  // el error de Postgres. Un UUID bien formado pero inexistente tambien
  // debe avisar que no hay vehiculo. Son dos caminos distintos.
  { ruta: '/vehiculo/no-existe', espera: 'Id no UUID', marcador: /no disponible/i },
  {
    ruta: '/vehiculo/00000000-0000-0000-0000-000000000000',
    espera: 'UUID inexistente',
    marcador: /no disponible/i,
  },
  { ruta: '/ruta-inventada', espera: '404', marcador: /p.gina no encontrada/i },
  { ruta: '/publicar', espera: 'Ruta protegida', marcador: /inicia\s*sesi/i },
  { ruta: '/mis-publicaciones', espera: 'Ruta protegida 2', marcador: /inicia\s*sesi/i },
]

const resultados = []

for (const t of RUTAS) {
  const html = await cargar(t.ruta)

  const vacia = /<div id="root"><\/div>/.test(html)
  const contenido = (html.match(/<div id="root">([\s\S]*?)<\/div>\s*<\/body>/) ?? ['', ''])[1]
  const referencia = (html.match(/ReferenceError: \w+ is not defined/g) ?? [])

  const bien = !vacia && t.marcador.test(html) && contenido.length > 300

  resultados.push({
    nombre: t.espera,
    ok: bien,
    detalle: vacia
      ? 'root vacio: React no pinto'
      : referencia.length
        ? `error: ${referencia[0]}`
        : bien
          ? `${contenido.length} bytes, marcador presente`
          : 'sin el marcador esperado',
  })

  // Si falla, se imprime el texto visible de la pagina para comparar con
  // el marcador, en vez de un fragmento de HTML que cuesta leer.
  if (!bien) {
    const texto = contenido
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    console.log(`\n  --- texto visible de ${t.ruta} ---`)
    console.log(`  ${texto.slice(0, 400)}`)
    console.log('  --- fin ---')
  }
}

servidor.close()

for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(22)} ${r.detalle}`)
}

const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} rutas\n`)
process.exit(fallas === 0 ? 0 : 1)