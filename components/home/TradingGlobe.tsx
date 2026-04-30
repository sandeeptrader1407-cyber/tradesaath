'use client'

import { useEffect, useRef, useState } from 'react'

// ── Markets ──────────────────────────────────────────────────────────────────
const MARKETS = [
  { name: 'NYSE',     full: 'New York Stock Exchange',    lat:  40.71, lon: -74.01, color: '#4ADE80' },
  { name: 'Nasdaq',   full: 'Nasdaq',                     lat:  40.75, lon: -73.98, color: '#34D399' },
  { name: 'LSE',      full: 'London Stock Exchange',      lat:  51.51, lon:  -0.09, color: '#60A5FA' },
  { name: 'TSE',      full: 'Tokyo Stock Exchange',       lat:  35.69, lon: 139.70, color: '#F472B6' },
  { name: 'SSE',      full: 'Shanghai Stock Exchange',    lat:  31.23, lon: 121.47, color: '#FB923C' },
  { name: 'BSE',      full: 'Bombay Stock Exchange',      lat:  18.93, lon:  72.83, color: '#F59E0B' },
  { name: 'ASX',      full: 'Australian Securities Exch', lat: -33.87, lon: 151.21, color: '#34D399' },
  { name: 'Euronext', full: 'Euronext Paris',             lat:  48.86, lon:   2.35, color: '#FCD34D' },
  { name: 'SGX',      full: 'Singapore Exchange',         lat:   1.29, lon: 103.85, color: '#22D3EE' },
  { name: 'HKEX',     full: 'Hong Kong Exchanges',        lat:  22.29, lon: 114.16, color: '#F87171' },
  { name: 'TSX',      full: 'Toronto Stock Exchange',     lat:  43.65, lon: -79.38, color: '#86EFAC' },
  { name: 'B3',       full: 'B3 São Paulo',               lat: -23.55, lon: -46.63, color: '#FCA5A5' },
  { name: 'MOEX',     full: 'Moscow Exchange',            lat:  55.75, lon:  37.62, color: '#93C5FD' },
  { name: 'JSE',      full: 'Johannesburg Stock Exch',    lat: -26.20, lon:  28.04, color: '#FBBF24' },
  { name: 'KRX',      full: 'Korea Stock Exchange',       lat:  37.57, lon: 126.98, color: '#A78BFA' },
  { name: 'Tadawul',  full: 'Saudi Exchange',             lat:  24.68, lon:  46.72, color: '#FDE68A' },
] as const

const ARC_PAIRS: readonly [string, string][] = [
  ['NYSE',  'LSE'],
  ['LSE',   'Euronext'],
  ['LSE',   'BSE'],
  ['BSE',   'TSE'],
  ['SGX',   'ASX'],
  ['HKEX',  'TSE'],
]

