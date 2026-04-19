export interface TruckSpec {
  id: string
  make: string
  model: string
  /** Slug matching the GLB filename in /models/trucks/ */
  modelFile: string
  engineOptions: string[]
  hpRange: [number, number]
  cabTypes: string[]
  axleConfigs: string[]
  sleeperSizes: string[]
  gcwr_lbs: number
  mpgRange: [number, number]
  features: string[]
}

/**
 * Fleet truck catalog — specs for every truck model available
 * to the dispatcher. Each entry maps to a GLB file in
 * /public/models/trucks/<modelFile>.glb
 */
export const TRUCK_CATALOG: Record<string, TruckSpec> = {
  "freightliner-cascadia": {
    id: "freightliner-cascadia",
    make: "Freightliner",
    model: "Cascadia",
    modelFile: "freightliner-cascadia",
    engineOptions: ["Detroit DD13", "Detroit DD15", "Detroit DD16"],
    hpRange: [350, 505],
    cabTypes: ["Day Cab", "Mid-Roof Sleeper", "72\" Sleeper", "80\" Sleeper"],
    axleConfigs: ["4x2", "6x2", "6x4"],
    sleeperSizes: ["None", "72\"", "80\""],
    gcwr_lbs: 80000,
    mpgRange: [6.5, 8.5],
    features: ["Detroit Assurance 5.0 ADAS", "Integrated Detroit Powertrain", "Aero-optimized"],
  },

  "kenworth-t680": {
    id: "kenworth-t680",
    make: "Kenworth",
    model: "T680",
    modelFile: "kenworth-t680",
    engineOptions: ["PACCAR MX-13", "Cummins X15"],
    hpRange: [400, 565],
    cabTypes: ["Day Cab", "40\" Sleeper", "76\" Sleeper"],
    axleConfigs: ["4x2", "6x2", "6x4"],
    sleeperSizes: ["None", "40\"", "76\""],
    gcwr_lbs: 80000,
    mpgRange: [6.8, 8.5],
    features: ["PACCAR TX-12 Automated Trans", "Predictive Cruise", "Aero cab design"],
  },

  "kenworth-w900": {
    id: "kenworth-w900",
    make: "Kenworth",
    model: "W900",
    modelFile: "kenworth-w900",
    engineOptions: ["PACCAR MX-13", "Cummins X15"],
    hpRange: [400, 605],
    cabTypes: ["Day Cab", "40\" Sleeper", "72\" Sleeper", "86\" Sleeper"],
    axleConfigs: ["6x4"],
    sleeperSizes: ["None", "40\"", "72\"", "86\""],
    gcwr_lbs: 80000,
    mpgRange: [5.5, 7.0],
    features: ["Traditional long-nose", "Chrome options", "Owner-operator favorite"],
  },

  "peterbilt-579": {
    id: "peterbilt-579",
    make: "Peterbilt",
    model: "579",
    modelFile: "peterbilt-579",
    engineOptions: ["PACCAR MX-13", "Cummins X15"],
    hpRange: [400, 565],
    cabTypes: ["Day Cab", "44\" Sleeper", "58\" Sleeper", "80\" UltraLoft"],
    axleConfigs: ["4x2", "6x2", "6x4"],
    sleeperSizes: ["None", "44\"", "58\"", "80\" UltraLoft"],
    gcwr_lbs: 80000,
    mpgRange: [6.5, 8.2],
    features: ["Epiq fuel efficiency package", "UltraLoft stand-up sleeper", "Aero flagship"],
  },

  "volvo-vnl": {
    id: "volvo-vnl",
    make: "Volvo",
    model: "VNL",
    modelFile: "volvo-vnl-780",
    engineOptions: ["Volvo D11", "Volvo D13", "Volvo D13TC"],
    hpRange: [375, 500],
    cabTypes: ["Day Cab", "VNL 740 Sleeper", "VNL 760 Sleeper", "VNL 860 Sleeper"],
    axleConfigs: ["4x2", "6x2", "6x4"],
    sleeperSizes: ["None", "61\"", "77\""],
    gcwr_lbs: 80000,
    mpgRange: [7.0, 9.0],
    features: ["Volvo I-Shift Automated Trans", "Turbo Compound engine option", "Fuel efficiency leader"],
  },

  "mack-anthem": {
    id: "mack-anthem",
    make: "Mack",
    model: "Anthem",
    modelFile: "mack-anthem",
    engineOptions: ["Mack MP8"],
    hpRange: [395, 505],
    cabTypes: ["Day Cab", "48\" Sleeper", "70\" Stand-Up Sleeper"],
    axleConfigs: ["6x4"],
    sleeperSizes: ["None", "48\"", "70\""],
    gcwr_lbs: 80000,
    mpgRange: [6.0, 7.5],
    features: ["mDRIVE Automated Trans", "Mack GuardDog Connect", "Bold grille styling"],
  },
}

/**
 * Resolve a vehicle's make+model to a catalog entry.
 * Returns undefined if no match found.
 */
export function lookupTruck(make: string, model: string): TruckSpec | undefined {
  const key = `${make}-${model}`.toLowerCase().replace(/\s+/g, "-")

  // Direct match
  if (TRUCK_CATALOG[key]) return TRUCK_CATALOG[key]

  // Fuzzy: Volvo VNL 860 / VNL 760 → volvo-vnl
  for (const spec of Object.values(TRUCK_CATALOG)) {
    if (
      spec.make.toLowerCase() === make.toLowerCase() &&
      model.toLowerCase().startsWith(spec.model.toLowerCase())
    ) {
      return spec
    }
  }

  return undefined
}

/**
 * Get the public URL for a truck's 3D model file.
 */
export function truckModelUrl(spec: TruckSpec): string {
  return `/models/trucks/${spec.modelFile}.glb`
}
