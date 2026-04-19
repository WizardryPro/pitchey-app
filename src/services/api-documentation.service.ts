/**
 * Advanced API Documentation Automation Service
 * Provides comprehensive API documentation generation, validation, and maintenance
 */

import { telemetry } from "../utils/telemetry.ts";

export interface ApiEndpoint {
  id: string;
  path: string;
  method: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  security?: ApiSecurity[];
  deprecated: boolean;
  version: string;
  examples: ApiExample[];
  lastModified: number;
  usage: {
    calls: number;
    errors: number;
    avgResponseTime: number;
    popularity: number;
  };
}

export interface ApiParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  description: string;
  required: boolean;
  schema: any;
  example?: any;
  deprecated?: boolean;
}

export interface ApiRequestBody {
  description: string;
  content: Record<string, {
    schema: any;
    example?: any;
    examples?: Record<string, any>;
  }>;
  required: boolean;
}

export interface ApiResponse {
  description: string;
  headers?: Record<string, any>;
  content?: Record<string, {
    schema: any;
    example?: any;
    examples?: Record<string, any>;
  }>;
}

export interface ApiSecurity {
  type: "bearer" | "basic" | "apiKey" | "oauth2";
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
}

export interface ApiExample {
  name: string;
  description: string;
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body: any;
  };
  curlCommand: string;
}

export interface ApiDocumentation {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      email: string;
      url: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
    parameters: Record<string, any>;
    responses: Record<string, any>;
    examples: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

export interface ApiMetrics {
  totalEndpoints: number;
  documentedEndpoints: number;
  deprecatedEndpoints: number;
  versionedEndpoints: Record<string, number>;
  coveragePercentage: number;
  lastUpdated: number;
  popularEndpoints: ApiEndpoint[];
  recentChanges: Array<{
    endpoint: string;
    change: string;
    timestamp: number;
  }>;
}

export class ApiDocumentationService {
  private static instance: ApiDocumentationService;
  private endpoints: Map<string, ApiEndpoint> = new Map();
  private schemas: Map<string, any> = new Map();
  private changeHistory: Array<{
    id: string;
    endpoint: string;
    change: string;
    timestamp: number;
    version: string;
  }> = [];
  
  private isInitialized = false;
  private settings = {
    autoGenerate: true,
    autoValidate: true,
    trackUsage: true,
    generateExamples: true,
    enableVersioning: true,
    outputFormats: ["openapi", "postman", "insomnia", "markdown"],
    maxChangeHistory: 1000,
    updateInterval: 60000 // 1 minute
  };

  private generationRules = {
    includeUsageStats: true,
    includePerformanceMetrics: true,
    includeErrorExamples: true,
    includeDeprecationWarnings: true,
    includeSecurityDetails: true,
    generateCurlExamples: true,
    validateSchemas: true,
    autoDetectChanges: true
  };

  public static getInstance(): ApiDocumentationService {
    if (!ApiDocumentationService.instance) {
      ApiDocumentationService.instance = new ApiDocumentationService();
    }
    return ApiDocumentationService.instance;
  }

  public initialize(config?: Partial<typeof this.settings>): void {
    if (this.isInitialized) return;

    this.settings = { ...this.settings, ...config };
    this.setupAutoGeneration();
    this.isInitialized = true;

    telemetry.logger.info("API documentation service initialized", this.settings);
  }

  // Endpoint management
  public registerEndpoint(endpoint: Omit<ApiEndpoint, 'id' | 'lastModified' | 'usage'>): string {
    const id = this.generateEndpointId(endpoint.method, endpoint.path);
    const existingEndpoint = this.endpoints.get(id);

    const newEndpoint: ApiEndpoint = {
      ...endpoint,
      id,
      lastModified: Date.now(),
      usage: existingEndpoint?.usage || {
        calls: 0,
        errors: 0,
        avgResponseTime: 0,
        popularity: 0
      }
    };

    this.endpoints.set(id, newEndpoint);
    
    if (existingEndpoint) {
      this.trackChange(id, "updated", "Endpoint definition updated");
    } else {
      this.trackChange(id, "created", "New endpoint registered");
    }

    return id;
  }

  public updateEndpoint(id: string, updates: Partial<ApiEndpoint>): boolean {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return false;

    const updatedEndpoint = {
      ...endpoint,
      ...updates,
      id,
      lastModified: Date.now()
    };

    this.endpoints.set(id, updatedEndpoint);
    this.trackChange(id, "updated", "Endpoint updated");
    return true;
  }

