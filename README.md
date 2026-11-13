# Lantern Solutions Freight Network

A React and Tailwind web application for connecting freight customers with trucking companies. The marketplace supports public job and truck listings, carrier profiles, distance-based offers, price negotiation, shipment tracking, and delivery confirmation.

## Requirements

- Node.js 20.19 or newer
- npm

## Run locally

Open PowerShell in the project folder and run:

```powershell
npm install
npm run dev
```

Open the **Local** URL printed by Vite, usually `http://localhost:5173/marketplace`. If that port is in use, Vite selects another port; use the URL it prints. Keep the PowerShell process running while using the app.

The root URL (`/`) opens the dashboard. `/marketplace` opens the public launch page.

## Admin setup

On first server start, Lantern creates a random admin setup key in:

```text
data/.lantern-admin-setup-key
```

Read it from the project folder in PowerShell:

```powershell
Get-Content .\data\.lantern-admin-setup-key
```

Use it in **Sign in / Join → Create account → Lantern admin**. Admin setup is one-time: after the first admin account exists, use that account to sign in. Keep the key private. It is ignored by Git and is not served by the website. Set `LANTERN_ADMIN_SETUP_KEY` in the server environment to provide a deployment-specific key; the server writes the configured key to the same private local file for the initial setup.

## Production build

```powershell
npm run build
npm start
```

Then open `http://localhost:4173/marketplace` (or the port set by the `PORT` environment variable). Keep the server process running.

## Main features

- Public truck/company directory and public freight jobs
- Carrier accounts, availability status, and fleet management
- Carrier matching suggestions based on vehicle type, payload, and pickup location
- Distance-based quotes with fuel, toll, loading, and other expenses
- Counteroffers and shipment conversations
- Shipment status and opt-in browser GPS sharing
- Route maps and distance estimates for supported cities
- Private delivery proof with recipient name, drawn signature, notes, and photo
- Invoice CSVs and demo payment/payout records
- Lantern admin tools for carrier review and shipment issue handling
- Light and dark display modes

## Project layout

- `src/` — React interface and frontend features
- `public/` — Lantern logo and display assets
- `marketplace-api.js` — local API, authentication, data storage, and delivery-proof endpoints
- `server.js` — production static server and API host
- `vite.config.js` — Vite development server and API integration
- `data/` — generated private application data; excluded from Git

## Before using it as a live commercial service

This repository is a prototype. It stores app records and delivery photos on the server filesystem in a local JSON store. Sessions are held in memory and expire when the server restarts. Use a production database, persistent session storage, encrypted private object storage, backups, account recovery, and operational monitoring before deploying for real customers. Payment entries and payouts are demonstration records; connect and verify a payment provider before collecting money. Current route estimates use an OpenStreetMap based car-routing service and do not account for every truck restriction; fuel and toll inputs are estimates. Configure a suitable commercial map/routing provider for sustained production traffic.

The included `public/lantern-road.webp` asset contains an iStock watermark. Confirm the image licence permits your intended public use before publishing or distributing the project.

## Upload to GitHub

Create a new empty repository on GitHub, then run these commands from the project folder. Replace the URL with the HTTPS or SSH URL GitHub gives you:

```powershell
git init
git add .
git status
git commit -m "Prepare Lantern freight marketplace"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Before committing, confirm `git status` does not list `data/public-market.json`, `data/.lantern-admin-setup-key`, `data/proofs/`, `node_modules/`, `dist/`, or `work/`. The repository `.gitignore` excludes these local files.
