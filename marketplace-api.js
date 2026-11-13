import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const here = path.dirname(fileURLToPath(import.meta.url))
const storePath = path.join(here, 'data', 'public-market.json')
const proofPath = path.join(here, 'data', 'proofs')
const adminSetupKeyPath = path.join(here, 'data', '.lantern-admin-setup-key')
let writes = Promise.resolve()
const sessions = new Map()
const failures = new Map()

const adminSetupKeyReady = loadOrCreateAdminSetupKey()

async function loadOrCreateAdminSetupKey() {
  await fs.mkdir(path.dirname(adminSetupKeyPath), { recursive: true })
  const configured = process.env.LANTERN_ADMIN_SETUP_KEY
  if (configured) {
    await fs.writeFile(adminSetupKeyPath, configured, { encoding: 'utf8', mode: 0o600 })
    return configured
  }
  try { return (await fs.readFile(adminSetupKeyPath, 'utf8')).trim() }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    const generated = randomBytes(32).toString('hex')
    try {
      await fs.writeFile(adminSetupKeyPath, generated, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      console.info('[Lantern] Generated the admin setup key. Read it from data/.lantern-admin-setup-key on the server.')
      return generated
    } catch (writeError) {
      if (writeError.code !== 'EEXIST') throw writeError
      return (await fs.readFile(adminSetupKeyPath, 'utf8')).trim()
    }
  }
}