  public removeEndpoint(id: string): boolean {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return false;

    this.endpoints.delete(id);
    this.trackChange(id, "removed", "Endpoint removed");
    return true;
  }

  public getEndpoint(id: string): ApiEndpoint | null {
    return this.endpoints.get(id) || null;
  }

  public getEndpoints(filters: {
    tag?: string;
    version?: string;
    deprecated?: boolean;
    path?: string;
    method?: string;
  } = {}): ApiEndpoint[] {
    let endpoints = Array.from(this.endpoints.values());

    if (filters.tag) {
      endpoints = endpoints.filter(e => e.tags.includes(filters.tag!));
    }
    if (filters.version) {
      endpoints = endpoints.filter(e => e.version === filters.version);
    }
    if (filters.deprecated !== undefined) {
      endpoints = endpoints.filter(e => e.deprecated === filters.deprecated);
    }
    if (filters.path) {
      endpoints = endpoints.filter(e => e.path.includes(filters.path!));
    }
    if (filters.method) {
      endpoints = endpoints.filter(e => e.method.toUpperCase() === filters.method!.toUpperCase());
    }

    return endpoints.sort((a, b) => a.path.localeCompare(b.path));
  }

  // Usage tracking
  public trackEndpointUsage(method: string, path: string, responseTime: number, statusCode: number): void {
    if (!this.settings.trackUsage) return;

    const id = this.generateEndpointId(method, path);
    const endpoint = this.endpoints.get(id);
    
    if (endpoint) {
      endpoint.usage.calls++;
      if (statusCode >= 400) endpoint.usage.errors++;
      
      // Update average response time
      endpoint.usage.avgResponseTime = 
        (endpoint.usage.avgResponseTime * (endpoint.usage.calls - 1) + responseTime) / endpoint.usage.calls;
      
      // Calculate popularity (calls per day)
      const daysSinceCreated = (Date.now() - endpoint.lastModified) / (24 * 60 * 60 * 1000);
      endpoint.usage.popularity = endpoint.usage.calls / Math.max(daysSinceCreated, 1);
      
      endpoint.lastModified = Date.now();
    }
  }

  // Documentation generation
  public generateOpenApiSpec(): ApiDocumentation {
    const endpoints = Array.from(this.endpoints.values());
    const paths: Record<string, Record<string, any>> = {};
    const tags = new Set<string>();

    // Build paths and collect tags
    for (const endpoint of endpoints) {
      const path = endpoint.path;
      const method = endpoint.method.toLowerCase();

      if (!paths[path]) paths[path] = {};

      paths[path][method] = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters: endpoint.parameters.map(this.convertParameterToOpenApi),
        responses: this.convertResponsesToOpenApi(endpoint.responses),
        operationId: endpoint.id,
        deprecated: endpoint.deprecated || undefined
      };

      if (endpoint.requestBody) {
        paths[path][method].requestBody = this.convertRequestBodyToOpenApi(endpoint.requestBody);
      }

      if (endpoint.security) {
        paths[path][method].security = endpoint.security;
      }

      // Add usage information as extension
      if (this.generationRules.includeUsageStats) {
        paths[path][method]['x-usage-stats'] = endpoint.usage;
      }

      endpoint.tags.forEach(tag => tags.add(tag));
    }

