// Datos de demostracion: 3 usuarios de prueba y vehiculos con galeria.
//
// Las fotos se descargan de Wikimedia Commons (licencias libres) y se
// suben al bucket del proyecto, en vez de enlazarlas por hotlinking.
// Razon: los CDN externos bloquean el hotlinking con 403 y una imagen
// rota en vivo durante la evaluacion se veria mal. Ademas asi se
// ejercita el Storage que pide el enunciado.
//
// Uso: npm run db:seed

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const URL_SUPABASE = process.env.VITE_SUPABASE_URL
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY
const BUCKET = 'vehiculos'
const UA = 'SubastaYA-ExamenWebDev/1.0 (material academico; contacto: estudiante@example.com)'

// Wikimedia limita las peticiones por IP y responde 403/429 si se le
// pide demasiado rapido. Espaciar las llamadas y reintentar con espera
// creciente es obligatorio: sin esto el seed falla a mitad de camino.
const PAUSA_MINIMA = 1100
let ultimaPeticion = 0

async function esperarTurno() {
  const restante = ultimaPeticion + PAUSA_MINIMA - Date.now()
  if (restante > 0) await new Promise((r) => setTimeout(r, restante))
  ultimaPeticion = Date.now()
}

async function pedir(url, intentos = 4) {
  for (let n = 1; n <= intentos; n++) {
    await esperarTurno()
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) return r

    if (n === intentos) throw new Error(`HTTP ${r.status} tras ${intentos} intentos`)

    const espera = 1500 * n * n
    console.log(`      · HTTP ${r.status}, reintento ${n} en ${espera}ms`)
    await new Promise((res) => setTimeout(res, espera))
  }
}

const admin = createClient(URL_SUPABASE, SECRET_KEY, { auth: { persistSession: false } })

const HORA = 3600 * 1000
const DIA = 24 * HORA

// ------------------------------------------------------------------
// Usuarios de prueba. El enunciado pide al menos 3 para poder hacer
// pruebas cruzadas de subasta desde varios navegadores.
// ------------------------------------------------------------------
const USUARIOS = [
  {
    correo: 'maria@subasta.com',
    password: 'Subasta2026!',
    nombre: 'María',
    apellido: 'González',
    telefono: '+502 5555 1101',
  },
  {
    correo: 'carlos@subasta.com',
    password: 'Subasta2026!',
    nombre: 'Carlos',
    apellido: 'Rodríguez',
    telefono: '+502 5555 1102',
  },
  {
    correo: 'ana@subasta.com',
    password: 'Subasta2026!',
    nombre: 'Ana',
    apellido: 'Martínez',
    telefono: '+502 5555 1103',
  },
]

