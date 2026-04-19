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
 * Constant screen size in pixels for truck models up to TRUCK_ZOOM_FLOOR.
 * Above that zoom level the scale is held fixed and the camera simply zooms in.
 */
const TRUCK_PIXEL_SIZE = 50
const TRUCK_ZOOM_FLOOR = 14

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
        const root = gltf.scene

        // Step 1: scale so longest axis = 1 unit
        const box1 = new THREE.Box3().setFromObject(root)
        const size = new THREE.Vector3()
        box1.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 0) root.scale.multiplyScalar(1 / maxDim)

        // Step 2: recompute bbox *after* scale is applied, then center XY
        // and lift so the bounding-box bottom sits exactly at z=0 (wheels on ground)
        const box2 = new THREE.Box3().setFromObject(root)
        const center = new THREE.Vector3()
        box2.getCenter(center)
        root.position.x -= center.x
        root.position.y -= center.y
        root.position.z -= box2.min.z

        // Disable depth testing so trucks always render on top of the map surface.
        // Without this, at high zoom the tile z-buffer beats trucks at z=0 Mercator.
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            mats.forEach((m) => {
              m.depthTest = false
              m.depthWrite = false
            })
          }
        })

        glbCache.set(url, root)
        resolve(root.clone())
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
    group.position.set(mc.x, mc.y, mc.z ?? 0)
    // Heading: degrees clockwise from north → radians counter-clockwise around Z
    group.rotation.z = -(driver.location.heading * Math.PI) / 180
    // Scale is updated every frame in render() for constant screen size
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

        // Constant screen size up to TRUCK_ZOOM_FLOOR; above that, hold the
        // Mercator scale fixed so the camera simply zooms into the model.
        const effectiveZoom = Math.min(map.getZoom(), TRUCK_ZOOM_FLOOR)
        const s = TRUCK_PIXEL_SIZE / (512 * Math.pow(2, effectiveZoom))
        for (const group of trucksRef.current.values()) {
          group.scale.setScalar(s)
        }

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
          // Another promise (from a re-render) may have already added this driver.
          // If so, discard this result to prevent orphaned giant wrappers.
          if (trucksRef.current.has(driver.driver_id)) return
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
