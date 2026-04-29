/**
 * Crawl4AI Integration Worker
 * Provides API endpoints for pitch validation, enrichment, and market intelligence
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';

export interface Env {
  // KV namespaces for caching
  CRAWL_CACHE: KVNamespace;
  SCHEMA_CACHE: KVNamespace;
  
  // Environment variables
  PYTHON_WORKER_URL: string;
  OPENAI_API_KEY: string;
  CACHE_TTL: string;
  
  // R2 bucket for storing reports
  REPORTS_BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('*', cors({
  origin: ['https://pitchey-5o8.pages.dev', 'https://pitchey-*.pages.dev', 'http://localhost:5173'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Cache configuration
const CACHE_DURATIONS = {
  NEWS: 5 * 60, // 5 minutes for news
  VALIDATION: 24 * 60 * 60, // 24 hours for validation results
  ENRICHMENT: 7 * 24 * 60 * 60, // 7 days for enrichment data
  SCHEMA: 30 * 24 * 60 * 60, // 30 days for schemas
};

/**
 * Helper to get cached data or fetch from Python worker
 */
async function getCachedOrFetch(
  cache: KVNamespace,
  key: string,
  fetchFn: () => Promise<any>,
  ttl: number
): Promise<any> {
  // Try cache first
  const cached = await cache.get(key, 'json');
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();
  
  // Cache for future use
  await cache.put(key, JSON.stringify(data), {
    expirationTtl: ttl,
  });

  return data;
}

/**
 * Industry News Feed Endpoint
 * Aggregates news from multiple entertainment sources
 */
app.get('/api/crawl/news/industry', async (c) => {
  const env = c.env;
  const cacheKey = 'news:industry:latest';

  try {
    const data = await getCachedOrFetch(
      env.CRAWL_CACHE,
      cacheKey,
      async () => {
        // Call Python worker to scrape news
        const response = await fetch(`${env.PYTHON_WORKER_URL}/scrape/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources: ['variety', 'hollywood_reporter', 'deadline'],
            limit: 10,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }

        return response.json();
      },
      CACHE_DURATIONS.NEWS
    );

    return c.json({ success: true, data });
  } catch (error) {
    console.error('News fetch error:', error);
    return c.json({ success: false, error: 'Failed to fetch news' }, 500);
  }
});

/**
 * Pitch Validation Endpoint
 * Validates uniqueness and market viability
 */
app.post('/api/crawl/validate/pitch', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  const { title, genre, logline, format } = body;

  if (!title || !genre) {
    return c.json({ success: false, error: 'Title and genre are required' }, 400);
  }

  const cacheKey = `validation:${title}:${genre}:${format || 'feature'}`;

  try {
    const data = await getCachedOrFetch(
      env.CRAWL_CACHE,
      cacheKey,
      async () => {
        // Call Python worker for validation
        const response = await fetch(`${env.PYTHON_WORKER_URL}/validate/pitch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, genre, logline, format }),
        });

        if (!response.ok) {
          throw new Error('Validation failed');
        }

        return response.json();
      },
      CACHE_DURATIONS.VALIDATION
    );

    return c.json({ success: true, data });
  } catch (error) {
    console.error('Validation error:', error);
    return c.json({ success: false, error: 'Failed to validate pitch' }, 500);
  }
});

/**
 * Pitch Enrichment Endpoint
 * Enriches pitch with market data and comparables
 */