// ------------------------------------------------------------------
// Flota de vehiculos.
//   inicio/cierre se calculan relativos a ahora para que el profesor
//   siempre encuentre subastas activas, aunque Corra el seed en dia distinto.
//   pujas: [indice de usuario, monto]. Se respetan las reglas del +10%
//   para que los datos de ejemplo sean coherentes con el motor.
// ------------------------------------------------------------------
const FOTOS = {
  corolla: [
    '2020 Toyota Corolla LE sedan.jpg',
    '2020 Toyota Corolla LE 12-13-2019.jpg',
    '2020 Toyota Corolla SE 2.0L sedan, 12.28.19.jpg',
    '2020 Toyota Corolla Altis petrol version front.jpg',
    '2020 Toyota Corolla Altis petrol version rear.jpg',
    'Toyota Corolla E210 sedan variation.jpg',
  ],
  civic: [
    '2019 Honda Civic LX Sedan.jpg',
    '2019 Honda Civic Sedan, Cleveland Auto Show.jpg',
    '2019 Honda Civic LX sedan, front left.jpg',
    '2019 Honda Civic LX sedan, front left, 05-07-2024.jpg',
    '2019 Honda Civic LX Sedan (cropped).jpg',
  ],
  f150: [
    '2021 Ford F-150 (fourteenth generation) front view 01.png',
    '2021 Ford F-150 SuperCrew, front 4.28.21.jpg',
    '2021 Ford F-150 SuperCrew, rear 4.28.21.jpg',
    '2021 Ford F-150 Double Cab.jpg',
    '2021 Ford F-150 Raptor.jpg',
    '2021 Ford F-150 Lariat.jpg',
  ],
  spark: [
    '2017 Chevrolet Spark 1LT in Red Hot, Front Left, 07-23-2022.jpg',
    '2017 Chevrolet Spark 1LT in Splash Metallic, Front Right, 08-25-2023.jpg',
    'Chevrolet Spark LT 1 (32699137335).jpg',
    'Chevrolet Spark LT 2 (32576777851).jpg',
    'Chevrolet Spark (6432385647).jpg',
  ],
  versa: [
    '2018 Nissan Versa in cyan (resprayed), front left, 10-11-2025.jpg',
    '2018 Nissan Versa in cyan (resprayed), rear left, 10-11-2025.jpg',
    'Nissan Versa N17 (United States).jpg',
    'Nissan Versa 1.6 Sense 2013 (46197902844).jpg',
    'DSC07284 (25144957543).jpg',
  ],
  cx5: [
    '2022 Mazda CX-5 2.0 front.jpg',
    '2022 Mazda CX-5 2.0 back.jpg',
    '2022 Mazda CX-5 Preferred (facelift), rear 6.21.22.jpg',
    'Mazda CX-5 (KF) Facelift 1X7A0331 (2).jpg',
    'MAZDA CX-5 (KF) China.jpg',
  ],
  tucson: [
    'Hyundai Tucson (NX4) IMG 3676.jpg',
    'Hyundai Tucson (NX4) IMG 3678.jpg',
    'Hyundai Tucson TL Wien 26 July 2020 JM.jpg',
    'Hyundai Tucson Chinese facelift 003.jpg',
    'Hyundai Tucson N Line NX4 Creamy White Pearl (3) (cropped).jpg',
    'Hyundai Tucson 1.6T Inspiration NX4 PE Creamy White Pearl (3).jpg',
  ],
  rio: [
    '2016 Kia Rio EX Sedan in Digital Yellow, Front Left, 05-05-2023.jpg',
    '2016 Kia Rio EX Sedan in Digital Yellow, Rear Left, 05-05-2023.jpg',
    "'16 Kia Rio Sedan (MIAS '16).jpg",
    'Kia Rio4 1.4 EX 2016.jpg',
    '2012 Kia Rio (UB MY12) Si sedan (2016-01-04) 01.jpg',
  ],
  wrangler: [
    'Jeep Wrangler Rubicon (JL) 4xe 1X7A0285.jpg',
    'Jeep Wrangler Rubicon (JL) 4xe 1X7A0287.jpg',
    'Jeep Wrangler Rubicon (JL) 4xe 1X7A0288.jpg',
    'JEEP WRANGLER SAHARA (JL) China.jpg',
    'JEEP WRANGLER SAHARA (JL) China (2).jpg',
    'Jeep Wrangler Unlimited 3.6 Sport Trail Rated 2019 (31461818957).jpg',
  ],
  mustang: [
    '2018 Ford Mustang GT 5.0 Front.jpg',
    '2018 Ford Mustang GT 5.0 Rear.jpg',
    'Ford Mustang VI Bullit, GIMS 2018, Le Grand-Saconnex (1X7A1282).jpg',
    'Ford Mustang Kulmbach 2018 6170295.jpg',
    'Ford Mustang ADAC Deutschland Klassik 2018 P6280091.jpg',
    'Ford Mustang Sachs Franken Classic 2018 P5201303.jpg',
  ],
}

const ahora = Date.now()
const en = (ms) => new Date(ahora + ms).toISOString()

