# GharMap India — Full-Stack Real Estate

React (Vite) frontend and Express backend for India-only property listings. SQLite stores accounts, sessions, and listings. Customers browse homes; dealers can publish listings from their own workspace.

## Project structure

```
full_stack_website/
├── client/                 # React + Vite frontend
│   ├── .env.example        # Google Maps API key template
│   ├── src/
│   └── vite.config.js      # Dev proxy → http://127.0.0.1:3001
├── server/                 # Express REST API
│   ├── db.js               # SQLite schema, auth, and property queries
│   └── index.js
└── package.json
```

## Google Maps setup (demo / Embed key only)

This app uses only the **Maps Embed API** iframe (no Maps JavaScript API), which suits demo and student keys.

1. Put your demo key in `client/.env`:

```
VITE_GOOGLE_MAPS_API_KEY=your_demo_key_here
```

2. Enable **Maps Embed API** for that key in Google Cloud Console (if required).
3. Restart the Vite client after changing `.env`.

## Property shape

```json
{
  "id": 1,
  "title": "Sea-Facing 3BHK in Bandra West",
  "price": 45000000,
  "listingType": "sale",
  "bedrooms": 3,
  "address": "Carter Road, Bandra West, Mumbai, Maharashtra",
  "contactNumber": "+91 90000 00001",
  "image": "https://...",
  "coordinates": {
    "latitude": 19.0596,
    "longitude": 72.8295
  }
}
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/properties` | Listings (India only), optional bbox + `listingType` |
| `GET` | `/api/states` | States available for filtering |
| `POST` | `/api/auth/register` | Create a customer or dealer account |
| `POST` | `/api/auth/login` | Log in and receive a session token |
| `GET` | `/api/auth/me` | Read the current account |
| `POST` | `/api/auth/logout` | End the current session |
| `POST` | `/api/properties` | Create a listing as an authenticated dealer |
| `GET` | `/api/dealer/properties` | List the authenticated dealer's listings |
| `PUT` | `/api/properties/:id` | Update an owned listing |
| `DELETE` | `/api/properties/:id` | Delete an owned listing |
| `GET` | `/api/health` | Health check |

```
GET /api/properties?north=19.28&south=18.89&east=73.05&west=72.77&listingType=rent
```

## Setup

```bash
npm run install:all
```

## Run (development)

```bash
npm run dev:server   # API on :3001
npm run dev:client   # App on http://127.0.0.1:5173
```

Log in as a customer, search by state, choose sale/rent, then click a listing to focus the Google Maps iframe on that home.

## Accounts and SQLite

The server creates `server/data/gharmap.sqlite` automatically. Properties are read only from the `properties` table; there is no static property seed. Passwords are stored as salted `scrypt` hashes, never as plaintext. Customer and dealer accounts are stored in separate `customers` and `dealers` tables, with role-aware sessions in `auth_sessions`. Register from the login screen, choose `Customer` or `Dealer`, and use the matching role when logging in. Dealers must provide title, price, listing type, bedrooms, address, state, image URL, contact number, latitude, and longitude for each listing.

## Security notes

API queries use bound SQLite parameters, role and ownership checks, bounded JSON bodies, HTTPS-only listing images, validated numeric property fields, security response headers, and seven-day expiring sessions. React escapes rendered listing text and the codebase does not use shell execution or raw HTML injection. Deploy behind HTTPS and keep the SQLite file outside any static/public directory.

## Test report

Run the server persistence and security regression suite with:

```bash
cd server
npm test
```

The test file `server/test/database.test.js` covers customer/dealer authentication and sessions, dealer-owned property create/read/update/delete operations, cross-dealer access isolation, contact-number persistence, state filtering, map-coordinate bounding boxes, deleted-record visibility, HTTPS image validation, and title-length validation. Tests use unique records in the existing SQLite database and clean them up when finished.
