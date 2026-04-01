/**
 * Cloudflare Container Orchestration Service
 * Manages containerized microservices for Pitchey platform
 */

import { DatabaseConnectionManager } from '../config/hyperdrive-config';
import type { Env } from '../worker-integrated';

export interface ContainerJob {
  id: string;
  type: 'video-processing' | 'document-processing' | 'ai-inference' | 'media-transcoding' | 'code-execution';
  payload: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  container_id?: string;
  retry_count: number;
  error_message?: string;
  result?: any;
}

export interface ContainerInstance {
  id: string;
  type: string;
  status: 'starting' | 'ready' | 'busy' | 'stopping' | 'error';
  instance_type: string;
  cpu_usage: number;
  memory_usage: number;
  active_jobs: number;
  last_health_check: Date;
  created_at: Date;
}

export interface ContainerMetrics {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  active_containers: number;
  avg_processing_time: number;
  success_rate: number;
  cost_estimate: number;
}

/**
 * Container Orchestration Engine
 */
export class ContainerOrchestrator {
  private dbManager: DatabaseConnectionManager;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.dbManager = new DatabaseConnectionManager(env);
  }

  /**
   * Submit job to appropriate container queue
   */
  async submitJob(job: Omit<ContainerJob, 'id' | 'created_at' | 'status' | 'retry_count'>): Promise<string> {
    const jobId = crypto.randomUUID();
    const fullJob: ContainerJob = {
      ...job,
      id: jobId,
      created_at: new Date(),
      status: 'pending',
      retry_count: 0
    };

    // Store job in database
    const db = this.dbManager.getConnection('write');
    await db`
      INSERT INTO container_jobs (
        id, type, payload, priority, status, created_at, retry_count
      ) VALUES (
        ${jobId}, ${job.type}, ${JSON.stringify(job.payload)}, 
        ${job.priority}, 'pending', ${fullJob.created_at}, 0
      )
    `;

    // Queue job in appropriate container queue
    await this.queueJob(fullJob);

    // Store job status in KV for quick lookup
    await this.env.JOB_STATUS_KV.put(
      `job:${jobId}`, 
      JSON.stringify({ status: 'pending', created_at: fullJob.created_at }),
      { expirationTtl: 86400 } // 24 hours
    );

    return jobId;
  }

  /**
   * Queue job in appropriate container queue
   */
  private async queueJob(job: ContainerJob): Promise<void> {
    const queueMapping = {
      'video-processing': this.env.VIDEO_PROCESSING_QUEUE,
      'document-processing': this.env.DOCUMENT_PROCESSING_QUEUE,
      'ai-inference': this.env.AI_INFERENCE_QUEUE,
      'media-transcoding': this.env.MEDIA_TRANSCODING_QUEUE,
      'code-execution': this.env.CODE_EXECUTION_QUEUE
    };

    const queue = queueMapping[job.type];
    if (!queue) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    await queue.send(job, {
      delaySeconds: this.getPriorityDelay(job.priority)
    });
  }

  /**
   * Get delay based on job priority
   */
  private getPriorityDelay(priority: string): number {
    switch (priority) {
      case 'critical': return 0;
      case 'high': return 5;
      case 'medium': return 30;
      case 'low': return 120;
      default: return 30;
    }
  }

  /**
   * Process video job
   */
  async processVideoJob(job: ContainerJob): Promise<any> {
    await this.updateJobStatus(job.id, 'processing');

    try {
      // Call VideoProcessorContainer
      const response = await fetch(`https://containers.pitchey.com/video-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CONTAINER_API_TOKEN}`
        },
        body: JSON.stringify({
          job_id: job.id,
          input_url: job.payload.input_url,
          output_format: job.payload.output_format || 'mp4',
          quality: job.payload.quality || '1080p',
          thumbnail_count: job.payload.thumbnail_count || 5
        })
      });

      if (!response.ok) {
        throw new Error(`Container processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      await this.updateJobStatus(job.id, 'completed', result);
      return result;
    } catch (error) {
      await this.updateJobStatus(job.id, 'failed', null, (error as Error).message);
      throw error;
    }
  }

  /**
   * Process document job
   */
  async processDocumentJob(job: ContainerJob): Promise<any> {
    await this.updateJobStatus(job.id, 'processing');

    try {
      const response = await fetch(`https://containers.pitchey.com/document-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CONTAINER_API_TOKEN}`
        },
        body: JSON.stringify({
          job_id: job.id,
          document_url: job.payload.document_url,
          extract_text: job.payload.extract_text || true,
          generate_preview: job.payload.generate_preview || true,
          ocr_enabled: job.payload.ocr_enabled || false
        })
      });

      if (!response.ok) {
        throw new Error(`Document processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      await this.updateJobStatus(job.id, 'completed', result);
      return result;
    } catch (error) {
      await this.updateJobStatus(job.id, 'failed', null, (error as Error).message);
      throw error;
    }
  }

  /**
   * Process AI inference job
   */
  async processAIInferenceJob(job: ContainerJob): Promise<any> {
    await this.updateJobStatus(job.id, 'processing');

    try {
      const response = await fetch(`https://containers.pitchey.com/ai-inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CONTAINER_API_TOKEN}`
        },
        body: JSON.stringify({
          job_id: job.id,
          model: job.payload.model,
          input_data: job.payload.input_data,
          parameters: job.payload.parameters || {}
        })
      });

      if (!response.ok) {
        throw new Error(`AI inference failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      await this.updateJobStatus(job.id, 'completed', result);
      return result;
    } catch (error) {
      await this.updateJobStatus(job.id, 'failed', null, (error as Error).message);
      throw error;
    }
  }

  /**
   * Process media transcoding job
   */
  async processMediaTranscodingJob(job: ContainerJob): Promise<any> {
    await this.updateJobStatus(job.id, 'processing');

    try {
      const response = await fetch(`https://containers.pitchey.com/media-transcoder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CONTAINER_API_TOKEN}`
        },
        body: JSON.stringify({
          job_id: job.id,
          input_media: job.payload.input_media,
          output_presets: job.payload.output_presets || ['web-optimized'],
          generate_thumbnails: job.payload.generate_thumbnails || true
        })
      });

      if (!response.ok) {
        throw new Error(`Media transcoding failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      await this.updateJobStatus(job.id, 'completed', result);
      return result;
    } catch (error) {
      await this.updateJobStatus(job.id, 'failed', null, (error as Error).message);
      throw error;
    }
  }

  /**
   * Process code execution job
   */
  async processCodeExecutionJob(job: ContainerJob): Promise<any> {
    await this.updateJobStatus(job.id, 'processing');

    try {
      const response = await fetch(`https://containers.pitchey.com/code-executor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CONTAINER_API_TOKEN}`
        },
        body: JSON.stringify({
          job_id: job.id,
          language: job.payload.language,
          code: job.payload.code,
          timeout: job.payload.timeout || 30,
          memory_limit: job.payload.memory_limit || 512
        })
      });

      if (!response.ok) {
        throw new Error(`Code execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      await this.updateJobStatus(job.id, 'completed', result);
      return result;
    } catch (error) {
      await this.updateJobStatus(job.id, 'failed', null, (error as Error).message);
      throw error;
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string, 
    status: ContainerJob['status'], 
    result?: any, 
    errorMessage?: string
  ): Promise<void> {
    const db = this.dbManager.getConnection('write');
    
    const updateData: any = { status };
    
    if (status === 'processing') {
      updateData.started_at = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date();
      if (result) updateData.result = JSON.stringify(result);
      if (errorMessage) updateData.error_message = errorMessage;
    }

    // Build dynamic query
    const setPairs = Object.keys(updateData).map(key => `${key} = $${Object.keys(updateData).indexOf(key) + 2}`);
    const values = [jobId, ...Object.values(updateData)];

    await db.unsafe(`
      UPDATE container_jobs 
      SET ${setPairs.join(', ')}, updated_at = NOW()
      WHERE id = $1
    `, values);

    // Update KV cache
    await this.env.JOB_STATUS_KV.put(
      `job:${jobId}`,
      JSON.stringify({ 
        status, 
        result: result || null,
        error: errorMessage || null,
        updated_at: new Date() 
      }),
      { expirationTtl: 86400 }
    );
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    // Try KV cache first
    const cached = await this.env.JOB_STATUS_KV.get(`job:${jobId}`, 'json');
    if (cached) {
      return cached;
    }

    // Fallback to database
    const db = this.dbManager.getConnection('read');
    const result = await db`
      SELECT * FROM container_jobs WHERE id = ${jobId}
    `;

    return result[0] || null;
  }

  /**
   * Get container metrics
   */
  async getContainerMetrics(): Promise<ContainerMetrics> {
    const db = this.dbManager.getConnection('read');
    
    const stats = await db`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time
      FROM container_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const containerStats = await db`
      SELECT COUNT(*) as active_containers
      FROM container_instances
      WHERE status IN ('ready', 'busy')
    `;

    const metrics: ContainerMetrics = {
      total_jobs: parseInt(stats[0].total_jobs),
      completed_jobs: parseInt(stats[0].completed_jobs),
      failed_jobs: parseInt(stats[0].failed_jobs),
      active_containers: parseInt(containerStats[0].active_containers),
      avg_processing_time: parseFloat(stats[0].avg_processing_time) || 0,
      success_rate: stats[0].total_jobs > 0 
        ? (stats[0].completed_jobs / stats[0].total_jobs) * 100 
        : 0,
      cost_estimate: await this.calculateCostEstimate()
    };

    return metrics;
  }

  /**
   * Calculate estimated costs
   */
  private async calculateCostEstimate(): Promise<number> {
    // Basic cost calculation based on container usage
    const db = this.dbManager.getConnection('read');
    
    const usage = await db`
      SELECT 
        type,
        COUNT(*) as job_count,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
      FROM container_jobs
      WHERE created_at > NOW() - INTERVAL '1 hour'
        AND status = 'completed'
      GROUP BY type
    `;

    // Container pricing (simplified estimates)
    const pricing = {
      'video-processing': 0.0024,    // per minute for standard-2
      'document-processing': 0.0012, // per minute for standard-1
      'ai-inference': 0.0048,        // per minute for standard-4
      'media-transcoding': 0.0024,   // per minute for standard-2
      'code-execution': 0.0006       // per minute for lite
    };

    let totalCost = 0;
    for (const row of usage) {
      const costPerMinute = pricing[row.type as keyof typeof pricing] || 0;
      const durationMinutes = (parseFloat(row.avg_duration) || 0) / 60;
      const jobCount = parseInt(row.job_count);
      totalCost += costPerMinute * durationMinutes * jobCount;
    }

    return totalCost;
  }

  /**
   * Health check for containers
   */
  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const containers = [
      'video-processor',
      'document-processor', 
      'ai-inference',
      'media-transcoder',
      'code-executor'
    ];

    const healthStatus: { [key: string]: boolean } = {};

    await Promise.all(
      containers.map(async (container) => {
        try {
          const response = await fetch(
            `https://containers.pitchey.com/${container}/health`,
            { method: 'GET', signal: AbortSignal.timeout(5000) }
          );
          healthStatus[container] = response.ok;
        } catch {
          healthStatus[container] = false;
        }
      })
    );

    return healthStatus;
  }

  /**
   * Scale containers based on queue depth
   */
  async autoScale(): Promise<void> {
    // This would integrate with Cloudflare's container scaling API
    // For now, just log scaling decisions
    
    const queueDepths = await this.getQueueDepths();
    
    for (const [queueType, depth] of Object.entries(queueDepths)) {
      if (depth > 100) {
        console.log(`Scaling up ${queueType} containers - queue depth: ${depth}`);
        // await this.scaleUpContainer(queueType);
      } else if (depth < 10) {
        console.log(`Scaling down ${queueType} containers - queue depth: ${depth}`);
        // await this.scaleDownContainer(queueType);
      }
    }
  }

  /**
   * Get queue depths for all container types
   */
  private async getQueueDepths(): Promise<{ [key: string]: number }> {
    const db = this.dbManager.getConnection('read');
    
    const depths = await db`
      SELECT 
        type,
        COUNT(*) as pending_jobs
      FROM container_jobs
      WHERE status IN ('pending', 'processing')
      GROUP BY type
    `;

    const queueDepths: { [key: string]: number } = {};
    for (const row of depths) {
      queueDepths[row.type] = parseInt(row.pending_jobs);
    }

    return queueDepths;
  }

  /**
   * Process dead letter queue
   */
  async processDLQ(queueName: string): Promise<void> {
    console.log(`Processing dead letter queue: ${queueName}`);
    
    // Get failed jobs from DLQ
    const db = this.dbManager.getConnection('read');
    const failedJobs = await db`
      SELECT * FROM container_jobs
      WHERE status = 'failed' 
        AND retry_count < 3
        AND type = ${queueName.replace('-dlq', '')}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    for (const job of failedJobs) {
      // Increment retry count
      await db`
        UPDATE container_jobs
        SET retry_count = retry_count + 1, status = 'retrying'
        WHERE id = ${job.id}
      `;

      // Re-queue the job
      await this.queueJob(job as ContainerJob);
    }
  }
}

/**
 * Queue consumer handlers
 */
export const queueConsumers = {
  async videoProcessing(batch: MessageBatch<ContainerJob>, env: Env): Promise<void> {
    const orchestrator = new ContainerOrchestrator(env);
    
    for (const message of batch.messages) {
      try {
        await orchestrator.processVideoJob(message.body);
        message.ack();
      } catch (error) {
        console.error('Video processing failed:', error);
        message.retry();
      }
    }
  },

  async documentProcessing(batch: MessageBatch<ContainerJob>, env: Env): Promise<void> {
    const orchestrator = new ContainerOrchestrator(env);
    
    for (const message of batch.messages) {
      try {
        await orchestrator.processDocumentJob(message.body);
        message.ack();
      } catch (error) {
        console.error('Document processing failed:', error);
        message.retry();
      }
    }
  },

  async aiInference(batch: MessageBatch<ContainerJob>, env: Env): Promise<void> {
    const orchestrator = new ContainerOrchestrator(env);
    
    for (const message of batch.messages) {
      try {
        await orchestrator.processAIInferenceJob(message.body);
        message.ack();
      } catch (error) {
        console.error('AI inference failed:', error);
        message.retry();
      }
    }
  },

  async mediaTranscoding(batch: MessageBatch<ContainerJob>, env: Env): Promise<void> {
    const orchestrator = new ContainerOrchestrator(env);
    
    for (const message of batch.messages) {
      try {
        await orchestrator.processMediaTranscodingJob(message.body);
        message.ack();
      } catch (error) {
        console.error('Media transcoding failed:', error);
        message.retry();
      }
    }
  },

  async codeExecution(batch: MessageBatch<ContainerJob>, env: Env): Promise<void> {
    const orchestrator = new ContainerOrchestrator(env);
    
    for (const message of batch.messages) {
      try {
        await orchestrator.processCodeExecutionJob(message.body);
        message.ack();
      } catch (error) {
        console.error('Code execution failed:', error);
        message.retry();
      }
    }
  },

  async dlqProcessor(batch: MessageBatch, env: Env): Promise<void> {
    const orchestrator = new ContainerOrchestrator(env);
    
    for (const message of batch.messages) {
      try {
        await orchestrator.processDLQ((message.body as any).queue_name);
        message.ack();
      } catch (error) {
        console.error('DLQ processing failed:', error);
        message.retry();
      }
    }
  }
};