const VEHICULOS = [
  {
    duenio: 0,
    anio: 2020,
    tipo_articulo: 'Automóvil',
    marca: 'Toyota',
    modelo: 'COROLLA LE',
    motor: '1.8L 4 cilindros',
    transmision: 'Automática CVT',
    combustible: 'Gasolina',
    tren_manejo: 'FWD',
    num_cilindros: 4,
    nivel_dano: 'verde',
    descripcion:
      'Sedán en excelente estado, un solo dueño, mantenimiento al día en agencia. Sin golpes ni rayones. Periódico vigente.',
    monto_base: 20000,
    fecha_inicio: en(-2 * DIA),
    fecha_cierre: en(5 * DIA),
    fotos: FOTOS.corolla,
    pujas: [
      [1, 20000],
      [2, 22000],
    ],
  },
  {
    duenio: 1,
    anio: 2019,
    tipo_articulo: 'Automóvil',
    marca: 'Honda',
    modelo: 'CIVIC LX',
    motor: '2.0L 4 cilindros',
    transmision: 'CVT',
    combustible: 'Gasolina',
    tren_manejo: 'FWD',
    num_cilindros: 4,
    nivel_dano: 'amarillo',
    descripcion:
      'Cerrón en el guardabarros delantero derecho y rayón en la puerta trasera. Arranca y maneja con normalidad. Documentos al día.',
    monto_base: 25000,
    fecha_inicio: en(-1 * DIA),
    fecha_cierre: en(3 * HORA),
    fotos: FOTOS.civic,
    // Carlos (indice 1) es el dueno, asi que las tres pujas vienen de
    // maria (0) y ana (2).
    pujas: [
      [0, 25000],
      [2, 27500],
      [0, 30250],
    ],
  },
  {
    duenio: 2,
    anio: 2021,
    tipo_articulo: 'Camioneta',
    marca: 'Ford',
    modelo: 'F-150 DOUBLE CAB',
    motor: '3.5L V6 EcoBoost',
    transmision: 'Automática 10 velocidades',
    combustible: 'Gasolina',
    tren_manejo: '4WD',
    num_cilindros: 6,
    nivel_dano: 'verde',
    descripcion:
      'Camioneta doble cabina 4x4 con caja de acero. Prácticamente nueva, 32,000 km. Ideal para carga y trabajo.',
    monto_base: 85000,
    fecha_inicio: en(-3 * DIA),
    fecha_cierre: en(8 * DIA),
    fotos: FOTOS.f150,
    pujas: [[0, 85000]],
  },
  {
    duenio: 0,
    anio: 2017,
    tipo_articulo: 'Automóvil',
    marca: 'Chevrolet',
    modelo: 'SPARK 1LT',
    motor: '1.0L 3 cilindros',
    transmision: 'Manual 5 velocidades',
    combustible: 'Gasolina',
    tren_manejo: 'FWD',
    num_cilindros: 3,
    nivel_dano: 'rojo',
    descripcion:
      'Daño severo en el costado izquierdo y el capó. Vehículo para repuestos. Se vende en las condiciones en que se encuentra.',
    monto_base: 15000,
    fecha_inicio: en(-6 * DIA),
    fecha_cierre: en(-2 * DIA),
    fotos: FOTOS.spark,
    pujas: [],
  },
  {
    duenio: 1,
    anio: 2018,
    tipo_articulo: 'Automóvil',
    marca: 'Nissan',
    modelo: 'VERSA 1.6',
    motor: '1.6L 4 cilindros',
    transmision: 'CVT',
    combustible: 'Gasolina',
    tren_manejo: 'FWD',
    num_cilindros: 4,
    nivel_dano: 'amarillo',
    descripcion:
      'Repintado completo del costado. Electricidad y climatización en buen estado. Sin multas.',
    monto_base: 18000,
    fecha_inicio: en(-10 * DIA),
    fecha_cierre: en(-1 * DIA),
    fotos: FOTOS.versa,
    pujas: [
      [0, 18000],
      [2, 19800],
    ],
  },
  {
    duenio: 2,
    anio: 2022,
    tipo_articulo: 'Camioneta',
    marca: 'Mazda',
    modelo: 'CX-5 2.0',
    motor: '2.0L Skyactiv-G 4 cilindros',
    transmision: 'Automática 6 velocidades',
    combustible: 'Gasolina',
    tren_manejo: 'AWD',
    num_cilindros: 4,
    nivel_dano: 'verde',
    descripcion:
      'SUV con tracción integral, cámara de reversa y sistema de asistencia. Como nueva, poco kilometrado.',
    monto_base: 65000,
    fecha_inicio: en(3 * HORA),
    fecha_cierre: en(7 * DIA),
    fotos: FOTOS.cx5,
    pujas: [],
  },
  {
    duenio: 0,
    anio: 2020,
    tipo_articulo: 'Camioneta',
    marca: 'Hyundai',
    modelo: 'TUCSON NX4',
    motor: '2.0L 4 cilindros',
    transmision: 'Automática 6 velocidades',
    combustible: 'Gasolina',
    tren_manejo: 'AWD',
    num_cilindros: 4,
    nivel_dano: 'rojo',
    descripcion:
      'Golpe frontal importante y airbag desplegado. Unidad declarada pérdida total, apta solo para desarme.',
    monto_base: 40000,
    fecha_inicio: en(-2 * DIA),
    fecha_cierre: en(2 * DIA),
    fotos: FOTOS.tucson,
    // Maria (indice 0) es la duena: ofertan carlos (1) y ana (2).
    pujas: [
      [1, 40000],
      [2, 44000],
    ],
  },
  {
    duenio: 1,
    anio: 2016,
    tipo_articulo: 'Automóvil',
    marca: 'Kia',
    modelo: 'RIO EX',
    motor: '1.6L 4 cilindros',
    transmision: 'Manual 6 velocidades',
    combustible: 'Gasolina',
    tren_manejo: 'FWD',
    num_cilindros: 4,
    nivel_dano: 'verde',
    descripcion:
      'Sedán económico y completamente funcional. Suspensión y neumáticos cambiados hace poco.',
    monto_base: 12000,
    fecha_inicio: en(-12 * DIA),
    fecha_cierre: en(-5 * DIA),
    fotos: FOTOS.rio,
    pujas: [],
  },
  {
    // Unico vehiculo con tren RWD, para que el filtro de tren de manejo
    // tenga tambien la cuarta opcion con datos.
    duenio: 1,
    anio: 2018,
    tipo_articulo: 'Deportivo',
    marca: 'Ford',
    modelo: 'MUSTANG GT 5.0',
    motor: '5.0L V8',
    transmision: 'Manual 6 velocidades',
    combustible: 'Gasolina',
    tren_manejo: 'RWD',
    num_cilindros: 8,
    nivel_dano: 'verde',
    descripcion:
      'Deportivo con motor V8 de 5 litros, cambio manual de 6 velocidades y traccion trasera. Excelente opcion para una preparacion.',
    monto_base: 55000,
    fecha_inicio: en(-4 * DIA),
    fecha_cierre: en(4 * DIA),
    fotos: FOTOS.mustang,
    // Carlos (indice 1) es el dueno: ofertan maria (0) y ana (2).
    pujas: [
      [0, 55000],
      [2, 60500],
    ],
  },
  {
    // Borrador a proposito: sirve para que el profesor vea el flujo de
    // publicacion y la validacion de minimo de 5 fotos en la UI.
    borrador: true,
    duenio: 0,
    anio: 2019,
    tipo_articulo: 'Camioneta',
    marca: 'Jeep',
    modelo: 'WRANGLER RUBICON',
    motor: '3.6L V6',
    transmision: 'Automática 8 velocidades',
    combustible: 'Gasolina',
    tren_manejo: '4WD',
    num_cilindros: 6,
    nivel_dano: 'verde',
    descripcion:
      'Borrador de ejemplo con las 5 fotos ya cargadas, listo para publicarse desde "Mis publicaciones".',
    monto_base: 70000,
    fecha_inicio: en(1 * DIA),
    fecha_cierre: en(10 * DIA),
    fotos: FOTOS.wrangler,
    pujas: [],
  },
]

