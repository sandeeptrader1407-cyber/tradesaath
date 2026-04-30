'use client'

import { useEffect, useRef, useState } from 'react'

const MARKETS = [
  { name: 'NYSE',     lat:  40.7, lon:  -74.0, color: '#4ADE80' },
  { name: 'LSE',      lat:  51.5, lon:   -0.1, color: '#60A5FA' },
  { name: 'TSE',      lat:  35.7, lon:  139.7, color: '#F472B6' },
  { name: 'SSE',      lat:  31.2, lon:  121.5, color: '#FB923C' },
  { name: 'NSE',      lat:  19.1, lon:   72.9, color: '#A78BFA' },
  { name: 'ASX',      lat: -33.9, lon:  151.2, color: '#34D399' },
  { name: 'Euronext', lat:  48.9, lon:    2.3, color: '#FCD34D' },
  { name: 'SGX',      lat:   1.3, lon:  103.8, color: '#22D3EE' },
  { name: 'HKEX',     lat:  22.3, lon:  114.2, color: '#F87171' },
  { name: 'TSX',      lat:  43.7, lon:  -79.4, color: '#86EFAC' },
  { name: 'B3',       lat: -23.5, lon:  -46.6, color: '#FCA5A5' },
  { name: 'MOEX',     lat:  55.8, lon:   37.6, color: '#93C5FD' },
] as const

const ARC_PAIRS: readonly [string, string][] = [
  ['NYSE', 'LSE'],
  ['LSE', 'NSE'],
  ['NSE', 'TSE'],
  ['SGX', 'ASX'],
]

interface Tooltip { name: string; color: string; x: number; y: number }

