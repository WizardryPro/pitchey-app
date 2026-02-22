import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config before importing the service
vi.mock('../../config', () => ({
  getApiUrl: () => 'http://localhost:8001',
  config: {
    API_URL: 'http://localhost:8001',
    WS_URL: 'ws://localhost:8001',
    NODE_ENV: 'test',
    IS_PRODUCTION: false,
    IS_DEVELOPMENT: true,
    MODE: 'test',
    WEBSOCKET_ENABLED: true
  },
  default: {
    API_URL: 'http://localhost:8001',
  }
}))

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  containerService,
  ContainerService,
  processVideo,
  processDocument,
  processAI,
  transcodeMedia,
  executeCode,
  getJobs,
  getJobStatus,
  cancelJob,
  getContainerDashboard,
  getContainerHealth,
  type ProcessingJob
} from '../containerService'

const makeOkResponse = (body: object) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => JSON.stringify(body),
  json: async () => body
})

const makeErrorResponse = (status: number, statusText = 'Error') => ({
  ok: false,
  status,
  statusText,
  text: async () => JSON.stringify({ error: statusText }),
  json: async () => ({ error: statusText })
})

const mockJob: ProcessingJob = {
  jobId: 'job-123',
  type: 'video',
  status: 'pending',
  progress: 0,
  startTime: '2025-01-01T00:00:00Z'
}