app.post('/api/crawl/enrich/pitch', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  const { pitchId, title, genre, budget, targetAudience } = body;

  if (!pitchId || !title) {
    return c.json({ success: false, error: 'Pitch ID and title are required' }, 400);
  }

  const cacheKey = `enrichment:${pitchId}`;

  try {
    const data = await getCachedOrFetch(
      env.CRAWL_CACHE,
      cacheKey,
      async () => {
        // Call Python worker for enrichment
        const response = await fetch(`${env.PYTHON_WORKER_URL}/enrich/pitch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pitch_id: pitchId,
            title,
            genre,
            budget,
            target_audience: targetAudience,
          }),
        });

        if (!response.ok) {
          throw new Error('Enrichment failed');
        }

        const enrichedData = await response.json();

        // Store full report in R2
        const reportKey = `reports/enrichment/${pitchId}.json`;
        await env.REPORTS_BUCKET.put(reportKey, JSON.stringify(enrichedData));

        return enrichedData;
      },
      CACHE_DURATIONS.ENRICHMENT
    );

    return c.json({ success: true, data });
  } catch (error) {
    console.error('Enrichment error:', error);
    return c.json({ success: false, error: 'Failed to enrich pitch' }, 500);
  }
});

/**
 * Market Trends Endpoint
 * Gets current market trends for a genre
 */
app.get('/api/crawl/trends/:genre', async (c) => {
  const env = c.env;
  const genre = c.req.param('genre');
  const cacheKey = `trends:${genre}:${new Date().toISOString().split('T')[0]}`;

  try {
    const data = await getCachedOrFetch(
      env.CRAWL_CACHE,
      cacheKey,
      async () => {
        // Call Python worker for trends
        const response = await fetch(`${env.PYTHON_WORKER_URL}/trends/${genre}`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch trends');
        }

        return response.json();
      },
      CACHE_DURATIONS.NEWS
    );

    return c.json({ success: true, data });
  } catch (error) {
    console.error('Trends error:', error);
    return c.json({ success: false, error: 'Failed to fetch trends' }, 500);
  }
});

/**
 * Box Office Data Endpoint
 * Gets current box office performance
 */
app.get('/api/crawl/boxoffice/:timeframe', async (c) => {
  const env = c.env;
  const timeframe = c.req.param('timeframe') || 'weekend';
  const cacheKey = `boxoffice:${timeframe}:${new Date().toISOString().split('T')[0]}`;

  try {
    const data = await getCachedOrFetch(
      env.CRAWL_CACHE,
      cacheKey,
      async () => {
        // Call Python worker for box office data
        const response = await fetch(`${env.PYTHON_WORKER_URL}/boxoffice/${timeframe}`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch box office data');
        }

        return response.json();
      },
      CACHE_DURATIONS.NEWS
    );

    return c.json({ success: true, data });
  } catch (error) {
    console.error('Box office error:', error);
    return c.json({ success: false, error: 'Failed to fetch box office data' }, 500);
  }
});

/**
 * Competitor Analysis Endpoint
 * Analyzes competing projects
 */
app.post('/api/crawl/analyze/competitors', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  const { title, genre, keywords } = body;

  if (!title) {
    return c.json({ success: false, error: 'Title is required' }, 400);
  }

  const cacheKey = `competitors:${title}:${genre || 'all'}`;

  try {
    const data = await getCachedOrFetch(
      env.CRAWL_CACHE,
      cacheKey,
      async () => {
        // Call Python worker for competitor analysis
        const response = await fetch(`${env.PYTHON_WORKER_URL}/analyze/competitors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, genre, keywords }),
        });

        if (!response.ok) {
          throw new Error('Competitor analysis failed');
        }

        return response.json();
      },
      CACHE_DURATIONS.VALIDATION
    );

    return c.json({ success: true, data });
  } catch (error) {
    console.error('Competitor analysis error:', error);
    return c.json({ success: false, error: 'Failed to analyze competitors' }, 500);
  }
});

/**
 * Production Company Research Endpoint
 * Gets information about production companies
 */