const creditos = []

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------

async function resolverFotos(titulos) {
  const porPagina = 20
  const resultado = []

  for (let i = 0; i < titulos.length; i += porPagina) {
    const lote = titulos
      .slice(i, i + porPagina)
      .map((t) => `File:${t}`)
      .join('|')

    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
      encodeURIComponent(lote) +
      '&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1400&format=json&origin=*'

    const r = await pedir(url)
    const json = await r.json()

    for (const pagina of Object.values(json.query?.pages ?? {})) {
      const info = pagina.imageinfo?.[0]
      if (!info) {
        console.log(`      ! no encontrado: ${pagina.title}`)
        continue
      }
      resultado.push({
        titulo: pagina.title.replace(/^File:/, ''),
        url: info.thumburl ?? info.url,
        licencia: info.extmetadata?.LicenseShortName?.value ?? 'desconocida',
        autor: (info.extmetadata?.Artist?.value ?? 'Wikimedia Commons')
          .replace(/<[^>]+>/g, '')
          .trim()
          .slice(0, 80),
      })
    }
  }

  return resultado
}

async function descargar(url) {
  const r = await pedir(url)
  return Buffer.from(await r.arrayBuffer())
}

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const extension = (nombre) => {
  const m = nombre.match(/\.(jpe?g|png|webp)$/i)
  return m ? m[1].toLowerCase() : 'jpg'
}