describe('ContainerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── processVideo ─────────────────────────────────────────────────
  describe('processVideo', () => {
    it('sends JSON request when videoFile is a string URL', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))

      const result = await containerService.processVideo({
        videoFile: 'https://example.com/video.mp4',
        outputFormat: 'mp4',
        quality: '1080p'
      })

      expect(result.jobId).toBe('job-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/process/video'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('uploads File object via FormData', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      const file = new File(['video content'], 'test.mp4', { type: 'video/mp4' })

      await containerService.processVideo({ videoFile: file })

      const callArgs = mockFetch.mock.calls[0]
      expect(callArgs[1].body).toBeInstanceOf(FormData)
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal Server Error'))

      await expect(
        containerService.processVideo({ videoFile: 'video.mp4' })
      ).rejects.toThrow()
    })
  })

  // ─── processDocument ──────────────────────────────────────────────
  describe('processDocument', () => {
    it('sends JSON request for URL document', async () => {
      const docJob = { ...mockJob, type: 'document' as const }
      mockFetch.mockResolvedValueOnce(makeOkResponse(docJob))

      const result = await containerService.processDocument({
        documentFile: 'https://example.com/doc.pdf',
        extractText: true
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/process/document'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('uploads File object for document files', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      const file = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' })

      await containerService.processDocument({ documentFile: file })
      expect(mockFetch.mock.calls[0][1].body).toBeInstanceOf(FormData)
    })
  })

  // ─── processAI ────────────────────────────────────────────────────
  describe('processAI', () => {
    it('sends AI inference request', async () => {
      const aiJob = { ...mockJob, type: 'ai' as const }
      mockFetch.mockResolvedValueOnce(makeOkResponse(aiJob))

      const result = await containerService.processAI({
        type: 'pitch-analysis',
        inputText: 'A compelling pitch about...'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/process/ai'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('uploads file for AI processing when inputFile is a File', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      const file = new File(['content'], 'script.txt', { type: 'text/plain' })

      await containerService.processAI({ type: 'text-summary', inputFile: file })
      expect(mockFetch.mock.calls[0][1].body).toBeInstanceOf(FormData)
    })
  })

  // ─── transcodeMedia ───────────────────────────────────────────────
  describe('transcodeMedia', () => {
    it('sends transcode request for URL', async () => {
      const mediaJob = { ...mockJob, type: 'media' as const }
      mockFetch.mockResolvedValueOnce(makeOkResponse(mediaJob))

      await containerService.transcodeMedia({
        mediaFile: 'https://example.com/video.mp4',
        outputFormat: 'webm',
        quality: 'high'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/process/media'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  // ─── executeCode ──────────────────────────────────────────────────
  describe('executeCode', () => {
    it('executes code and returns job', async () => {
      const codeJob = { ...mockJob, type: 'code' as const }
      mockFetch.mockResolvedValueOnce(makeOkResponse(codeJob))

      const result = await containerService.executeCode({
        language: 'javascript',
        code: 'console.log("hello")',
        timeout: 5000
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/process/code'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  // ─── getJobs ──────────────────────────────────────────────────────
  describe('getJobs', () => {
    it('returns list of processing jobs', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([mockJob]))

      const result = await containerService.getJobs()
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].jobId).toBe('job-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/jobs'),
        expect.objectContaining({ credentials: 'include' })
      )
    })
  })

  // ─── getJobStatus ─────────────────────────────────────────────────
  describe('getJobStatus', () => {
    it('returns status of a specific job', async () => {
      const completedJob = { ...mockJob, status: 'completed' as const, progress: 100 }
      mockFetch.mockResolvedValueOnce(makeOkResponse(completedJob))

      const result = await containerService.getJobStatus('job-123')
      expect(result.jobId).toBe('job-123')
      expect(result.status).toBe('completed')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/jobs/job-123'),
        expect.anything()
      )
    })
  })

  // ─── cancelJob ────────────────────────────────────────────────────
  describe('cancelJob', () => {
    it('cancels a job', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true, message: 'Job cancelled' }))

      const result = await containerService.cancelJob('job-123')
      expect(result.success).toBe(true)
      expect(result.message).toBe('Job cancelled')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/jobs/job-123'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  // ─── createJob ────────────────────────────────────────────────────
  describe('createJob', () => {
    it('creates a new job', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))

      const result = await containerService.createJob({
        type: 'video',
        status: 'pending',
        progress: 0,
        startTime: '2025-01-01T00:00:00Z'
      })

      expect(result.type).toBe('video')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/jobs'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  // ─── monitoring endpoints ─────────────────────────────────────────
  describe('monitoring', () => {
    it('getContainerDashboard returns dashboard data', async () => {
      const dashboardData = { activeJobs: 3, completedJobs: 42 }
      mockFetch.mockResolvedValueOnce(makeOkResponse(dashboardData))

      const result = await containerService.getContainerDashboard()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/metrics/dashboard'),
        expect.anything()
      )
    })

    it('getContainerCosts returns cost data', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ totalCost: 12.50 }))
      await containerService.getContainerCosts()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/metrics/costs'),
        expect.anything()
      )
    })

    it('getContainerPerformance returns performance data', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ avgResponseTime: 250 }))
      await containerService.getContainerPerformance()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/metrics/performance'),
        expect.anything()
      )
    })

    it('getContainerHealth returns health data', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ status: 'healthy' }))
      const result = await containerService.getContainerHealth()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/metrics/health'),
        expect.anything()
      )
    })
  })

  // ─── cost optimization ────────────────────────────────────────────
  describe('cost optimization', () => {
    it('getCostRecommendations returns recommendations', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ recommendations: [] }))
      await containerService.getCostRecommendations()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/optimization/recommendations'),
        expect.anything()
      )
    })

    it('implementOptimization posts optimization', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true }))
      await containerService.implementOptimization('opt-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/optimization/implement'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('getContainerBudgets returns budgets', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ budgets: [] }))
      await containerService.getContainerBudgets()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/budgets'),
        expect.anything()
      )
    })

    it('createBudget creates a budget', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ id: 'budget-1' }))
      await containerService.createBudget({ limit: 100 })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/containers/budgets'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  // ─── WebSocket support ────────────────────────────────────────────
  describe('connectToJobWebSocket', () => {
    it('creates a WebSocket connection with job ID in URL', () => {
      let capturedUrl = ''
      class MockWebSocket {
        url: string
        constructor(url: string) {
          this.url = url
          capturedUrl = url
        }
        close() {}
      }
      const originalWebSocket = (globalThis as any).WebSocket
      ;(globalThis as any).WebSocket = MockWebSocket

      containerService.connectToJobWebSocket('job-123')
      expect(capturedUrl).toContain('job-123')

      // Restore original (not using vi.unstubAllGlobals() to avoid resetting fetch)
      ;(globalThis as any).WebSocket = originalWebSocket
    })
  })

  // ─── pingContainerServices ─────────────────────────────────────────
  describe('pingContainerServices', () => {
    it('pings all services and returns health statuses', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ status: 'ok' }))

      const results = await containerService.pingContainerServices()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      results.forEach(r => {
        expect(['healthy', 'unhealthy']).toContain(r.status)
        expect(typeof r.responseTime).toBe('number')
      })
    })

    it('marks service as unhealthy when request fails', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'))

      const results = await containerService.pingContainerServices()
      expect(results.every(r => r.status === 'unhealthy')).toBe(true)
    })
  })

  // ─── convenience function exports ─────────────────────────────────
  describe('convenience functions', () => {
    it('processVideo exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      await processVideo({ videoFile: 'test.mp4' })
      expect(mockFetch).toHaveBeenCalled()
    })

    it('processDocument exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      await processDocument({ documentFile: 'test.pdf' })
      expect(mockFetch).toHaveBeenCalled()
    })

    it('processAI exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      await processAI({ type: 'pitch-analysis', inputText: 'test' })
      expect(mockFetch).toHaveBeenCalled()
    })

    it('transcodeMedia exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      await transcodeMedia({ mediaFile: 'test.mp4', outputFormat: 'webm' })
      expect(mockFetch).toHaveBeenCalled()
    })

    it('executeCode exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      await executeCode({ language: 'python', code: 'print("hello")' })
      expect(mockFetch).toHaveBeenCalled()
    })

    it('getJobs exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([]))
      await getJobs()
      expect(mockFetch).toHaveBeenCalled()
    })

    it('getJobStatus exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(mockJob))
      await getJobStatus('job-123')
      expect(mockFetch).toHaveBeenCalled()
    })

    it('cancelJob exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ success: true, message: 'ok' }))
      await cancelJob('job-123')
      expect(mockFetch).toHaveBeenCalled()
    })

    it('getContainerDashboard exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}))
      await getContainerDashboard()
      expect(mockFetch).toHaveBeenCalled()
    })

    it('getContainerHealth exported function works', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}))
      await getContainerHealth()
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  // ─── error handling ───────────────────────────────────────────────
  describe('error handling', () => {
    it('throws with status info on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(503, 'Service Unavailable'))

      await expect(containerService.getJobs()).rejects.toThrow('Request failed: 503')
    })
  })
})
