const words = value => String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function matchTruckToLoad(truck, load) {
  const vehicle = words(truck.vehicle)
  const requiredVehicle = words(load.vehicle)
  const categories = ['refrigerated','flatbed','dropside','tipper','box','tractor']
  const requestedCategory = categories.find(category => requiredVehicle.includes(category))
  const typeMatch = !requiredVehicle || requiredVehicle.includes('any suitable') || !requestedCategory || vehicle.includes(requestedCategory)
  const truckCapacity = Number(String(truck.capacity || '').match(/[\d.]+/)?.[0] || 0)
  const cargoWeight = Number(String(load.cargo || '').match(/([\d.]+)\s*(?:t|tonnes?)(?![a-z])/i)?.[1] || 0)
  const capacityMatch = !cargoWeight || !truckCapacity || truckCapacity >= cargoWeight
  const base = words(truck.location || truck.baseCity).split(' ')[0]
  const origin = words(load.from).split(' ')[0]
  const nearOrigin = Boolean(base && origin && (base === origin || base.startsWith(origin) || origin.startsWith(base)))
  const score = (typeMatch ? 50 : 0) + (capacityMatch ? 35 : 0) + (nearOrigin ? 15 : 0)
  const reasons = [typeMatch && 'truck type', capacityMatch && 'load capacity', nearOrigin && 'near pickup'].filter(Boolean)
  return { score, reasons, typeMatch, capacityMatch, nearOrigin }
}

export function rankTrucksForJob(trucks, load) {
  return trucks.map(truck => ({ truck, ...matchTruckToLoad(truck, load) })).sort((a, b) => b.score - a.score || Number(a.truck.rate || 0) - Number(b.truck.rate || 0))
}