// ------------------------------------------------------------------
// Limpieza previa
// ------------------------------------------------------------------
async function limpiar() {
  console.log('\n--- Limpiando datos de demostracion anteriores ---')

  const { error: errVeh } = await admin.from('vehiculos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (errVeh) console.log('  aviso al borrar vehiculos:', errVeh.message)
  else console.log('  vehiculos, fotos y pujas borrados (en cascada)')

  const { data: usuarios } = await admin.auth.admin.listUsers({ perPage: 200 })
  const objetivo = new Set(USUARIOS.map((u) => u.correo))
  for (const u of usuarios?.users ?? []) {
    if (objetivo.has(u.email)) {
      await admin.auth.admin.deleteUser(u.id)
      console.log(`  usuario eliminado: ${u.email}`)
    }
  }

  const { data: archivos } = await admin.storage.from(BUCKET).list('', { limit: 1000 })
  for (const carpeta of archivos ?? []) {
    const { data: dentro } = await admin.storage.from(BUCKET).list(carpeta.name, { limit: 1000 })
    const rutas = (dentro ?? []).map((f) => `${carpeta.name}/${f.name}`)
    if (rutas.length) {
      await admin.storage.from(BUCKET).remove(rutas)
      console.log(`  ${rutas.length} archivos borrados de ${carpeta.name}/`)
    }
  }
}

// ------------------------------------------------------------------
// Creacion de usuarios
// ------------------------------------------------------------------
async function crearUsuarios() {
  console.log('\n--- Creando usuarios de prueba ---')
  const ids = []

  for (const u of USUARIOS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.correo,
      password: u.password,
      email_confirm: true,
      user_metadata: {
        nombre: u.nombre,
        apellido: u.apellido,
        telefono: u.telefono,
      },
    })

    if (error) {
      console.log(`  FALLO ${u.correo}: ${error.message}`)
      continue
    }

    ids.push(data.user.id)
    console.log(`  ${u.correo.padEnd(22)} ${u.nombre} ${u.apellido}`)

    // El trigger fn_trg_crear_perfil arma el perfil desde auth.users.
    await new Promise((r) => setTimeout(r, 400))
  }

  return ids
}

// ------------------------------------------------------------------
// Vehiculos
// ------------------------------------------------------------------
async function crearVehiculos(idsUsuarios) {
  console.log('\n--- Creando vehiculos ---')

  let creadas = 0

  for (const [i, v] of VEHICULOS.entries()) {
    const duenio = idsUsuarios[v.duenio]
    if (!duenio) {
      console.log(`  ${i + 1}. OMITIDO ${v.marca} ${v.modelo}: su dueno no se pudo crear`)
      continue
    }

    const resueltas = await resolverFotos(v.fotos)

    if (resueltas.length < 5) {
      console.log(`  ${i + 1}. OMITIDO ${v.marca} ${v.modelo}: solo ${resueltas.length}/5 fotos disponibles`)
      continue
    }

    const { data: vehiculo, error: errVeh } = await admin
      .from('vehiculos')
      .insert({
        user_id: duenio,
        anio: v.anio,
        tipo_articulo: v.tipo_articulo,
        marca: v.marca,
        modelo: v.modelo,
        motor: v.motor,
        transmision: v.transmision,
        combustible: v.combustible,
        tren_manejo: v.tren_manejo,
        num_cilindros: v.num_cilindros,
        nivel_dano: v.nivel_dano,
        descripcion: v.descripcion,
        monto_base: v.monto_base,
        fecha_inicio: v.fecha_inicio,
        fecha_cierre: v.fecha_cierre,
        estado: v.borrador ? 'borrador' : 'activo',
      })
      .select('id')
      .single()

    if (errVeh) {
      console.log(`  ${i + 1}. FALLO ${v.marca} ${v.modelo}: ${errVeh.message}`)
      continue
    }

    // Galeria
    const filas = []
    for (const [orden, foto] of resueltas.entries()) {
      const ruta = `${duenio}/${vehiculo.id}/${String(orden + 1).padStart(2, '0')}.${extension(foto.titulo)}`

      try {
        const buffer = await descargar(foto.url)
        const { error: errUp } = await admin.storage
          .from(BUCKET)
          .upload(ruta, buffer, { contentType: MIME[extension(foto.titulo)], upsert: true })

        if (errUp) throw new Error(errUp.message)

        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(ruta)
        filas.push({
          vehiculo_id: vehiculo.id,
          storage_path: ruta,
          url: pub.publicUrl,
          orden,
        })
        creditos.push({ foto: foto.titulo, licencia: foto.licencia, autor: foto.autor })
      } catch (e) {
        console.log(`      ! no se pudo subir "${foto.titulo}": ${e.message}`)
      }
    }

    // Nunca dejamos un vehiculo publicado con menos de 5 fotos: es el
    // requisito del enunciado y lo mismo que valida fn_activar_vehiculo.
    // Si alguna descarga fallo, se descarta el vehiculo entero.
    if (filas.length < 5) {
      await admin.from('vehiculos').delete().eq('id', vehiculo.id)
      console.log(
        `  ${String(i + 1).padStart(2)}. DESCARTADO ${v.marca} ${v.modelo}: ` +
          `solo ${filas.length} de ${resueltas.length} fotos se pudieron subir (minimo 5)`,
      )
      continue
    }

    if (filas.length) {
      const { error: errFotos } = await admin.from('fotos_vehiculo').insert(filas)
      if (errFotos) console.log(`      ! error al registrar fotos: ${errFotos.message}`)
    }

    // Pujas historicas. El trigger actualiza monto_actual y total_pujas.
    let pujasOk = 0
    for (const [idxUsuario, monto] of v.pujas) {
      const postor = idsUsuarios[idxUsuario]
      if (!postor) continue
      if (postor === duenio) {
        console.log(`      ! pujas en subasta propia omitida`)
        continue
      }
      const { error: errPuja } = await admin
        .from('pujas')
        .insert({ vehiculo_id: vehiculo.id, user_id: postor, monto })

      if (errPuja) console.log(`      ! puja rechazada: ${errPuja.message}`)
      else pujasOk++
    }

    const detallePujas = pujasOk > 0 ? `, ${pujasOk} pujas` : ''

    creadas++
    console.log(
      `  ${String(i + 1).padStart(2)}. ${(v.marca + ' ' + v.modelo).padEnd(26)} ` +
        `${v.anio}  ${v.nivel_dano.padEnd(9)} ${filas.length} fotos${detallePujas}  ` +
        `${v.borrador ? '[BORRADOR]' : ''}`,
    )
  }

  return creadas
}