app.get('/api/crawl/company/:name', async (c) => {
  const env = c.env;
  const name = c.req.param('name');
  const cacheKey = `company:${name.toLowerCase().replace(/\s+/g, '-')}`;

  try {
    const data = await getCachedOrFetch(
      env.CRAWL_CACHE,
      cacheKey,
      async () => {
        // Call Python worker for company data
        const response = await fetch(`${env.PYTHON_WORKER_URL}/company/${encodeURIComponent(name)}`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch company data');
        }

        return response.json();
      },
      CACHE_DURATIONS.ENRICHMENT
    );

    return c.json({ success: true, data });
  } catch (error) {
    console.error('Company research error:', error);
    return c.json({ success: false, error: 'Failed to fetch company data' }, 500);
  }
});

/**
 * Schema Management Endpoints
 */
app.get('/api/crawl/schemas', async (c) => {
  const env = c.env;
  
  try {
    // Get list of available schemas from cache
    const schemas = await env.SCHEMA_CACHE.list();
    
    const schemaList = await Promise.all(
      schemas.keys.map(async (key) => {
        const schema = await env.SCHEMA_CACHE.get(key.name, 'json');
        return {
          name: key.name.replace('schema:', ''),
          fields: schema?.fields?.length || 0,
          lastModified: key.metadata?.lastModified || null,
        };
      })
    );

    return c.json({ success: true, schemas: schemaList });
  } catch (error) {
    console.error('Schema list error:', error);
    return c.json({ success: false, error: 'Failed to list schemas' }, 500);
  }
});

app.post('/api/crawl/schemas/generate', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  const { url, goal, name } = body;

  if (!url || !goal || !name) {
    return c.json({ success: false, error: 'URL, goal, and name are required' }, 400);
  }

  try {
    // Call Python worker to generate schema
    const response = await fetch(`${env.PYTHON_WORKER_URL}/schemas/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, goal, name }),
    });

    if (!response.ok) {
      throw new Error('Schema generation failed');
    }

    const schema = await response.json();

    // Cache the generated schema
    await env.SCHEMA_CACHE.put(
      `schema:${name}`,
      JSON.stringify(schema),
      { expirationTtl: CACHE_DURATIONS.SCHEMA }
    );

    return c.json({ success: true, schema });
  } catch (error) {
    console.error('Schema generation error:', error);
    return c.json({ success: false, error: 'Failed to generate schema' }, 500);
  }
});

/**
 * Cache Management Endpoints
 */
app.delete('/api/crawl/cache/:type/:key?', async (c) => {
  const env = c.env;
  const type = c.req.param('type');
  const key = c.req.param('key');

  try {
    if (key) {
      // Clear specific cache entry
      await env.CRAWL_CACHE.delete(`${type}:${key}`);
      return c.json({ success: true, message: `Cache entry ${type}:${key} cleared` });
    } else {
      // Clear all entries of this type
      const list = await env.CRAWL_CACHE.list({ prefix: `${type}:` });
      await Promise.all(list.keys.map(k => env.CRAWL_CACHE.delete(k.name)));
      return c.json({ success: true, message: `All ${type} cache entries cleared` });
    }
  } catch (error) {
    console.error('Cache clear error:', error);
    return c.json({ success: false, error: 'Failed to clear cache' }, 500);
  }
});

/**
 * Health Check Endpoint
 */
app.get('/api/crawl/health', async (c) => {
  const env = c.env;
  
  try {
    // Check Python worker health
    const pythonHealth = await fetch(`${env.PYTHON_WORKER_URL}/health`)
      .then(r => r.ok)
      .catch(() => false);

    // Check KV namespace access
    const kvHealth = await env.CRAWL_CACHE.get('health:check')
      .then(() => true)
      .catch(() => false);

    // Check R2 bucket access
    const r2Health = await env.REPORTS_BUCKET.head('health.txt')
      .then(() => true)
      .catch(() => false);

    return c.json({
      success: true,
      status: {
        worker: 'healthy',
        python_worker: pythonHealth ? 'healthy' : 'unhealthy',
        kv_cache: kvHealth ? 'healthy' : 'unhealthy',
        r2_bucket: r2Health ? 'healthy' : 'unhealthy',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({ success: false, error: 'Health check failed' }, 500);
  }
});

export default app;