    return {
      openapi: "3.0.3",
      info: {
        title: "Pitchey API",
        version: "v1.0.0",
        description: "Comprehensive movie pitch platform API with real-time features",
        contact: {
          name: "Pitchey Support",
          email: "support@pitchey.com",
          url: "https://pitchey.com/support"
        },
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT"
        }
      },
      servers: [
        {
          url: "https://pitchey.pages.dev/api",
          description: "Production server"
        },
        {
          url: "http://localhost:8001/api",
          description: "Development server"
        }
      ],
      paths,
      components: {
        schemas: Object.fromEntries(this.schemas.entries()),
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          },
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key"
          }
        },
        parameters: {},
        responses: {},
        examples: {}
      },
      tags: Array.from(tags).map(tag => ({
        name: tag,
        description: this.getTagDescription(tag)
      }))
    };
  }

  public generatePostmanCollection(): any {
    const endpoints = Array.from(this.endpoints.values());
    
    return {
      info: {
        name: "Pitchey API",
        description: "Complete Pitchey platform API collection",
        version: "1.0.0",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: this.groupEndpointsByTag(endpoints).map(group => ({
        name: group.tag,
        description: this.getTagDescription(group.tag),
        item: group.endpoints.map(endpoint => ({
          name: endpoint.summary,
          event: [],
          request: {
            method: endpoint.method.toUpperCase(),
            header: this.generatePostmanHeaders(endpoint),
            url: {
              raw: `{{baseUrl}}${endpoint.path}`,
              host: ["{{baseUrl}}"],
              path: endpoint.path.split('/').filter(p => p)
            },
            body: endpoint.requestBody ? this.generatePostmanBody(endpoint.requestBody) : undefined,
            description: endpoint.description
          },
          response: endpoint.examples.map(example => ({
            name: example.name,
            originalRequest: {
              method: endpoint.method.toUpperCase(),
              header: [],
              url: {
                raw: example.request.url,
                host: [example.request.url]
              },
              body: example.request.body
            },
            status: example.response.status.toString(),
            code: example.response.status,
            header: Object.entries(example.response.headers || {}).map(([key, value]) => ({
              key,
              value
            })),
            body: JSON.stringify(example.response.body, null, 2)
          }))
        }))
      })),
      variable: [
        {
          key: "baseUrl",
          value: "https://pitchey.pages.dev/api",
          type: "string"
        }
      ]
    };
  }

  public generateMarkdownDocs(): string {
    const endpoints = Array.from(this.endpoints.values());
    const groupedEndpoints = this.groupEndpointsByTag(endpoints);
    
    let markdown = `# Pitchey API Documentation

Generated on: ${new Date().toISOString()}

## Overview
The Pitchey API provides comprehensive access to movie pitch platform features including user management, pitch creation, investor tools, and real-time collaboration.

## Authentication
The API uses JWT Bearer tokens for authentication. Include your token in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_JWT_TOKEN
\`\`\`

## Base URLs
- Production: \`https://pitchey.pages.dev/api\`
- Development: \`http://localhost:8001/api\`

## Rate Limiting
The API implements adaptive rate limiting based on usage patterns and endpoint complexity.

`;

    for (const group of groupedEndpoints) {
      markdown += `## ${group.tag}\n\n`;
      markdown += `${this.getTagDescription(group.tag)}\n\n`;

      for (const endpoint of group.endpoints) {
        markdown += `### ${endpoint.method.toUpperCase()} ${endpoint.path}\n\n`;
        markdown += `${endpoint.description}\n\n`;

        if (endpoint.deprecated) {
          markdown += `⚠️ **DEPRECATED**: This endpoint is deprecated and will be removed in a future version.\n\n`;
        }

        // Parameters
        if (endpoint.parameters.length > 0) {
          markdown += `#### Parameters\n\n`;
          markdown += `| Name | Type | In | Required | Description |\n`;
          markdown += `|------|------|----|---------|--------------|\n`;
          
          for (const param of endpoint.parameters) {
            markdown += `| ${param.name} | ${this.getSchemaType(param.schema)} | ${param.in} | ${param.required ? '✅' : '❌'} | ${param.description} |\n`;
          }
          markdown += `\n`;
        }

        // Request Body
        if (endpoint.requestBody) {
          markdown += `#### Request Body\n\n`;
          markdown += `${endpoint.requestBody.description}\n\n`;
          
          const contentTypes = Object.keys(endpoint.requestBody.content);
          if (contentTypes.length > 0) {
            markdown += `**Content-Type:** ${contentTypes.join(', ')}\n\n`;
          }
        }

        // Responses
        markdown += `#### Responses\n\n`;
        for (const [statusCode, response] of Object.entries(endpoint.responses)) {
          markdown += `**${statusCode}**: ${response.description}\n\n`;
        }

        // Examples
        if (endpoint.examples.length > 0) {
          markdown += `#### Examples\n\n`;
          for (const example of endpoint.examples) {
            markdown += `**${example.name}**\n\n`;
            markdown += `${example.description}\n\n`;
            markdown += `\`\`\`bash\n${example.curlCommand}\n\`\`\`\n\n`;
            markdown += `Response:\n\`\`\`json\n${JSON.stringify(example.response.body, null, 2)}\n\`\`\`\n\n`;
          }
        }

        // Usage stats if enabled
        if (this.generationRules.includeUsageStats && endpoint.usage.calls > 0) {
          markdown += `#### Usage Statistics\n\n`;
          markdown += `- Total Calls: ${endpoint.usage.calls}\n`;
          markdown += `- Error Rate: ${((endpoint.usage.errors / endpoint.usage.calls) * 100).toFixed(2)}%\n`;
          markdown += `- Avg Response Time: ${endpoint.usage.avgResponseTime.toFixed(2)}ms\n`;
          markdown += `- Popularity Score: ${endpoint.usage.popularity.toFixed(2)}\n\n`;
        }

        markdown += `---\n\n`;
      }
    }

    return markdown;
  }

  // Auto-discovery and generation
  public autoDiscoverEndpoints(routes: any[]): number {
    let discoveredCount = 0;

    for (const route of routes) {
      const endpoint = this.analyzeRoute(route);
      if (endpoint) {
        this.registerEndpoint(endpoint);
        discoveredCount++;
      }
    }

    telemetry.logger.info("Auto-discovered endpoints", { count: discoveredCount });
    return discoveredCount;
  }

  // Validation and quality checks
  public validateDocumentation(): Array<{
    endpoint: string;
    issue: string;
    severity: "error" | "warning" | "info";
    suggestion: string;
  }> {
    const issues = [];
    const endpoints = Array.from(this.endpoints.values());

    for (const endpoint of endpoints) {
      // Check for missing descriptions
      if (!endpoint.description || endpoint.description.length < 10) {
        issues.push({
          endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
          issue: "Missing or insufficient description",
          severity: "warning" as const,
          suggestion: "Add a detailed description explaining the endpoint's purpose and behavior"
        });
      }

      // Check for missing examples
      if (endpoint.examples.length === 0) {
        issues.push({
          endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
          issue: "No examples provided",
          severity: "warning" as const,
          suggestion: "Add request/response examples to improve developer experience"
        });
      }

      // Check for missing tags
      if (endpoint.tags.length === 0) {
        issues.push({
          endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
          issue: "No tags assigned",
          severity: "info" as const,
          suggestion: "Add relevant tags to organize endpoints logically"
        });
      }

      // Check for deprecated endpoints without alternatives
      if (endpoint.deprecated && !endpoint.description.includes("alternative")) {
        issues.push({
          endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
          issue: "Deprecated without alternative suggestion",
          severity: "warning" as const,
          suggestion: "Provide alternative endpoint suggestions in the description"
        });
      }

      // Check for missing security information
      if (!endpoint.security && !endpoint.path.includes("/public")) {
        issues.push({
          endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
          issue: "Missing security requirements",
          severity: "error" as const,
          suggestion: "Define security requirements (authentication, authorization) for this endpoint"
        });
      }
    }

    return issues;
  }

  // Metrics and analytics
  public getMetrics(): ApiMetrics {
    const endpoints = Array.from(this.endpoints.values());
    
    const totalEndpoints = endpoints.length;
    const documentedEndpoints = endpoints.filter(e => 
      e.description && e.description.length > 10 && e.examples.length > 0
    ).length;
    const deprecatedEndpoints = endpoints.filter(e => e.deprecated).length;
    
    const versionedEndpoints = endpoints.reduce((acc, e) => {
      acc[e.version] = (acc[e.version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const coveragePercentage = totalEndpoints > 0 ? (documentedEndpoints / totalEndpoints) * 100 : 0;
    
    const popularEndpoints = endpoints
      .filter(e => e.usage.calls > 0)
      .sort((a, b) => b.usage.popularity - a.usage.popularity)
      .slice(0, 10);

    const recentChanges = this.changeHistory
      .slice(-20)
      .map(change => ({
        endpoint: change.endpoint,
        change: change.change,
        timestamp: change.timestamp
      }));

    return {
      totalEndpoints,
      documentedEndpoints,
      deprecatedEndpoints,
      versionedEndpoints,
      coveragePercentage,
      lastUpdated: Date.now(),
      popularEndpoints,
      recentChanges
    };
  }

  // Schema management
  public registerSchema(name: string, schema: any): void {
    this.schemas.set(name, schema);
    telemetry.logger.info("Schema registered", { name });
  }

  public getSchemas(): Record<string, any> {
    return Object.fromEntries(this.schemas.entries());
  }

  // Settings management
  public updateSettings(newSettings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...newSettings };
    telemetry.logger.info("API documentation settings updated", newSettings);
  }

  public getSettings(): typeof this.settings {
    return { ...this.settings };
  }

  // Private helper methods
  private generateEndpointId(method: string, path: string): string {
    return `${method.toUpperCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private trackChange(endpoint: string, change: string, description: string): void {
    const changeId = crypto.randomUUID();
    this.changeHistory.push({
      id: changeId,
      endpoint,
      change,
      timestamp: Date.now(),
      version: "1.0.0" // This should come from actual versioning
    });

    // Keep only recent changes
    if (this.changeHistory.length > this.settings.maxChangeHistory) {
      this.changeHistory = this.changeHistory.slice(-this.settings.maxChangeHistory);
    }
  }

  private analyzeRoute(route: any): Omit<ApiEndpoint, 'id' | 'lastModified' | 'usage'> | null {
    // This would analyze route handlers to extract documentation
    // For now, return null to indicate auto-discovery isn't implemented
    return null;
  }

  private convertParameterToOpenApi(param: ApiParameter): any {
    return {
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required,
      schema: param.schema,
      example: param.example,
      deprecated: param.deprecated
    };
  }

  private convertResponsesToOpenApi(responses: Record<string, ApiResponse>): Record<string, any> {
    const converted: Record<string, any> = {};
    
    for (const [statusCode, response] of Object.entries(responses)) {
      converted[statusCode] = {
        description: response.description,
        headers: response.headers,
        content: response.content
      };
    }
    
    return converted;
  }

  private convertRequestBodyToOpenApi(requestBody: ApiRequestBody): any {
    return {
      description: requestBody.description,
      required: requestBody.required,
      content: requestBody.content
    };
  }

  private getTagDescription(tag: string): string {
    const descriptions: Record<string, string> = {
      "authentication": "User authentication and authorization endpoints",
      "pitches": "Movie pitch creation, management, and discovery",
      "users": "User profile and account management",
      "investors": "Investor-specific functionality and tools",
      "creators": "Creator-specific features and workflow",
      "production": "Production company tools and project management",
      "analytics": "Platform analytics and reporting",
      "messaging": "Real-time messaging and communication",
      "ndas": "NDA management and workflow",
      "payments": "Payment processing and billing",
      "system": "System health and configuration endpoints",
      "search": "Advanced search and filtering capabilities",
      "websocket": "Real-time WebSocket communication",
      "monitoring": "Performance monitoring and metrics",
      "documentation": "API documentation and help resources"
    };
    
    return descriptions[tag.toLowerCase()] || `${tag} related endpoints`;
  }

  private groupEndpointsByTag(endpoints: ApiEndpoint[]): Array<{ tag: string; endpoints: ApiEndpoint[] }> {
    const groups: Record<string, ApiEndpoint[]> = {};
    
    for (const endpoint of endpoints) {
      const primaryTag = endpoint.tags[0] || "uncategorized";
      if (!groups[primaryTag]) {
        groups[primaryTag] = [];
      }
      groups[primaryTag].push(endpoint);
    }
    
    return Object.entries(groups).map(([tag, endpoints]) => ({ tag, endpoints }));
  }

  private generatePostmanHeaders(endpoint: ApiEndpoint): any[] {
    const headers = [];
    
    if (endpoint.security) {
      headers.push({
        key: "Authorization",
        value: "Bearer {{token}}",
        type: "text"
      });
    }
    
    if (endpoint.requestBody) {
      headers.push({
        key: "Content-Type",
        value: "application/json",
        type: "text"
      });
    }
    
    return headers;
  }

  private generatePostmanBody(requestBody: ApiRequestBody): any {
    const contentTypes = Object.keys(requestBody.content);
    const primaryContentType = contentTypes[0];
    
    if (primaryContentType === "application/json") {
      const content = requestBody.content[primaryContentType];
      return {
        mode: "raw",
        raw: JSON.stringify(content.example || {}, null, 2),
        options: {
          raw: {
            language: "json"
          }
        }
      };
    }
    
    return undefined;
  }

  private getSchemaType(schema: any): string {
    if (!schema || !schema.type) return "unknown";
    
    if (schema.type === "array" && schema.items) {
      return `${this.getSchemaType(schema.items)}[]`;
    }
    
    return schema.type;
  }

  private setupAutoGeneration(): void {
    if (!this.settings.autoGenerate) return;

    setInterval(() => {
      if (this.settings.autoValidate) {
        const issues = this.validateDocumentation();
        if (issues.length > 0) {
          telemetry.logger.info("Documentation validation issues found", { count: issues.length });
        }
      }
    }, this.settings.updateInterval);
  }
}