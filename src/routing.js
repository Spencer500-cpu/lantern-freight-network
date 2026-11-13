export const routeCities = [
  { name: 'Harare', lat: -17.8252, lon: 31.0335 }, { name: 'Bulawayo', lat: -20.1325, lon: 28.6265 },
  { name: 'Mutare', lat: -18.9707, lon: 32.6709 }, { name: 'Gweru', lat: -19.4552, lon: 29.8183 },
  { name: 'Masvingo', lat: -20.0744, lon: 30.8328 }, { name: 'Chinhoyi', lat: -17.3667, lon: 30.2 },
  { name: 'Kadoma', lat: -18.3333, lon: 29.9 }, { name: 'Kwekwe', lat: -18.9281, lon: 29.8149 },
  { name: 'Marondera', lat: -18.1853, lon: 31.5519 }, { name: 'Beitbridge', lat: -22.2167, lon: 30.0 },
  { name: 'Hwange', lat: -18.3693, lon: 26.5019 }, { name: 'Victoria Falls', lat: -17.9318, lon: 25.8302 },
  { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 }, { name: 'Pretoria', lat: -25.7479, lon: 28.2293 },
  { name: 'Durban', lat: -29.8587, lon: 31.0218 }, { name: 'Lusaka', lat: -15.3875, lon: 28.3228 },
  { name: 'Maputo', lat: -25.9692, lon: 32.5732 }, { name: 'Gaborone', lat: -24.6282, lon: 25.9231 },
]

export function findRouteCity(value) {
  const key = String(value || '').trim().toLocaleLowerCase()
  return routeCities.find(city => city.name.toLocaleLowerCase() === key)
}

export async function calculateRoadRoute(fromName, toName) {
  const from = findRouteCity(fromName)
  const to = findRouteCity(toName)
  if (!from || !to) throw new Error(`Choose a listed route city: ${routeCities.map(city => city.name).join(', ')}.`)
  if (from.name === to.name) throw new Error('Pickup and delivery must be different cities.')
  const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`)
  if (!response.ok) throw new Error('The road-routing service is unavailable. Try again shortly.')
  const data = await response.json()
  const route = data.routes?.[0]
  if (data.code !== 'Ok' || !route) throw new Error('A drivable road route was not found for those cities.')
  return { distanceKm: Math.round(route.distance / 100) / 10, durationSeconds: Math.round(route.duration), coordinates: route.geometry.coordinates, from: from.name, to: to.name, source: 'OpenStreetMap road network' }
}

function project([lon, lat], zoom) {
  const scale = 256 * (2 ** zoom)
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale }
}

export function routeMapLayout(coordinates, width = 800, height = 320) {
  if (!coordinates?.length) return null
  for (let zoom = 9; zoom >= 3; zoom -= 1) {
    const points = coordinates.map(point => project(point, zoom))
    const minX = Math.min(...points.map(point => point.x)); const maxX = Math.max(...points.map(point => point.x))
    const minY = Math.min(...points.map(point => point.y)); const maxY = Math.max(...points.map(point => point.y))
    const x0 = Math.floor(minX / 256); const x1 = Math.floor(maxX / 256)
    const y0 = Math.floor(minY / 256); const y1 = Math.floor(maxY / 256)
    const cols = x1 - x0 + 1; const rows = y1 - y0 + 1
    if (cols * 256 <= width * 1.5 && rows * 256 <= height * 1.5) {
      return { zoom, points: points.map(point => [point.x - x0 * 256, point.y - y0 * 256]), cols, rows, x0, y0, scale: Math.min(width / (cols * 256), height / (rows * 256)), width, height }
    }
  }
  return null
}