export default function TradingGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)
  const starsCanvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  // Stars background — drawn once on a 2D canvas
  useEffect(() => {
    const canvas = starsCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = canvas.offsetWidth || 600
    canvas.height = canvas.offsetHeight || 400
    for (let i = 0; i < 200; i++) {
      ctx.beginPath()
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${(0.08 + Math.random() * 0.25).toFixed(2)})`
      ctx.fill()
    }
  }, [])

  // Three.js globe
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let animFrame: number
    let disposed = false
    let isDragging = false
    let prevX = 0
    let prevY = 0

    import('three').then((THREE) => {
      if (disposed || !containerRef.current) return
      const cont = containerRef.current
      const W = cont.clientWidth
      const H = cont.clientHeight

      // Renderer
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setSize(W, H)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)
      cont.appendChild(renderer.domElement)
      renderer.domElement.style.position = 'absolute'
      renderer.domElement.style.inset = '0'

      // Scene + camera
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
      camera.position.z = 2.8

      const R = 1

      // Pivot group — everything that rotates together
      const pivot = new THREE.Group()
      scene.add(pivot)

      // Globe sphere
      pivot.add(new THREE.Mesh(
        new THREE.SphereGeometry(R, 64, 64),
        new THREE.MeshBasicMaterial({ color: 0x0A0F1E })
      ))

      // lat/lon → Vector3
      const ll = (lat: number, lon: number, r: number) => {
        const la = lat * Math.PI / 180
        const lo = lon * Math.PI / 180
        return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), r * Math.cos(la) * Math.sin(lo))
      }

      // Latitude grid lines (every 15°)
      const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
      for (let lat = -75; lat <= 75; lat += 15) {
        const pts = Array.from({ length: 65 }, (_, j) => ll(lat, j * 5.625 - 180, R * 1.001))
        pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat))
      }
      // Longitude grid lines (every 15°)
      for (let lon = -180; lon < 180; lon += 15) {
        const pts = Array.from({ length: 65 }, (_, j) => ll(-90 + j * 2.8125, lon, R * 1.001))
        pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat))
      }

      // Atmosphere glow (outside pivot, spherically symmetric)
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.1, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x0F4C81, transparent: true, opacity: 0.09, side: THREE.BackSide })
      ))

      // Market dots
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outerMeshes: any[] = []
      const dotData = MARKETS.map((m) => {
        const pos = ll(m.lat, m.lon, R * 1.003)
        const hex = parseInt(m.color.slice(1), 16)
        const outer = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 8, 8),
          new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.45 })
        )
        outer.position.copy(pos)
        pivot.add(outer)
        outerMeshes.push(outer)
        const inner = new THREE.Mesh(
          new THREE.SphereGeometry(0.009, 8, 8),
          new THREE.MeshBasicMaterial({ color: hex })
        )
        inner.position.copy(pos)
        pivot.add(inner)
        return { outer, pos, m }
      })

      // Connection arcs
      ARC_PAIRS.forEach(([a, b]) => {
        const ia = MARKETS.findIndex(m => m.name === a)
        const ib = MARKETS.findIndex(m => m.name === b)
        if (ia < 0 || ib < 0) return
        const p1 = dotData[ia].pos.clone()
        const p2 = dotData[ib].pos.clone()
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
        mid.normalize().multiplyScalar(R + 0.38)
        const pts = new THREE.QuadraticBezierCurve3(p1, mid, p2).getPoints(50)
        pivot.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 })
        ))
      })

      // Raycaster for hover tooltips
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      // Event handlers
      const onMouseDown = (e: MouseEvent) => { isDragging = true; prevX = e.clientX; prevY = e.clientY }
      const onMouseMove = (e: MouseEvent) => {
        if (isDragging) {
          pivot.rotation.y += (e.clientX - prevX) * 0.008
          pivot.rotation.x = Math.max(-0.85, Math.min(0.85, pivot.rotation.x + (e.clientY - prevY) * 0.005))
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
            const cW = renderer.domElement.clientWidth
            const cH = renderer.domElement.clientHeight
            setTooltip({ name: dotData[idx].m.name, color: dotData[idx].m.color, x: (wp.x + 1) / 2 * cW, y: -(wp.y - 1) / 2 * cH })
          }
        } else {
          setTooltip(null)
        }
      }
      const onMouseUp = () => { isDragging = false }
      const onTouchStart = (e: TouchEvent) => { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY }
      const onTouchMove = (e: TouchEvent) => {
        if (!isDragging) return
        pivot.rotation.y += (e.touches[0].clientX - prevX) * 0.008
        prevX = e.touches[0].clientX; prevY = e.touches[0].clientY
      }
      const onTouchEnd = () => { isDragging = false }

      renderer.domElement.addEventListener('mousedown', onMouseDown)
      renderer.domElement.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true })
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd)

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      })
      ro.observe(cont)

      // Animation loop
      const animate = () => {
        if (disposed) return
        animFrame = requestAnimationFrame(animate)
        if (!isDragging) pivot.rotation.y += 0.0015
        // Pulse market dots
        const t = Date.now() * 0.003
        dotData.forEach(({ outer }, i) => {
          outer.scale.setScalar(1 + 0.55 * (0.5 + 0.5 * Math.sin(t + i * 0.52)))
        })
        renderer.render(scene, camera)
      }
      animate()

      // Expose cleanup via container property
      ;(cont as typeof cont & { _gc?: () => void })._gc = () => {
        renderer.domElement.removeEventListener('mousedown', onMouseDown)
        renderer.domElement.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        renderer.domElement.removeEventListener('touchstart', onTouchStart)
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
        ro.disconnect()
        renderer.dispose()
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement)
        }
      }
    }).catch(() => {})

    return () => {
      disposed = true
      cancelAnimationFrame(animFrame)
      ;(container as typeof container & { _gc?: () => void })._gc?.()
    }
  }, [])

  return (
    <div>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', cursor: 'grab' }} className="globe-wrap">
        {/* Star field canvas — behind the Three.js canvas */}
        <canvas
          ref={starsCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        {/* Three.js canvas is appended here by the renderer */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -130%)',
            background: 'rgba(10,15,30,0.92)',
            border: `1px solid ${tooltip.color}`,
            borderRadius: 6,
            padding: '4px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: tooltip.color,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            {tooltip.name}
          </div>
        )}
      </div>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'rgba(248,246,241,0.4)',
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 0,
      }}>
        12 markets &middot; 6 continents &middot; 1 companion
      </p>
      <style>{`
        .globe-wrap { height: 400px }
        @media(max-width: 768px) { .globe-wrap { height: 280px } }
      `}</style>
    </div>
  )
}
