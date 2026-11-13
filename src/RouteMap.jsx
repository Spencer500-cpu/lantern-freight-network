import { routeMapLayout } from './routing.js'

export default function RouteMap({ route, className = '' }) {
  const layout = routeMapLayout(route?.coordinates)
  if (!layout) return <div className={`route-real-map route-map-placeholder ${className}`}>Calculate a road route to display the map.</div>
  const worldWidth = layout.cols * 256
  const worldHeight = layout.rows * 256
  const offsetX = (layout.width - worldWidth * layout.scale) / 2
  const offsetY = (layout.height - worldHeight * layout.scale) / 2
  const linePoints = layout.points.map(point => point.join(',')).join(' ')
  const [startX, startY] = layout.points[0]
  const [endX, endY] = layout.points[layout.points.length - 1]
  return <div className={`route-real-map ${className}`}>
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`Road route from ${route.from} to ${route.to}`}>
      <g transform={`translate(${offsetX} ${offsetY}) scale(${layout.scale})`}>
        {Array.from({ length: layout.rows }, (_, y) => Array.from({ length: layout.cols }, (_, x) => {
          const tileX = layout.x0 + x; const tileY = layout.y0 + y
          return <image key={`${tileX}-${tileY}`} href={`https://tile.openstreetmap.org/${layout.zoom}/${tileX}/${tileY}.png`} x={x * 256} y={y * 256} width="256" height="256" />
        }))}
        <polyline points={linePoints} fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points={linePoints} fill="none" stroke="#12a7a4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={startX} cy={startY} r="8" fill="#138e84" stroke="#fff" strokeWidth="3"/>
        <circle cx={endX} cy={endY} r="8" fill="#df714c" stroke="#fff" strokeWidth="3"/>
      </g>
    </svg>
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="route-map-attribution">© OpenStreetMap contributors</a>
  </div>
}
