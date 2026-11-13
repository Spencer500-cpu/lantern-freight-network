import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, Fuel, MapPin, Navigation, Route as RouteIcon } from 'lucide-react'
import { calculateRoadRoute, routeCities } from './routing.js'
import RouteMap from './RouteMap.jsx'

export default function RoutePlanner({ load, onRoute }) {
  const supported = name => routeCities.some(city => city.name.toLocaleLowerCase() === String(name || '').toLocaleLowerCase())
  const [from, setFrom] = useState(supported(load.from) ? load.from : routeCities[0].name)
  const [to, setTo] = useState(supported(load.to) ? load.to : routeCities[1].name)
  const [route, setRoute] = useState(load.route || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fuelLitresPer100, setFuelLitresPer100] = useState('32')
  const [fuelPrice, setFuelPrice] = useState('1.55')
  const [tolls, setTolls] = useState('18')
  const [other, setOther] = useState('0')
  useEffect(() => {
    setFrom(supported(load.from) ? load.from : routeCities[0].name)
    setTo(supported(load.to) ? load.to : routeCities[1].name)
    setRoute(load.route || null)
  }, [load.id])
  const distanceKm = route?.distanceKm || Number(load.distanceKm || 0)
  const fuelCost = distanceKm * Number(fuelLitresPer100 || 0) / 100 * Number(fuelPrice || 0)
  const estimate = fuelCost + Number(tolls || 0) + Number(other || 0)
  const plan = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await calculateRoadRoute(from, to)
      setRoute(result)
      onRoute(result)
    } catch (reason) { setError(reason.message || 'Could not calculate this road route.') }
    finally { setBusy(false) }
  }
  return <section className="panel route-map-card route-planner-card"><div className="route-planner-heading"><div><span className="ops-icon"><RouteIcon size={17}/></span><div><h3>Road route planner</h3><p>Road distance, route map, and trip cost estimate.</p></div></div><span className="demo-chip">{route ? 'ROAD ROUTE' : 'PLAN A ROUTE'}</span></div><form className="route-picker" onSubmit={plan}><label>Pickup city<select className="form-input" value={from} onChange={event => setFrom(event.target.value)}>{routeCities.map(city => <option key={city.name}>{city.name}</option>)}</select></label><ArrowRight size={15}/><label>Delivery city<select className="form-input" value={to} onChange={event => setTo(event.target.value)}>{routeCities.map(city => <option key={city.name}>{city.name}</option>)}</select></label><button className="primary-btn" disabled={busy}>{busy ? 'Finding road…' : <><Navigation size={14}/> Calculate route</>}</button></form>{error && <p className="route-error" role="alert">{error}</p>}{route ? <><RouteMap route={route}/><div className="route-map-info"><div><span>FROM</span><b>{route.from}</b></div><ArrowRight size={14}/><div><span>TO</span><b>{route.to}</b></div><strong>{route.distanceKm} km</strong></div><div className="route-facts"><span><RouteIcon size={13}/> {Math.round(route.distanceKm)} road kilometres</span><span><Clock3 size={13}/> About {Math.max(1, Math.round(route.durationSeconds / 3600))} hours by car</span><small>Route and duration supplied by an OpenStreetMap based routing service. Truck restrictions may change the actual truck route.</small></div></> : <><div className="route-map-empty"><MapPin size={19}/><span>Calculate a route to see the road path here.</span></div><div className="route-map-info"><div><span>FROM</span><b>{load.from}</b></div><ArrowRight size={14}/><div><span>TO</span><b>{load.to}</b></div><strong>{distanceKm} km</strong></div></>}<div className="estimate-title"><h3>Fuel, tolls & trip costs</h3><span>Planning estimate · USD</span></div><div className="estimate-inputs"><label>Fuel use (L / 100 km)<input type="number" min="0" step="0.1" value={fuelLitresPer100} onChange={event => setFuelLitresPer100(event.target.value)}/></label><label>Fuel price / L<input type="number" min="0" step="0.01" value={fuelPrice} onChange={event => setFuelPrice(event.target.value)}/></label><label>Tolls<input type="number" min="0" step="0.01" value={tolls} onChange={event => setTolls(event.target.value)}/></label><label>Loading / other<input type="number" min="0" step="0.01" value={other} onChange={event => setOther(event.target.value)}/></label></div><div className="estimate-total"><span><Fuel size={12}/> Fuel ${fuelCost.toFixed(2)} + tolls & expenses</span><b>${estimate.toFixed(2)}</b></div><p className="route-attribution">Map © OpenStreetMap contributors · Road routing by OSRM</p></section>
}