interface Tooltip { name: string; full: string; color: string; x: number; y: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
function ll2xyz(lat: number, lon: number, r: number): [number, number, number] {
  const la = lat * Math.PI / 180
  const lo = lon * Math.PI / 180
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), r * Math.cos(la) * Math.sin(lo)]
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TradingGlobe() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const starsCanvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  useEffect(() => {
    const container   = containerRef.current
    const starsCanvas = starsCanvasRef.current
    if (!container || !starsCanvas) return

    let animFrame: number
    let disposed  = false
    let isDragging = false
    let prevX = 0, prevY = 0
    let velY = 0, velX = 0

    // ── Star data (generated once, animated each frame) ──────────────────────
    const starCtx = starsCanvas.getContext('2d')
    starsCanvas.width  = container.clientWidth  || 700
    starsCanvas.height = container.clientHeight || 420

    interface Star { x: number; y: number; r: number; base: number; phase: number }
    const stars: Star[] = []
    const push = (count: number, rMin: number, rMax: number, oMin: number, oMax: number) => {
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random(), y: Math.random(),
          r: rMin + Math.random() * (rMax - rMin),
          base: oMin + Math.random() * (oMax - oMin),
          phase: Math.random() * Math.PI * 2,
        })
      }
    }
    push(20,  1.8, 2.2, 0.6, 0.9)   // large
    push(80,  0.8, 1.4, 0.3, 0.6)   // medium
    push(300, 0.3, 0.7, 0.1, 0.3)   // small

    const drawStars = (now: number) => {
      if (!starCtx) return
      const w = starsCanvas.width, h = starsCanvas.height
      starCtx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const op = Math.max(0.02, Math.min(1, s.base + 0.15 * Math.sin(now * 0.001 + s.phase)))
        starCtx.beginPath()
        starCtx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        starCtx.fillStyle = `rgba(180,210,255,${op.toFixed(2)})`
        starCtx.fill()
      }
    }

    // ── Three.js ──────────────────────────────────────────────────────────────
    import('three').then((THREE) => {
      if (disposed || !containerRef.current) return
      const cont = containerRef.current
      const W = cont.clientWidth, H = cont.clientHeight

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      cont.appendChild(renderer.domElement)
      renderer.domElement.style.cssText = 'position:absolute;inset:0'

      const scene  = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
      camera.position.z = 2.8

      // Primary point light for globe depth
      const light = new THREE.PointLight(0xffffff, 0.6)
      light.position.set(3, 3, 5)
      scene.add(light)
      // Cool-toned back light for edge contrast
      const backLight = new THREE.PointLight(0x003366, 0.4)
      backLight.position.set(-3, -2, -3)
      scene.add(backLight)
      scene.add(new THREE.AmbientLight(0x1a2040, 1.2))

      const R = 1
      const pivot = new THREE.Group()
      pivot.rotation.x = 0.2
      scene.add(pivot)

      // ── Globe sphere (Phong for lighting depth) ────────────────────────────
      pivot.add(new THREE.Mesh(
        new THREE.SphereGeometry(R, 64, 64),
        new THREE.MeshPhongMaterial({
          color: 0x030d1f,
          emissive: 0x050f28,
          emissiveIntensity: 0.5,
          specular: 0x1a3a6a,
          shininess: 20,
        })
      ))

      // ── Dual-density grid ─────────────────────────────────────────────────
      const mk = (lat: number, lon: number, r = R * 1.001) => {
        const [x,y,z] = ll2xyz(lat, lon, r)
        return new THREE.Vector3(x, y, z)
      }
      const fineMat  = new THREE.LineBasicMaterial({ color: 0x1a3a6a, transparent: true, opacity: 0.18 })
      const coarseMat = new THREE.LineBasicMaterial({ color: 0x2255aa, transparent: true, opacity: 0.35 })

      // Latitude lines — every 10°
      for (let lat = -80; lat <= 80; lat += 10) {
        if (lat === 0) continue // equator drawn separately
        const pts = Array.from({ length: 73 }, (_, j) => mk(lat, j * 5 - 180))
        pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lat % 30 === 0 ? coarseMat : fineMat))
      }
      // Longitude lines — every 10°
      for (let lon = -180; lon < 180; lon += 10) {
        if (lon === 0) continue // prime meridian drawn separately
        const pts = Array.from({ length: 37 }, (_, j) => mk(-90 + j * 5, lon))
        pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lon % 30 === 0 ? coarseMat : fineMat))
      }
      // Equator — bright highlight
      pivot.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 73 }, (_, j) => mk(0, j * 5 - 180, R * 1.0015))),
        new THREE.LineBasicMaterial({ color: 0x3366cc, transparent: true, opacity: 0.6 })
      ))
      // Prime meridian
      pivot.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 37 }, (_, j) => mk(-90 + j * 5, 0))),
        new THREE.LineBasicMaterial({ color: 0x1a4488, transparent: true, opacity: 0.35 })
      ))
      // Tropics & polar circles
      for (const lat of [23.5, -23.5, 66.5, -66.5]) {
        const pts = Array.from({ length: 73 }, (_, j) => mk(lat, j * 5 - 180))
        pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x1a4488, transparent: true, opacity: 0.25 })
        ))
      }

      // ── Atmosphere: rim glow + 5 nested shells ────────────────────────────
      // Rim glow — tight bright shell at globe edge
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.02, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x3366ff, transparent: true, opacity: 0.08, side: THREE.BackSide })
      ))
      const atmo = [
        { r: R * 1.04, c: 0x2255cc, o: 0.18 },
        { r: R * 1.08, c: 0x1840aa, o: 0.10 },
        { r: R * 1.14, c: 0x112d88, o: 0.06 },
        { r: R * 1.22, c: 0x0a1e66, o: 0.03 },
        { r: R * 1.35, c: 0x060f44, o: 0.015 },
      ]
      atmo.forEach(({ r, c, o }) =>
        scene.add(new THREE.Mesh(
          new THREE.SphereGeometry(r, 32, 32),
          new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.BackSide })
        ))
      )

      // ── Continent dot cloud (~2000 pts via THREE.Points) ─────────────────
      const regions = [
        { latMin: 25, latMax: 70, lonMin: -130, lonMax:  -60, density: 0.35 },
        { latMin: -55, latMax: 12, lonMin:  -80, lonMax:  -35, density: 0.35 },
        { latMin: 36, latMax: 70, lonMin:  -10, lonMax:   40, density: 0.45 },
        { latMin: -35, latMax: 37, lonMin:  -18, lonMax:   52, density: 0.30 },
        { latMin: 10, latMax: 70, lonMin:   40, lonMax:  100, density: 0.30 },
        { latMin: 5,  latMax: 55, lonMin:  100, lonMax:  145, density: 0.40 },
        { latMin: -40, latMax: -10, lonMin: 113, lonMax:  154, density: 0.40 },
        { latMin: 60, latMax: 83, lonMin:  -55, lonMax:  -18, density: 0.25 },
        // Northern Asia / Siberia
        { latMin: 55, latMax: 75, lonMin:   18, lonMax:   80, density: 0.40 },
        // Southeast Asia / Indonesia
        { latMin: -5, latMax: 20, lonMin:   95, lonMax:  140, density: 0.40 },
      ]
      const dotPos: number[] = []
      regions.forEach(reg => {
        const area  = (reg.latMax - reg.latMin) * (reg.lonMax - reg.lonMin)
        const count = Math.floor(area * reg.density)
        for (let i = 0; i < count; i++) {
          const lat = reg.latMin + Math.random() * (reg.latMax - reg.latMin)
          const lon = reg.lonMin + Math.random() * (reg.lonMax - reg.lonMin)
          const [x, y, z] = ll2xyz(lat, lon, R * 1.002)
          dotPos.push(x, y, z)
        }
      })
      const dotGeo = new THREE.BufferGeometry()
      dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPos, 3))
      pivot.add(new THREE.Points(dotGeo,
        new THREE.PointsMaterial({ size: 0.008, color: 0x3d6abf, transparent: true, opacity: 0.65, sizeAttenuation: true })
      ))

      // ── Market dots (3 layers each) ────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outerMeshes: any[] = []
      const dotData = MARKETS.map((m) => {
        const [px, py, pz] = ll2xyz(m.lat, m.lon, R * 1.003)
        const pos = new THREE.Vector3(px, py, pz)
        const hex = parseInt(m.color.slice(1), 16)

        const outer = new THREE.Mesh(
          new THREE.SphereGeometry(0.022, 8, 8),
          new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.35 })
        )
        outer.position.copy(pos)
        pivot.add(outer)
        outerMeshes.push(outer)

        const mid = new THREE.Mesh(
          new THREE.SphereGeometry(0.016, 8, 8),
          new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.4 })
        )
        mid.position.copy(pos)
        pivot.add(mid)

        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.008, 6, 6),
          new THREE.MeshBasicMaterial({ color: hex })
        )
        core.position.copy(pos)
        pivot.add(core)

        // Ring halo — flat ring oriented to face outward
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.028, 0.034, 24),
          new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        )
        ring.position.copy(pos)
        ring.lookAt(pos.clone().multiplyScalar(2))
        pivot.add(ring)

        return { outer, ring, pos, m }
      })

      // ── Connection arcs + animated particles ──────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arcParticles: { curve: any; t: number; speed: number; mesh: any }[] = []

      ARC_PAIRS.forEach(([a, b], i) => {
        const ia = MARKETS.findIndex(m => m.name === a)
        const ib = MARKETS.findIndex(m => m.name === b)
        if (ia < 0 || ib < 0) return
        const p1  = dotData[ia].pos.clone()
        const p2  = dotData[ib].pos.clone()
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
        mid.normalize().multiplyScalar(R + 0.42)
        const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)

        // Static arc line
        pivot.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
        ))

        // Animated particle
        const originHex = parseInt(dotData[ia].m.color.slice(1), 16)
        const particleMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.006, 5, 5),
          new THREE.MeshBasicMaterial({ color: originHex, transparent: true, opacity: 0 })
        )
        pivot.add(particleMesh)
        arcParticles.push({
          curve,
          t:     Math.random(),
          speed: 0.0008 + i * 0.00018,
          mesh:  particleMesh,
        })
      })

      // ── Raycaster for tooltips ────────────────────────────────────────────
      const raycaster = new THREE.Raycaster()
      const mouse     = new THREE.Vector2()

      // ── Events ────────────────────────────────────────────────────────────
      const onMouseDown = (e: MouseEvent) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; velY = 0; velX = 0 }
      const onMouseMove = (e: MouseEvent) => {
        if (isDragging) {
          velY = (e.clientX - prevX) * 0.008
          velX = (e.clientY - prevY) * 0.005
          pivot.rotation.y += velY
          pivot.rotation.x  = Math.max(-0.85, Math.min(0.85, pivot.rotation.x + velX))
          prevX = e.clientX; prevY = e.clientY
        }
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
        raycaster.setFromCamera(mouse, camera)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hits = raycaster.intersectObjects(outerMeshes as any[])
        if (hits.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idx = outerMeshes.indexOf(hits[0].object as any)
          if (idx >= 0) {
            const wp = dotData[idx].pos.clone().applyMatrix4(pivot.matrixWorld).project(camera)
            const cW = renderer.domElement.clientWidth, cH = renderer.domElement.clientHeight
            setTooltip({ name: dotData[idx].m.name, full: dotData[idx].m.full, color: dotData[idx].m.color, x: (wp.x + 1) / 2 * cW, y: -(wp.y - 1) / 2 * cH })
          }
        } else { setTooltip(null) }
      }
      const onMouseUp   = () => { isDragging = false }
      const onTouchStart = (e: TouchEvent) => { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; velY = 0 }
      const onTouchMove  = (e: TouchEvent) => {
        if (!isDragging) return
        velY = (e.touches[0].clientX - prevX) * 0.008
        pivot.rotation.y += velY
        prevX = e.touches[0].clientX; prevY = e.touches[0].clientY
      }
      const onTouchEnd = () => { isDragging = false }

      renderer.domElement.addEventListener('mousedown',  onMouseDown)
      renderer.domElement.addEventListener('mousemove',  onMouseMove)
      window.addEventListener('mouseup',   onMouseUp)
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true })
      window.addEventListener('touchmove', onTouchMove,  { passive: true })
      window.addEventListener('touchend',  onTouchEnd)

      // ── Resize ────────────────────────────────────────────────────────────
      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return
        const w = containerRef.current.clientWidth, h = containerRef.current.clientHeight
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
        if (starsCanvas) { starsCanvas.width = w; starsCanvas.height = h }
      })
      ro.observe(cont)

      // ── Animation loop ────────────────────────────────────────────────────
      const animate = () => {
        if (disposed) return
        animFrame = requestAnimationFrame(animate)
        const now = Date.now()

        drawStars(now)

        if (!isDragging) {
          pivot.rotation.y += 0.001 + velY
          velY *= 0.95
          velX *= 0.95
          // Gentle tilt oscillation — lerp towards oscillation target
          const tiltTarget = 0.2 + 0.12 * Math.sin(now * 0.0002)
          pivot.rotation.x += (tiltTarget - pivot.rotation.x) * 0.015
        }

        // Pulse outer market dots + ring halos
        const t = now * 0.002
        dotData.forEach(({ outer, ring }, i) => {
          const phase = t + i * 0.7
          const s = 1.0 + 0.55 * (0.5 + 0.5 * Math.sin(phase))
          outer.scale.setScalar(s)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(outer.material as any).opacity = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(phase))
          // Ring halo pulses on a slower, independent phase
          const rPhase = now * 0.0014 + i * 0.7
          ring.scale.setScalar(1 + 0.4 * (0.5 + 0.5 * Math.sin(rPhase)))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(ring.material as any).opacity = 0.15 + 0.2 * (0.5 + 0.5 * Math.sin(rPhase))
        })

        // Arc particles travel along curves
        arcParticles.forEach(p => {
          p.t = (p.t + p.speed) % 1
          const pt = p.curve.getPoint(p.t)
          p.mesh.position.copy(pt)
          p.mesh.material.opacity = Math.sin(p.t * Math.PI)
        })

        renderer.render(scene, camera)
      }
      animate()

      // ── Cleanup closure ───────────────────────────────────────────────────
      ;(cont as typeof cont & { _gc?: () => void })._gc = () => {
        renderer.domElement.removeEventListener('mousedown',  onMouseDown)
        renderer.domElement.removeEventListener('mousemove',  onMouseMove)
        window.removeEventListener('mouseup',   onMouseUp)
        renderer.domElement.removeEventListener('touchstart', onTouchStart)
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend',  onTouchEnd)
        ro.disconnect()
        renderer.dispose()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }).catch(() => {})

    return () => {
      disposed = true
      cancelAnimationFrame(animFrame)
      ;(container as typeof container & { _gc?: () => void })._gc?.()
    }
  }, [])

  return (
    <div style={{ background: '#020914', borderRadius: 12 }}>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', cursor: 'grab' }} className="globe-wrap">
        <canvas ref={starsCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -130%)',
            background: 'rgba(5,10,24,0.95)',
            border: `1px solid ${tooltip.color}88`,
            borderRadius: 8,
            padding: '8px 12px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${tooltip.color}26`,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: tooltip.color, fontWeight: 500 }}>
              {tooltip.name}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'rgba(248,246,241,0.6)', marginTop: 2 }}>
              {tooltip.full}
            </div>
          </div>
        )}
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(120,160,255,0.3)', textAlign: 'center', marginTop: 12, marginBottom: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        16 markets &middot; 6 continents &middot; 1 companion
      </p>
      <style>{`
        .globe-wrap { height: 420px }
        @media(max-width: 768px) { .globe-wrap { height: 300px } }
      `}</style>
    </div>
  )
}
