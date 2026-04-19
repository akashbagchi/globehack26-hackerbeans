import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import mapboxgl, { type CustomLayerInterface } from 'mapbox-gl'
import { useFleetStore } from '../../store/fleetStore'
import { lookupTruck, truckModelUrl } from '../../data/truckCatalog'
import type { Driver } from '../../types'

interface TruckModelLayerProps {
  map: mapboxgl.Map
}

const LAYER_ID = '3d-trucks'

/**
 * How many real-world meters the truck model should span on the map.
 * Exaggerated so trucks are visible at regional zoom levels.
 */
const TRUCK_DISPLAY_METERS = 15000

// --- Loaders (singleton) ---
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

/** Cache loaded & normalized GLTF scenes keyed by URL */
const glbCache = new Map<string, THREE.Group>()

function loadModel(url: string): Promise<THREE.Group> {
  const cached = glbCache.get(url)
  if (cached) return Promise.resolve(cached.clone())

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        // Normalize so longest axis = 1 unit, centered at origin
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 0) gltf.scene.scale.multiplyScalar(1 / maxDim)

        const center = new THREE.Vector3()
        box.getCenter(center).multiplyScalar(1 / maxDim)
        gltf.scene.position.sub(center)

        // Shift up so the bottom (wheels) sits on the ground plane
        const normBox = new THREE.Box3().setFromObject(gltf.scene)
        gltf.scene.position.z -= normBox.min.z

        glbCache.set(url, gltf.scene)
        resolve(gltf.scene.clone())
      },
      undefined,
      reject,
    )
  })
}

export function TruckModelLayer({ map }: TruckModelLayerProps) {
  const drivers = useFleetStore((s) => s.drivers)

  const driversRef = useRef(drivers)
  driversRef.current = drivers

  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const trucksRef = useRef<Map<string, THREE.Group>>(new Map())

  const placeTruck = (group: THREE.Group, driver: Driver) => {
    const mc = mapboxgl.MercatorCoordinate.fromLngLat(
      [driver.location.lng, driver.location.lat],
      0,
    )
    const s = mc.meterInMercatorCoordinateUnits() * TRUCK_DISPLAY_METERS

    group.position.set(mc.x, mc.y, mc.z ?? 0)
    group.scale.set(s, s, s)
    // Heading: degrees clockwise from north → radians counter-clockwise around Z
    group.rotation.z = -(driver.location.heading * Math.PI) / 180
  }

  // Set up Three.js custom layer
  useEffect(() => {
    if (map.getLayer(LAYER_ID)) return

    const scene = new THREE.Scene()
    const camera = new THREE.Camera()
    sceneRef.current = scene
    cameraRef.current = camera

    scene.add(new THREE.AmbientLight(0xffffff, 1.5))
    const dir = new THREE.DirectionalLight(0xffffff, 1.5)
    dir.position.set(1, 2, 3).normalize()
    scene.add(dir)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.8))

    const customLayer: CustomLayerInterface = {
      id: LAYER_ID,
      type: 'custom',
      renderingMode: '3d',

      onAdd(_map, gl) {
        rendererRef.current = new THREE.WebGLRenderer({
          canvas: _map.getCanvas(),
          context: gl as unknown as WebGLRenderingContext,
          antialias: true,
        })
        rendererRef.current.autoClear = false
      },

      render(_gl, matrix) {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
        cameraRef.current.projectionMatrix = new THREE.Matrix4().fromArray(
          matrix as unknown as number[],
        )
        rendererRef.current.resetState()
        rendererRef.current.render(sceneRef.current, cameraRef.current)
        map.triggerRepaint()
      },
    }

    map.addLayer(customLayer)

    return () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      for (const g of trucksRef.current.values()) {
        g.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose()
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            mats.forEach((m) => m.dispose())
          }
        })
      }
      trucksRef.current.clear()
      rendererRef.current?.dispose()
    }
  }, [map])

  // Sync truck models with driver data
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const activeIds = new Set(drivers.map((d) => d.driver_id))

    for (const [id, group] of trucksRef.current) {
      if (!activeIds.has(id)) {
        scene.remove(group)
        trucksRef.current.delete(id)
      }
    }

    for (const driver of drivers) {
      const spec = lookupTruck(driver.vehicle.make, driver.vehicle.model)
      if (!spec) continue

      const existing = trucksRef.current.get(driver.driver_id)
      if (existing) {
        placeTruck(existing, driver)
      } else {
        const url = truckModelUrl(spec)
        loadModel(url).then((model) => {
          if (!sceneRef.current) return
          const wrapper = new THREE.Group()
          wrapper.add(model)
          placeTruck(wrapper, driver)
          sceneRef.current.add(wrapper)
          trucksRef.current.set(driver.driver_id, wrapper)
          map.triggerRepaint()
        })
      }
    }

    map.triggerRepaint()
  }, [drivers, map])

  return null
}
