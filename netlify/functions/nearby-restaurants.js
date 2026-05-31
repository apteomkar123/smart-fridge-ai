// Proxies Google Places Nearby Search filtered to restaurants.
// Request body: { lat, lng, radius? (default 1500m) }
// Response: { restaurants: [...], configured: bool }

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  let lat, lng, radius;
  try {
    const body = JSON.parse(event.body || '{}');
    lat = body.lat;
    lng = body.lng;
    radius = body.radius || 1500;
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid body' }) };
  }

  if (lat == null || lng == null) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'lat and lng required' }) };
  }

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) {
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ restaurants: [], configured: false }) };
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('type', 'restaurant');
  url.searchParams.set('key', key);

  let data;
  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Places API ${res.status}`);
    data = await res.json();
  } catch (err) {
    return { statusCode: 502, headers: HEADERS, body: JSON.stringify({ error: err.message, restaurants: [], configured: true }) };
  }

  const restaurants = (data.results ?? []).slice(0, 20).map(p => ({
    name: p.name,
    vicinity: p.vicinity,
    place_id: p.place_id,
    rating: p.rating || null,
    price_level: p.price_level ?? null, // 0-4; 0-1 = cheap, 2 = mid, 3-4 = upscale
    types: p.types || [],
    open_now: p.opening_hours?.open_now ?? null,
    photo_ref: p.photos?.[0]?.photo_reference ?? null,
  }));

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ restaurants, configured: true }),
  };
};
