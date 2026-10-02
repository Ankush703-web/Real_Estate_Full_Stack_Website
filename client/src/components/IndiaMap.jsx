const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };

export const INDIA_AREAS = [
  {
    id: "india",
    label: "All India",
    query: "India",
    center: INDIA_CENTER,
    zoom: 5,
    bounds: { north: 35.5, south: 6.5, east: 97.4, west: 68.1 },
  },
  {
    id: "mumbai",
    label: "Mumbai",
    query: "Mumbai, Maharashtra, India",
    center: { lat: 19.076, lng: 72.8777 },
    zoom: 11,
    bounds: { north: 19.28, south: 18.89, east: 73.05, west: 72.77 },
  },
  {
    id: "delhi",
    label: "Delhi NCR",
    query: "New Delhi, India",
    center: { lat: 28.6139, lng: 77.209 },
    zoom: 11,
    bounds: { north: 28.8, south: 28.4, east: 77.4, west: 76.95 },
  },
  {
    id: "bengaluru",
    label: "Bengaluru",
    query: "Bengaluru, Karnataka, India",
    center: { lat: 12.9716, lng: 77.5946 },
    zoom: 11,
    bounds: { north: 13.15, south: 12.8, east: 77.8, west: 77.45 },
  },
  {
    id: "hyderabad",
    label: "Hyderabad",
    query: "Hyderabad, Telangana, India",
    center: { lat: 17.385, lng: 78.4867 },
    zoom: 11,
    bounds: { north: 17.55, south: 17.25, east: 78.6, west: 78.25 },
  },
  {
    id: "pune",
    label: "Pune",
    query: "Pune, Maharashtra, India",
    center: { lat: 18.5204, lng: 73.8567 },
    zoom: 11,
    bounds: { north: 18.65, south: 18.4, east: 74.0, west: 73.7 },
  },
  {
    id: "chennai",
    label: "Chennai",
    query: "Chennai, Tamil Nadu, India",
    center: { lat: 13.0827, lng: 80.2707 },
    zoom: 11,
    bounds: { north: 13.2, south: 12.9, east: 80.35, west: 80.15 },
  },
  {
    id: "kolkata",
    label: "Kolkata",
    query: "Kolkata, West Bengal, India",
    center: { lat: 22.5726, lng: 88.3639 },
    zoom: 11,
    bounds: { north: 22.7, south: 22.45, east: 88.5, west: 88.25 },
  },
];

function sanitizeKey(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

/**
 * Build an Embed iframe URL using only Maps Embed API (demo-key friendly).
 * Uses place mode — more reliable on restricted demo keys than view mode.
 */
function buildEmbedSrc(apiKey, { q, zoom }) {
  const params = new URLSearchParams({
    key: apiKey,
    q,
    zoom: String(zoom),
  });
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

/**
 * Keyless fallback embed (works for local demos if Embed API rejects the key).
 */
function buildDemoFallbackSrc({ q, zoom }) {
  const params = new URLSearchParams({
    q,
    z: String(zoom),
    hl: "en",
    output: "embed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

/**
 * Google Maps Embed iframe for India areas / selected listing coordinates.
 * Demo keys: Maps Embed API only — no Maps JavaScript API.
 */
export default function IndiaMap({ apiKey, area, selectedProperty, useKeylessFallback = false }) {
  const key = sanitizeKey(apiKey);

  let q;
  let zoom;

  if (selectedProperty) {
    const { latitude, longitude } = selectedProperty.coordinates;
    q = `${latitude},${longitude}`;
    zoom = 15;
  } else {
    q = area.query;
    zoom = area.zoom;
  }

  if (!key && !useKeylessFallback) {
    return (
      <div className="map-fallback">
        <p>
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>client/.env</code>{" "}
          (Maps Embed API demo key), then restart Vite.
        </p>
      </div>
    );
  }

  const embedSrc =
    key && !useKeylessFallback
      ? buildEmbedSrc(key, { q, zoom })
      : buildDemoFallbackSrc({ q, zoom });

  return (
    <iframe
      title="India property map"
      className="map-iframe"
      src={embedSrc}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
