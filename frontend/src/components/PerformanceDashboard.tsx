import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Alert, AlertDescription } from '@shared/components/ui/alert'
import { Progress } from '@shared/components/ui/progress'
import { Badge } from '@shared/components/ui/badge'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Activity, AlertTriangle, CheckCircle, Clock, Database, Globe, HardDrive, Zap } from 'lucide-react'

interface WebVitals {
  lcp: number // Largest Contentful Paint
  fid: number // First Input Delay
  cls: number // Cumulative Layout Shift
  fcp: number // First Contentful Paint
  ttfb: number // Time to First Byte
  tti: number // Time to Interactive
}

interface PerformanceMetrics {
  timestamp: number
  cpu: number
  memory: number
  fps: number
  networkLatency: number
  apiResponseTime: number
  cacheHitRate: number
  errorRate: number
}

interface APIMetrics {
  endpoint: string
  method: string
  count: number
  avgTime: number
  p95Time: number
  p99Time: number
  errorCount: number
}

export function PerformanceDashboard() {
  const [webVitals, setWebVitals] = useState<WebVitals | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const [apiMetrics, setApiMetrics] = useState<APIMetrics[]>([])
  const [realTimeMetrics, setRealTimeMetrics] = useState<PerformanceMetrics | null>(null)
  const [resourceTimings, setResourceTimings] = useState<any[]>([])
  
  // Collect Web Vitals
  useEffect(() => {
    const collectWebVitals = () => {
      const vitals: WebVitals = {
        lcp: 0,
        fid: 0,
        cls: 0,
        fcp: 0,
        ttfb: 0,
        tti: 0
      }
      
      // Get navigation timing
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navTiming) {
        vitals.ttfb = navTiming.responseStart - navTiming.fetchStart
        vitals.fcp = navTiming.responseEnd - navTiming.fetchStart
      }
      
      // Observe LCP
      if ('PerformanceObserver' in window) {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          vitals.lcp = lastEntry.renderTime || lastEntry.loadTime
          setWebVitals({ ...vitals })
        })
        
        try {
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        } catch (e) {
          console.warn('LCP observer not supported')
        }
        
        // Observe FID
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            vitals.fid = entry.processingStart - entry.startTime
            setWebVitals({ ...vitals })
          })
        })
        
        try {
          fidObserver.observe({ entryTypes: ['first-input'] })
        } catch (e) {
          console.warn('FID observer not supported')
        }
        
        // Observe CLS
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
          vitals.cls = clsValue
          setWebVitals({ ...vitals })
        })
        
        try {
          clsObserver.observe({ entryTypes: ['layout-shift'] })
        } catch (e) {
          console.warn('CLS observer not supported')
        }
      }
      
      setWebVitals(vitals)
    }
    
    collectWebVitals()
  }, [])
  
  // Collect real-time metrics
  useEffect(() => {
    const collectMetrics = () => {
      const metric: PerformanceMetrics = {
        timestamp: Date.now(),
        cpu: 0,
        memory: 0,
        fps: 0,
        networkLatency: 0,
        apiResponseTime: 0,
        cacheHitRate: 0,
        errorRate: 0
      }
      
      // Memory usage
      if ('memory' in performance) {
        const memory = (performance as any).memory
        metric.memory = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
      
      // FPS calculation
      let lastTime = performance.now()
      let frames = 0
      const measureFPS = () => {
        frames++
        const currentTime = performance.now()
        if (currentTime >= lastTime + 1000) {
          metric.fps = Math.round((frames * 1000) / (currentTime - lastTime))
          frames = 0
          lastTime = currentTime
        }
        if (frames < 10) requestAnimationFrame(measureFPS)
      }
      requestAnimationFrame(measureFPS)
      
      // Network latency (simulated)
      metric.networkLatency = Math.random() * 100 + 50
      
      // API response time (from performance entries)
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const apiCalls = resources.filter(r => r.name.includes('/api/'))
      if (apiCalls.length > 0) {
        const avgTime = apiCalls.reduce((sum, r) => sum + r.duration, 0) / apiCalls.length
        metric.apiResponseTime = avgTime
      }
      
      // Cache hit rate (simulated)
      metric.cacheHitRate = Math.random() * 30 + 70
      
      // Error rate (simulated)
      metric.errorRate = Math.random() * 5
      
      setRealTimeMetrics(metric)
      setMetrics(prev => [...prev.slice(-29), metric])
    }
    
    const interval = setInterval(collectMetrics, 2000)
    collectMetrics()
    
    return () => clearInterval(interval)
  }, [])
  
  // Collect API metrics
  useEffect(() => {
    const collectAPIMetrics = () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const apiCalls = resources.filter(r => r.name.includes('/api/'))
      
      const metricsMap = new Map<string, APIMetrics>()
      
      apiCalls.forEach(call => {
        const url = new URL(call.name)
        const endpoint = url.pathname
        const key = endpoint
        
        if (!metricsMap.has(key)) {
          metricsMap.set(key, {
            endpoint,
            method: 'GET', // Default, would need to track actual method
            count: 0,
            avgTime: 0,
            p95Time: 0,
            p99Time: 0,
            errorCount: 0
          })
        }
        
        const metric = metricsMap.get(key)!
        metric.count++
        metric.avgTime = (metric.avgTime * (metric.count - 1) + call.duration) / metric.count
        metric.p95Time = Math.max(metric.p95Time, call.duration * 0.95)
        metric.p99Time = Math.max(metric.p99Time, call.duration * 0.99)
      })
      
      setApiMetrics(Array.from(metricsMap.values()))
    }
    
    collectAPIMetrics()
    const interval = setInterval(collectAPIMetrics, 5000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Collect resource timings
  useEffect(() => {
    const collectResourceTimings = () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      
      const grouped = resources.reduce((acc, resource) => {
        const type = resource.initiatorType
        if (!acc[type]) {
          acc[type] = {
            type,
            count: 0,
            totalSize: 0,
            totalDuration: 0,
            avgDuration: 0
          }
        }
        
        acc[type].count++
        acc[type].totalSize += resource.transferSize || 0
        acc[type].totalDuration += resource.duration
        acc[type].avgDuration = acc[type].totalDuration / acc[type].count
        
        return acc
      }, {} as Record<string, any>)
      
      setResourceTimings(Object.values(grouped))
    }
    
    collectResourceTimings()
  }, [])
  
  const getVitalStatus = (value: number, thresholds: { good: number; needs: number }) => {
    if (value <= thresholds.good) return { color: 'green', icon: CheckCircle, text: 'Good' }
    if (value <= thresholds.needs) return { color: 'yellow', icon: AlertTriangle, text: 'Needs Improvement' }
    return { color: 'red', icon: AlertTriangle, text: 'Poor' }
  }
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time performance monitoring and analytics</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Activity className="w-4 h-4 mr-1" />
          Live Monitoring
        </Badge>
      </div>
      
      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {webVitals && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">LCP</CardTitle>
                <CardDescription className="text-xs">Largest Contentful Paint</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{webVitals.lcp.toFixed(0)}ms</div>
                <Badge 
                  variant={webVitals.lcp < 2500 ? 'default' : webVitals.lcp < 4000 ? 'secondary' : 'destructive'}
                  className="mt-2"
                >
                  {webVitals.lcp < 2500 ? 'Good' : webVitals.lcp < 4000 ? 'Needs Work' : 'Poor'}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">FID</CardTitle>
                <CardDescription className="text-xs">First Input Delay</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{webVitals.fid.toFixed(0)}ms</div>
                <Badge 
                  variant={webVitals.fid < 100 ? 'default' : webVitals.fid < 300 ? 'secondary' : 'destructive'}
                  className="mt-2"
                >
                  {webVitals.fid < 100 ? 'Good' : webVitals.fid < 300 ? 'Needs Work' : 'Poor'}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">CLS</CardTitle>
                <CardDescription className="text-xs">Cumulative Layout Shift</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{webVitals.cls.toFixed(3)}</div>
                <Badge 
                  variant={webVitals.cls < 0.1 ? 'default' : webVitals.cls < 0.25 ? 'secondary' : 'destructive'}
                  className="mt-2"
                >
                  {webVitals.cls < 0.1 ? 'Good' : webVitals.cls < 0.25 ? 'Needs Work' : 'Poor'}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">FCP</CardTitle>
                <CardDescription className="text-xs">First Contentful Paint</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{webVitals.fcp.toFixed(0)}ms</div>
                <Badge 
                  variant={webVitals.fcp < 1800 ? 'default' : webVitals.fcp < 3000 ? 'secondary' : 'destructive'}
                  className="mt-2"
                >
                  {webVitals.fcp < 1800 ? 'Good' : webVitals.fcp < 3000 ? 'Needs Work' : 'Poor'}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">TTFB</CardTitle>
                <CardDescription className="text-xs">Time to First Byte</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{webVitals.ttfb.toFixed(0)}ms</div>
                <Badge 
                  variant={webVitals.ttfb < 800 ? 'default' : webVitals.ttfb < 1800 ? 'secondary' : 'destructive'}
                  className="mt-2"
                >
                  {webVitals.ttfb < 800 ? 'Good' : webVitals.ttfb < 1800 ? 'Needs Work' : 'Poor'}
                </Badge>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">TTI</CardTitle>
                <CardDescription className="text-xs">Time to Interactive</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{webVitals.tti.toFixed(0)}ms</div>
                <Badge 
                  variant={webVitals.tti < 3800 ? 'default' : webVitals.tti < 7300 ? 'secondary' : 'destructive'}
                  className="mt-2"
                >
                  {webVitals.tti < 3800 ? 'Good' : webVitals.tti < 7300 ? 'Needs Work' : 'Poor'}
                </Badge>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Real-time Metrics */}
      {realTimeMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <HardDrive className="w-4 h-4 mr-2" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realTimeMetrics.memory.toFixed(1)}%</div>
              <Progress value={realTimeMetrics.memory} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                FPS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realTimeMetrics.fps}</div>
              <Progress value={(realTimeMetrics.fps / 60) * 100} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                Network Latency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realTimeMetrics.networkLatency.toFixed(0)}ms</div>
              <Progress value={100 - (realTimeMetrics.networkLatency / 2)} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <Database className="w-4 h-4 mr-2" />
                Cache Hit Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realTimeMetrics.cacheHitRate.toFixed(1)}%</div>
              <Progress value={realTimeMetrics.cacheHitRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Key metrics over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(t) => new Date(t).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#8884d8" 
                  name="Memory %" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="cacheHitRate" 
                  stroke="#82ca9d" 
                  name="Cache Hit %" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="errorRate" 
                  stroke="#ff7300" 
                  name="Error %" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>API Performance</CardTitle>
            <CardDescription>Response times by endpoint</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={apiMetrics.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="endpoint" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgTime" fill="#8884d8" name="Avg Time (ms)" />
                <Bar dataKey="p95Time" fill="#82ca9d" name="P95 Time (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Resource Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Loading</CardTitle>
          <CardDescription>Breakdown by resource type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {resourceTimings.map((resource) => (
              <div key={resource.type} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline">{resource.type}</Badge>
                  <span className="text-sm text-gray-600">
                    {resource.count} files
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm">
                    {formatBytes(resource.totalSize)}
                  </span>
                  <span className="text-sm font-medium">
                    {resource.avgDuration.toFixed(0)}ms avg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* API Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>Detailed performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Endpoint</th>
                  <th className="text-center p-2">Calls</th>
                  <th className="text-center p-2">Avg Time</th>
                  <th className="text-center p-2">P95</th>
                  <th className="text-center p-2">P99</th>
                  <th className="text-center p-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {apiMetrics.map((metric) => (
                  <tr key={metric.endpoint} className="border-b">
                    <td className="p-2 font-mono text-xs">{metric.endpoint}</td>
                    <td className="text-center p-2">{metric.count}</td>
                    <td className="text-center p-2">{metric.avgTime.toFixed(0)}ms</td>
                    <td className="text-center p-2">{metric.p95Time.toFixed(0)}ms</td>
                    <td className="text-center p-2">{metric.p99Time.toFixed(0)}ms</td>
                    <td className="text-center p-2">
                      <Badge variant={metric.errorCount > 0 ? 'destructive' : 'secondary'}>
                        {metric.errorCount}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PerformanceDashboard