async function readStore() {
  try { return JSON.parse(await fs.readFile(storePath, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return { loads: null, companyProfile: null, companyActive: false, users: [] }; throw error }
}

async function writeStore(data) {
  writes = writes.then(async () => {
    await fs.mkdir(path.dirname(storePath), { recursive: true })
    const tempPath = `${storePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8')
    await fs.rename(tempPath, storePath)
  })
  await writes
}

export async function marketplaceApi(req, res, next) {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (pathname.startsWith('/api/auth/')) return authApi(req, res, pathname)
  const proofMatch = pathname.match(/^\/api\/marketplace\/([^/]+)\/delivery-proof(?:\/photo)?$/)
  if (proofMatch) {
    const loadId = decodeURIComponent(proofMatch[1])
    const actor = await sessionUser(req)
    res.setHeader('Cache-Control', 'no-store')
    if (!actor) { res.statusCode = 401; res.end(JSON.stringify({ error: 'Sign in to access delivery proof.' })); return }
    const store = await readStore()
    const load = (store.loads || []).find(item => item.id === loadId)
    const participant = load && (actor.role === 'admin' || load.ownerUserId === actor.id || load.acceptedCarrierUserId === actor.id)
    if (!participant) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Shipment not found.' })); return }
    if (req.method === 'GET' && pathname.endsWith('/photo')) {
      if (!load.deliveryProof?.photoId) { res.statusCode = 404; res.end(JSON.stringify({ error: 'No delivery photo has been uploaded.' })); return }
      try {
        const photo = await fs.readFile(path.join(proofPath, `${load.deliveryProof.photoId}.jpg`))
        res.statusCode = 200
        res.setHeader('Content-Type', 'image/jpeg')
        res.end(photo)
      } catch { res.statusCode = 404; res.end(JSON.stringify({ error: 'Delivery photo is not available.' })) }
      return
    }
    if (req.method === 'POST' && !pathname.endsWith('/photo')) {
      if (actor.role !== 'admin' && actor.role !== 'carrier') { res.statusCode = 403; res.end(JSON.stringify({ error: 'Only the delivering carrier or a Lantern admin can submit proof.' })); return }
      if (!['In transit','Picked up'].includes(load.status)) { res.statusCode = 409; res.end(JSON.stringify({ error: 'Update the shipment to Picked up or In transit before confirming delivery.' })); return }
      const data = await readRequestJson(req, 2_500_000)
      const recipientName = String(data.recipientName || '').trim().slice(0, 100)
      const notes = String(data.notes || '').trim().slice(0, 1000)
      const strokes = Array.isArray(data.signature) ? data.signature : []
      const photoMatch = String(data.photoDataUrl || '').match(/^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/)
      const photoBytes = photoMatch ? Buffer.from(photoMatch[1], 'base64') : null
      const pointCount = strokes.reduce((sum, stroke) => sum + (Array.isArray(stroke) ? stroke.length : 0), 0)
      if (!recipientName || !strokes.length || pointCount < 2 || pointCount > 12000 || !photoBytes || photoBytes.length > 1_500_000) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'Enter the recipient name, capture a signature, and attach a photo under 1.5 MB.' })); return
      }
      const photoId = randomBytes(16).toString('hex')
      await fs.mkdir(proofPath, { recursive: true })
      await fs.writeFile(path.join(proofPath, `${photoId}.jpg`), photoBytes, { flag: 'wx' })
      const confirmedAt = new Date().toISOString()
      load.status = 'Delivered'
      load.deliveryConfirmedAt = confirmedAt
      load.deliveryProof = { recipientName, notes, signature: strokes, photoId, confirmedAt, confirmedByUserId: actor.id }
      await writeStore(store)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: true, status: load.status, deliveryConfirmedAt: confirmedAt, deliveryProof: load.deliveryProof }))
      return
    }
    res.statusCode = 405; res.end(JSON.stringify({ error: 'Unsupported delivery proof request.' })); return
  }
  if (pathname === '/api/marketplace/private' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    const actor = await sessionUser(req)
    if (!actor) { res.statusCode = 401; res.end(JSON.stringify({ error: 'Sign in to access private account data.' })); return }
    const store = await readStore()
    res.statusCode = 200
    res.end(JSON.stringify(privateView(store, actor)))
    return
  }
  if (pathname !== '/api/marketplace') return next?.()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      res.statusCode = 200
      const store = await readStore()
      res.end(JSON.stringify({ loads: store.loads?.map(publicLoad) ?? null, companies: publicCompanies(store), companyProfile: publicCompany(store.companyProfile), companyActive: store.companyActive, updatedAt: store.updatedAt }))
      return
    }
    if (req.method !== 'PUT') {
      res.statusCode = 405
      res.end(JSON.stringify({ error: 'Use GET or PUT for marketplace data.' }))
      return
    }
    const actor = await sessionUser(req)
    if (!actor) {
      res.statusCode = 401
      res.end(JSON.stringify({ error: 'Sign in to publish or update marketplace data.' }))
      return
    }
    let raw = ''
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > 4_000_000) {
        res.statusCode = 413
        res.end(JSON.stringify({ error: 'Marketplace update is too large.' }))
        return
      }
    }
    const next = JSON.parse(raw || '{}')
    const previous = await readStore()
    const store = {
      ...previous,
      ...mergeForActor(previous, next, actor),
      updatedAt: new Date().toISOString(),
    }
    await writeStore(store)
    res.statusCode = 200
    res.end(JSON.stringify({ ok: true, updatedAt: store.updatedAt }))
  } catch (error) {
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Could not update marketplace data.' }))
  }
}

function publicLoad(load) {
  if (!load) return load
  const { ownerUserId, paymentStatus, documents, messages, dispute, rating, deliveryConfirmedAt, deliveryProof, tracking, ...publicFields } = load
  return { ...publicFields, truckOffers: (load.truckOffers || []).map(({ companyUserId, ...offer }) => offer) }
}

function publicCompany(profile) {
  if (!profile) return null
  const { registrationNumber, contactName, phone, email, plate, ownerUserId, ...publicFields } = profile
  return { ...publicFields, fleet: (profile.fleet || []).map(({ plate: privatePlate, ...vehicle }) => vehicle) }
}

function companyRecords(store) {
  if (Array.isArray(store.companies)) return store.companies
  return store.companyProfile ? [{ ...store.companyProfile, active: Boolean(store.companyActive) }] : []
}

function publicCompanies(store) {
  return companyRecords(store).filter(company => company.active).map(profile => ({ ...publicCompany(profile), active: true }))
}

function privateView(store, actor) {
  const admin = actor.role === 'admin'
  const companyProfile = companyRecords(store).find(profile => profile.ownerUserId === actor.id) || (store.companyProfile?.ownerUserId === actor.id ? store.companyProfile : null)
  const loads = (store.loads || []).map(load => {
    const owner = load.ownerUserId === actor.id
    const carrierOffer = (load.truckOffers || []).some(offer => offer.companyUserId === actor.id)
    return admin || owner || (carrierOffer && (!load.deliveryProof || load.acceptedCarrierUserId === actor.id)) ? load : publicLoad(load)
  })
  return {
    loads,
    companyProfile: admin ? store.companyProfile : companyProfile,
    companyActive: Boolean(companyProfile?.active ?? store.companyActive),
    companies: admin ? companyRecords(store) : publicCompanies(store),
    updatedAt: store.updatedAt,
  }
}

function mergeForActor(previous, next, actor) {
  const isAdmin = actor.role === 'admin'
  const oldLoads = previous.loads || []
  const incomingLoads = Array.isArray(next.loads) ? next.loads : oldLoads
  let loads
  if (isAdmin) {
    loads = incomingLoads
  } else {
    const incomingById = new Map(incomingLoads.map(load => [load.id, load]))
    loads = oldLoads.map(oldLoad => {
      const updated = incomingById.get(oldLoad.id)
      if (!updated) return oldLoad
      if (oldLoad.ownerUserId === actor.id && actor.role === 'shipper') return updated
      if (actor.role === 'carrier') {
        const oldOffers = oldLoad.truckOffers || []
        const newOffers = updated.truckOffers || []
        const ownOffers = newOffers.filter(offer => offer.companyUserId === actor.id)
        const changedOwnOffers = ownOffers.some(offer => JSON.stringify(offer) !== JSON.stringify(oldOffers.find(oldOffer => oldOffer.companyUserId === actor.id && oldOffer.company === offer.company)))
        const hasOwnOffer = ownOffers.length > 0
        if (!hasOwnOffer && !oldOffers.some(offer => offer.companyUserId === actor.id)) return oldLoad
        const otherOffers = oldOffers.filter(offer => offer.companyUserId !== actor.id)
        const safe = { ...oldLoad, truckOffers: [...otherOffers, ...ownOffers] }
        if (changedOwnOffers || newOffers.length > oldOffers.length) {
          safe.offers = safe.truckOffers.length
          safe.status = updated.status === 'Offer received' ? 'Offer received' : oldLoad.status
        }
        if (oldOffers.some(offer => offer.companyUserId === actor.id) || hasOwnOffer) {
          if (['Picked up','In transit','Delivered'].includes(updated.status)) safe.status = updated.status
          if (updated.tracking?.sharing) safe.tracking = updated.tracking
          if (updated.deliveryConfirmedAt) safe.deliveryConfirmedAt = updated.deliveryConfirmedAt
          if (Array.isArray(updated.messages)) safe.messages = updated.messages
          if (Array.isArray(updated.documents)) safe.documents = updated.documents
        }
        return safe
      }
      return oldLoad
    })
    if (actor.role === 'shipper') {
      for (const load of incomingLoads) if (!oldLoads.some(old => old.id === load.id) && load.ownerUserId === actor.id) loads.unshift(load)
    }
  }
  const records = companyRecords(previous)
  const ownsCompany = records.some(company => company.ownerUserId === actor.id) || previous.companyProfile?.ownerUserId === actor.id
  const canEditCompany = isAdmin || (actor.role === 'carrier' && (ownsCompany || (next.companyProfile?.ownerUserId === actor.id)))
  let companies = records
  if (isAdmin && Array.isArray(next.companies)) companies = next.companies
  else if (actor.role === 'carrier' && canEditCompany && next.companyProfile) {
    const profile = { ...next.companyProfile, ownerUserId: actor.id, active: next.companyActive === undefined ? Boolean(next.companyProfile.active) : Boolean(next.companyActive) }
    const index = records.findIndex(company => company.ownerUserId === actor.id)
    companies = [...records]
    if (index >= 0) companies[index] = profile
    else companies.push(profile)
  }
  return {
    loads,
    companies,
    companyProfile: isAdmin ? (next.companyProfile === undefined ? previous.companyProfile : next.companyProfile) : previous.companyProfile,
    companyActive: isAdmin ? (next.companyActive === undefined ? previous.companyActive : Boolean(next.companyActive)) : previous.companyActive,
  }
}

function cookieValue(req, key) {
  const cookies = (req.headers.cookie || '').split(';').map(item => item.trim())
  const prefix = `${key}=`
  return cookies.find(item => item.startsWith(prefix))?.slice(prefix.length)
}

function setSessionCookie(req, res, token, maxAge = 60 * 60 * 24 * 7) {
  const https = req.socket?.encrypted || req.headers['x-forwarded-proto'] === 'https'
  res.setHeader('Set-Cookie', `lantern_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${https ? '; Secure' : ''}`)
}

async function readRequestJson(req, maxBytes = 65536) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > maxBytes) throw new Error('Request too large')
  }
  return JSON.parse(raw || '{}')
}

async function sessionUser(req) {
  const session = sessions.get(cookieValue(req, 'lantern_session'))
  if (!session || session.expiresAt < Date.now()) return null
  const store = await readStore()
  return store.users.find(user => user.id === session.userId) || null
}

function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null
}

async function authApi(req, res, pathname) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      res.statusCode = 200
      res.end(JSON.stringify({ user: publicUser(await sessionUser(req)) }))
      return
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      sessions.delete(cookieValue(req, 'lantern_session'))
      setSessionCookie(req, res, '', 0)
      res.statusCode = 200
      res.end(JSON.stringify({ ok: true }))
      return
    }
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const data = await readRequestJson(req)
      const name = String(data.name || '').trim().slice(0, 100)
      const email = String(data.email || '').trim().toLowerCase().slice(0, 254)
      const password = String(data.password || '')
      const requestedRole = data.role === 'carrier' ? 'carrier' : data.role === 'admin' ? 'admin' : 'shipper'
      if (!name || !email.includes('@') || password.length < 12) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Enter a name, valid email, and password of at least 12 characters.' }))
        return
      }
      const store = await readStore()
      const adminSetupKey = await adminSetupKeyReady
      if (requestedRole === 'admin' && store.users?.some(user => user.role === 'admin')) {
        res.statusCode = 409
        res.end(JSON.stringify({ error: 'Lantern admin setup is already complete. Sign in with the existing admin account.' }))
        return
      }
      if (requestedRole === 'admin' && data.adminSetupKey !== adminSetupKey) {
        res.statusCode = 403
        res.end(JSON.stringify({ error: 'That key does not match this Lantern server. Read the current key from data/.lantern-admin-setup-key on the server.' }))
        return
      }
      store.users ||= []
      store.users ||= []
      if (store.users.some(user => user.email === email)) {
        res.statusCode = 409
        res.end(JSON.stringify({ error: 'An account already exists for this email.' }))
        return
      }
      const salt = randomBytes(16).toString('hex')
      const hash = scryptSync(password, salt, 64).toString('hex')
      const user = { id: randomBytes(16).toString('hex'), name, email, role: requestedRole, salt, hash, createdAt: new Date().toISOString() }
      store.users.push(user)
      await writeStore(store)
      const token = randomBytes(32).toString('hex')
      sessions.set(token, { userId: user.id, expiresAt: Date.now() + 7 * 86400000 })
      setSessionCookie(req, res, token)
      res.statusCode = 201
      res.end(JSON.stringify({ user: publicUser(user) }))
      return
    }
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const data = await readRequestJson(req)
      const email = String(data.email || '').trim().toLowerCase()
      const address = String(req.socket?.remoteAddress || 'unknown')
      const failure = failures.get(address)
      if (failure && failure.until > Date.now() && failure.count >= 10) {
        res.statusCode = 429
        res.end(JSON.stringify({ error: 'Too many login attempts. Try again in 15 minutes.' }))
        return
      }
      const store = await readStore()
      const user = store.users?.find(candidate => candidate.email === email)
      const candidate = user ? scryptSync(String(data.password || ''), user.salt, 64) : Buffer.alloc(64)
      const valid = user && timingSafeEqual(candidate, Buffer.from(user.hash, 'hex'))
      if (!valid) {
        const current = failures.get(address)
        failures.set(address, { count: current && current.until > Date.now() ? current.count + 1 : 1, until: Date.now() + 15 * 60 * 1000 })
        res.statusCode = 401
        res.end(JSON.stringify({ error: 'Email or password is incorrect.' }))
        return
      }
      failures.delete(address)
      const token = randomBytes(32).toString('hex')
      sessions.set(token, { userId: user.id, expiresAt: Date.now() + 7 * 86400000 })
      setSessionCookie(req, res, token)
      res.statusCode = 200
      res.end(JSON.stringify({ user: publicUser(user) }))
      return
    }
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'Unsupported authentication request.' }))
  } catch (error) {
    console.error('[Lantern auth] Account request failed:', error)
    res.statusCode = 400
    res.end(JSON.stringify({ error: 'Could not process the account request.' }))
  }
}
