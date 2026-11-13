import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Camera, Check, Eraser, PenLine, Upload } from 'lucide-react'

export default function DeliveryProofForm({ load, onComplete, notify }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const [strokes, setStrokes] = useState([])
  const [currentStroke, setCurrentStroke] = useState([])
  const [recipientName, setRecipientName] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const point = event => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))]
  }
  const startStroke = event => { event.currentTarget.setPointerCapture(event.pointerId); drawingRef.current = true; setCurrentStroke([point(event)]) }
  const moveStroke = event => { if (drawingRef.current) setCurrentStroke(previous => [...previous, point(event)]) }
  const endStroke = () => { if (!drawingRef.current) return; drawingRef.current = false; setStrokes(previous => currentStroke.length ? [...previous, currentStroke] : previous); setCurrentStroke([]) }
  const clearSignature = () => { setStrokes([]); setCurrentStroke([]) }
  const allStrokes = currentStroke.length ? [...strokes, currentStroke] : strokes
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#15345a'; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round'
    for (const stroke of allStrokes) {
      if (!stroke.length) continue
      context.beginPath(); context.moveTo(stroke[0][0] * canvas.width, stroke[0][1] * canvas.height)
      for (const [x,y] of stroke.slice(1)) context.lineTo(x * canvas.width, y * canvas.height)
      if (stroke.length === 1) context.lineTo(stroke[0][0] * canvas.width + 0.1, stroke[0][1] * canvas.height + 0.1)
      context.stroke()
    }
  }, [strokes, currentStroke])
  const imageData = () => {
    const source = photo?.file
    if (!source) return Promise.resolve('')
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const ratio = Math.min(1, 1200 / image.width, 900 / image.height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio))
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.76))
      }
      image.onerror = reject
      image.src = URL.createObjectURL(source)
    })
  }
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const photoDataUrl = await imageData()
      const response = await fetch(`/api/marketplace/${encodeURIComponent(load.id)}/delivery-proof`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientName, notes, signature: allStrokes, photoDataUrl }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save delivery proof.')
      onComplete(result)
      notify(`${load.id} delivery confirmed and proof saved securely.`)
    } catch (reason) { setError(reason.message || 'Could not save delivery proof.') }
    finally { setBusy(false) }
  }
  if (load.deliveryProof) return <div className="delivery-proof-record"><div className="delivery-proof"><BadgeCheck size={17}/><div><b>Delivery proof recorded</b><span>{new Date(load.deliveryProof.confirmedAt).toLocaleString()}</span></div></div><p><b>Received by:</b> {load.deliveryProof.recipientName}</p>{load.deliveryProof.notes && <p>{load.deliveryProof.notes}</p>}<img src={`/api/marketplace/${encodeURIComponent(load.id)}/delivery-proof/photo`} alt="Private delivery confirmation photo"/><p className="route-attribution">Delivery photo and signature are only available to this shipment’s participants.</p></div>
  if (load.status !== 'Picked up' && load.status !== 'In transit') return <div className="proof-locked">Move the shipment to <b>Picked up</b> or <b>In transit</b> to record delivery proof.</div>
  return <form className="delivery-proof-form" onSubmit={submit}><div className="delivery-proof-title"><span className="ops-icon"><BadgeCheck size={17}/></span><div><h3>Proof of delivery</h3><p>Capture the recipient’s signature and a delivery photo for {load.id}.</p></div></div><label className="form-label">Recipient full name<input className="form-input" required maxLength={100} value={recipientName} onChange={event => setRecipientName(event.target.value)} placeholder="Name of person receiving the goods"/></label><label className="form-label">Delivery note <span className="optional-label">Optional</span><textarea className="form-input" maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Condition, package count, or delivery details"/></label><div className="signature-head"><span><PenLine size={13}/> Recipient signature</span><button type="button" className="secondary-btn" onClick={clearSignature}><Eraser size={12}/> Clear</button></div><canvas ref={canvasRef} width="700" height="180" className="signature-canvas" onPointerDown={startStroke} onPointerMove={moveStroke} onPointerUp={endStroke} onPointerCancel={endStroke} aria-label="Draw recipient signature"/><p className="signature-hint">Sign above using a finger, stylus, or mouse.</p><label className="proof-photo-picker"><Camera size={16}/><span>{photo ? photo.file.name : 'Add delivery photo'}</span><Upload size={14}/><input type="file" accept="image/*" capture="environment" onChange={event => { const file = event.target.files?.[0]; if (file) { setPhoto({ file, preview: URL.createObjectURL(file) }); setError('') } }}/></label>{photo && <img className="proof-photo-preview" src={photo.preview} alt="Delivery photo preview"/>}<button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Saving proof…' : <><Check size={14}/> Confirm delivery with proof</>}</button>{error && <p className="route-error" role="alert">{error}</p>}<p className="integration-note">The photo and signature are stored privately on this server and visible only to shipment participants.</p></form>
}
