// Proxies Google Places Nearby Search so the API key is never exposed to the browser.
// Called by PersonalShopper.jsx when the user opens shopping mode.
//
// Request body: { lat: number, lng: number }
// Response:     { stores: [{ name, vicinity, place_id }], atGroceryStore: boolean }

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  let lat, lng;
  try {
    const body = JSON.parse(event.body || '{}');
    lat = body.lat;
    lng = body.lng;
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (lat == null || lng == null) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'lat and lng are required' }) };
  }

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) {
    // Key not configured yet — return empty result so app still works
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ stores: [], atGroceryStore: false, configured: false }),
    };
  }

  // Search for grocery stores within 150m of the user
  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', '150');
  url.searchParams.set('type', 'grocery_or_supermarket');
  url.searchParams.set('key', key);

  let data;
  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Places API returned ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error('Places API error:', err.message);
    return {
      statusCode: 502,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Places API request failed', stores: [], atGroceryStore: false }),
    };
  }

  const stores = (data.results ?? []).slice(0, 3).map((p) => ({
    name: p.name,
    vicinity: p.vicinity,
    place_id: p.place_id,
  }));

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      stores,
      atGroceryStore: stores.length > 0,
      configured: true,
    }),
  };
};
