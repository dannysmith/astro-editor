export default {
  async fetch(request, env) {
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      })
    }

    const url = new URL(request.url)

    // Handle /event endpoint
    if (url.pathname === '/event') {
      return handleEvent(request, env, corsHeaders)
    }

    // 404 for unknown endpoints
    return new Response('Not found', {
      status: 404,
      headers: corsHeaders,
    })
  },
}

async function handleEvent(request, env, corsHeaders) {
  try {
    // Parse and validate payload
    const payload = await request.json()
    const { appId, uuid, version, event, platform, timestamp } = payload

    // Validate required fields
    if (!appId || !uuid || !version || !event || !platform || !timestamp) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['appId', 'uuid', 'version', 'event', 'platform', 'timestamp'],
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Basic validation
    if (typeof appId !== 'string' || appId.length > 100) {
      return new Response('Invalid appId', { status: 400, headers: corsHeaders })
    }
    if (typeof uuid !== 'string' || uuid.length > 100) {
      return new Response('Invalid uuid', { status: 400, headers: corsHeaders })
    }
    if (typeof version !== 'string' || version.length > 50) {
      return new Response('Invalid version', { status: 400, headers: corsHeaders })
    }
    if (typeof event !== 'string' || event.length > 50) {
      return new Response('Invalid event', { status: 400, headers: corsHeaders })
    }
    if (typeof platform !== 'string' || platform.length > 50) {
      return new Response('Invalid platform', { status: 400, headers: corsHeaders })
    }
    if (typeof timestamp !== 'string' || !isValidISO8601(timestamp)) {
      return new Response('Invalid timestamp', { status: 400, headers: corsHeaders })
    }

    // Insert into D1
    await env.DB.prepare(
      `INSERT INTO telemetry_events (app_id, uuid, version, event, platform, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(appId, uuid, version, event, platform, timestamp)
      .run()

    return new Response('OK', {
      status: 200,
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('Error processing telemetry event:', error)
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders,
    })
  }
}

function isValidISO8601(timestamp) {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
  return iso8601Regex.test(timestamp)
}
