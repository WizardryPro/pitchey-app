/**
 * API Documentation Routes
 * Provides OpenAPI/Swagger documentation and testing interface
 */

import { RouteHandler } from "../router/types.ts";
import { successResponse, errorResponse } from "../utils/response.ts";

// OpenAPI 3.0 specification for the Pitchey API
const apiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Pitchey API",
    version: "3.4.0",
    description: "Comprehensive movie pitch platform API with modular architecture",
    contact: {
      name: "Pitchey Platform",
      url: "https://pitchey-5o8.pages.dev"
    }
  },
  servers: [
    {
      url: "https://pitchey-backend-fresh.deno.dev",
      description: "Production server"
    },
    {
      url: "http://localhost:8001",
      description: "Development server"
    }
  ],
  tags: [
    { name: "Authentication", description: "User authentication and authorization" },
    { name: "System", description: "System health and configuration" },
    { name: "Pitches", description: "Movie pitch management" },
    { name: "Search", description: "Advanced search and filtering" },
    { name: "Users", description: "User profile and management" },
    { name: "Analytics", description: "Platform and user analytics" },
    { name: "NDAs", description: "Non-disclosure agreement management" },
    { name: "Payments", description: "Investment and payment processing" },
    { name: "Creator", description: "Creator dashboard and tools" },
    { name: "Investor", description: "Investor dashboard and portfolio" },
    { name: "Production", description: "Production company management" },
    { name: "Messaging", description: "Communications and notifications" },
    { name: "WebSocket", description: "Real-time communication" },
    { name: "Monitoring", description: "System monitoring and health checks" }
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health check endpoint",
        description: "Check the health status of all system components",
        responses: {
          "200": {
            description: "System is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    overall: { type: "string", enum: ["operational", "degraded", "outage"] },
                    services: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          service: { type: "string" },
                          status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
                          responseTime: { type: "number" },
                          message: { type: "string" }
                        }
                      }
                    },
                    lastChecked: { type: "string", format: "date-time" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "User login",
        description: "Authenticate user and return JWT token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        token: { type: "string" },
                        user: {
                          type: "object",
                          properties: {
                            id: { type: "integer" },
                            email: { type: "string" },
                            firstName: { type: "string" },
                            lastName: { type: "string" },
                            userType: { type: "string", enum: ["creator", "investor", "production_company"] }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            description: "Invalid credentials"
          }
        }
      }
    },
    "/api/pitches/search": {
      get: {
        tags: ["Pitches", "Search"],
        summary: "Search pitches",
        description: "Search for pitches with various filters",
        parameters: [
          {
            name: "q",
            in: "query",
            description: "Search query",
            schema: { type: "string" }
          },
          {
            name: "genre",
            in: "query",
            description: "Filter by genre",
            schema: { type: "string" }
          },
          {
            name: "format",
            in: "query",
            description: "Filter by format",
            schema: { type: "string" }
          },
          {
            name: "limit",
            in: "query",
            description: "Number of results to return",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: "offset",
            in: "query",
            description: "Number of results to skip",
            schema: { type: "integer", minimum: 0, default: 0 }
          }
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    data: {
                      type: "object",
                      properties: {
                        pitches: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/Pitch"
                          }
                        },
                        pagination: {
                          $ref: "#/components/schemas/Pagination"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      Pitch: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          logline: { type: "string" },
          genre: { type: "string" },
          format: { type: "string" },
          budgetRange: { type: "string" },
          stage: { type: "string" },
          viewCount: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          creator_name: { type: "string" },
          company_name: { type: "string" }
        }
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer" },
          email: { type: "string", format: "email" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          userType: { type: "string", enum: ["creator", "investor", "production_company"] },
          companyName: { type: "string" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
          hasMore: { type: "boolean" }
        }
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          errorId: { type: "string" }
        }
      }
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
};

// Get OpenAPI specification
export const getApiSpec: RouteHandler = async (request, url) => {
  try {
    return successResponse(apiSpec);
  } catch (error) {
    return errorResponse("Failed to generate API specification", 500);
  }
};

// Swagger UI HTML
const swaggerUIHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Pitchey API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api/docs/spec',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
`;

// Swagger UI endpoint
export const getSwaggerUI: RouteHandler = async (request, url) => {
  return new Response(swaggerUIHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
};

// API routes overview
export const getRoutesOverview: RouteHandler = async (request, url) => {
  try {
    const routes = {
      authentication: {
        "POST /api/auth/login": "User authentication",
        "POST /api/auth/register": "User registration", 
        "GET /api/validate-token": "Token validation",
        "GET /api/auth/profile": "Get user profile"
      },
      pitches: {
        "GET /api/pitches/public": "Get public pitches",
        "GET /api/pitches/search": "Search pitches",
        "GET /api/pitches/trending": "Get trending pitches",
        "GET /api/pitches/featured": "Get featured pitches",
        "GET /api/pitches/:id": "Get pitch by ID"
      },
      search: {
        "GET /api/search/advanced": "Advanced search with filters",
        "GET /api/search/suggestions": "Get search suggestions",
        "GET /api/search/trending": "Get trending searches",
        "GET /api/search/facets": "Faceted search",
        "GET /api/pitches/:id/similar": "Find similar pitches"
      },
      creator: {
        "GET /api/creator/dashboard": "Creator dashboard overview",
        "GET /api/creator/pitches": "Get creator's pitches",
        "POST /api/creator/pitches": "Create new pitch",
        "PUT /api/creator/pitches/:id": "Update pitch",
        "DELETE /api/creator/pitches/:id": "Delete pitch"
      },
      investor: {
        "GET /api/investor/dashboard": "Investor dashboard overview",
        "GET /api/investor/portfolio": "Investment portfolio",
        "GET /api/investor/saved-pitches": "Saved pitches",
        "POST /api/investor/save-pitch": "Save a pitch"
      },
      monitoring: {
        "GET /api/health": "Health check",
        "GET /api/monitoring/metrics": "System metrics",
        "GET /api/monitoring/dashboard": "Monitoring dashboard",
        "POST /api/monitoring/optimize-db": "Database optimization"
      },
      websocket: {
        "GET /ws": "WebSocket connection",
        "GET /api/websocket/stats": "WebSocket statistics",
        "POST /api/websocket/broadcast": "Admin broadcast",
        "GET /api/websocket/users/status": "User online status"
      }
    };

    return successResponse({
      message: "Pitchey API Routes Overview",
      version: "3.4.0",
      totalRoutes: Object.values(routes).reduce((acc, group) => acc + Object.keys(group).length, 0),
      routes,
      documentation: {
        openapi_spec: "/api/docs/spec",
        swagger_ui: "/api/docs",
        routes_overview: "/api/docs/routes"
      }
    });

  } catch (error) {
    return errorResponse("Failed to generate routes overview", 500);
  }
};

// API testing playground
export const getTestingPlayground: RouteHandler = async (request, url) => {
  const playgroundHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Pitchey API Testing Playground</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .test-button { background: #007cba; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; }
    .test-button:hover { background: #005a87; }
    .result { background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; }
    .success { border-left: 4px solid #28a745; }
    .error { border-left: 4px solid #dc3545; }
    input, textarea { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Pitchey API Testing Playground</h1>
    
    <div class="test-section">
      <h3>Health Check Test</h3>
      <button class="test-button" onclick="testHealth()">Test Health Endpoint</button>
      <div id="health-result" class="result"></div>
    </div>

    <div class="test-section">
      <h3>Authentication Test</h3>
      <input type="email" id="auth-email" placeholder="Email" value="alex.creator@demo.com">
      <input type="password" id="auth-password" placeholder="Password" value="Demo123">
      <button class="test-button" onclick="testAuth()">Test Login</button>
      <div id="auth-result" class="result"></div>
    </div>

    <div class="test-section">
      <h3>Search Test</h3>
      <input type="text" id="search-query" placeholder="Search query" value="sci-fi">
      <button class="test-button" onclick="testSearch()">Test Search</button>
      <div id="search-result" class="result"></div>
    </div>

    <div class="test-section">
      <h3>Monitoring Test</h3>
      <button class="test-button" onclick="testMetrics()">Test Metrics</button>
      <div id="metrics-result" class="result"></div>
    </div>
  </div>

  <script>
    async function makeRequest(url, options = {}) {
      try {
        const response = await fetch(url, options);
        const data = await response.json();
        return { status: response.status, data };
      } catch (error) {
        return { error: error.message };
      }
    }

    async function testHealth() {
      const result = await makeRequest('/api/health');
      document.getElementById('health-result').innerHTML = 
        '<strong>Status:</strong> ' + (result.status || 'Error') + 
        '<br><strong>Response:</strong><pre>' + JSON.stringify(result.data || result.error, null, 2) + '</pre>';
      document.getElementById('health-result').className = 'result ' + (result.status === 200 ? 'success' : 'error');
    }

    async function testAuth() {
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      
      const result = await makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      document.getElementById('auth-result').innerHTML = 
        '<strong>Status:</strong> ' + (result.status || 'Error') + 
        '<br><strong>Response:</strong><pre>' + JSON.stringify(result.data || result.error, null, 2) + '</pre>';
      document.getElementById('auth-result').className = 'result ' + (result.status === 200 ? 'success' : 'error');
    }

    async function testSearch() {
      const query = document.getElementById('search-query').value;
      const result = await makeRequest('/api/pitches/search?q=' + encodeURIComponent(query));
      
      document.getElementById('search-result').innerHTML = 
        '<strong>Status:</strong> ' + (result.status || 'Error') + 
        '<br><strong>Results:</strong> ' + (result.data?.pitches?.length || 0) + ' pitches found' +
        '<br><strong>Response:</strong><pre>' + JSON.stringify(result.data || result.error, null, 2) + '</pre>';
      document.getElementById('search-result').className = 'result ' + (result.status === 200 ? 'success' : 'error');
    }

    async function testMetrics() {
      const result = await makeRequest('/api/monitoring/metrics');
      
      document.getElementById('metrics-result').innerHTML = 
        '<strong>Status:</strong> ' + (result.status || 'Error') + 
        '<br><strong>Uptime:</strong> ' + (result.data?.metrics?.uptime || 'N/A') + ' seconds' +
        '<br><strong>Response:</strong><pre>' + JSON.stringify(result.data || result.error, null, 2) + '</pre>';
      document.getElementById('metrics-result').className = 'result ' + (result.status === 200 ? 'success' : 'error');
    }
  </script>
</body>
</html>
  `;

  return new Response(playgroundHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    }
  });
};