// ------------------------------------------------------------------
// Informe
// ------------------------------------------------------------------
async function informe() {
  console.log('\n--- Inventario resultante ---')

  const { data } = await admin
    .from('vw_inventario')
    .select('marca, modelo, nivel_dano, monto_base, monto_actual, total_pujas, estado_calculado, total_fotos')
    .order('estado_calculado')

  const ancho = 30
  console.log(`  ${'VEHICULO'.padEnd(ancho)} ${'BASE'.padStart(10)} ${'ACTUAL'.padStart(10)} ${'PUJAS'.padStart(6)}  ESTADO`)
  for (const v of data ?? []) {
    console.log(
      `  ${(v.marca + ' ' + v.modelo).slice(0, ancho).padEnd(ancho)} ` +
        `${Number(v.monto_base).toLocaleString('es-GT').padStart(10)} ` +
        `${Number(v.monto_actual).toLocaleString('es-GT').padStart(10)} ` +
        `${String(v.total_pujas).padStart(6)}  ${v.estado_calculado}`,
    )
  }

  const porEstado = {}
  for (const v of data ?? []) porEstado[v.estado_calculado] = (porEstado[v.estado_calculado] ?? 0) + 1
  console.log(`\n  Estados: ${Object.entries(porEstado).map(([k, n]) => `${k}=${n}`).join('  ')}`)

  console.log('\n  Creditos de las imagenes (Wikimedia Commons):')
  const licencias = {}
  for (const c of creditos) licencias[c.licencia] = (licencias[c.licencia] ?? 0) + 1
  console.log(`  ${Object.entries(licencias).map(([l, n]) => `${l}: ${n}`).join('  ')}`)
}

// ------------------------------------------------------------------
console.log('\n=== FASE 3 · Datos de demostracion ===\n')

try {
  await limpiar()
  const ids = await crearUsuarios()
  await crearVehiculos(ids)
  await informe()

  console.log('\n  USUARIOS DE PRUEBA')
  for (const u of USUARIOS) console.log(`  ${u.correo.padEnd(22)} ${u.password}`)
  console.log()
  process.exit(0)
} catch (e) {
  console.error('\nError en el seed:', e.message)
  process.exit(1)
}