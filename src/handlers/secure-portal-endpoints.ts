/**
 * Secure Portal-Specific Dashboard Endpoints
 * Comprehensive implementation with proper access validation and business logic
 */

import type { Env } from '../db/connection';
import { getDb } from '../db/connection';
import { 
  PortalAccessController, 
  requirePortalAccess, 
  extractPortalFromPath,
  validatePortalConsistency 
} from '../middleware/portal-access-control';
import { UserRole, Permission, RBAC } from '../middleware/rbac';
import { CreatorInvestorWorkflow } from '../workflows/creator-investor-workflow';
import { CreatorProductionWorkflow } from '../workflows/creator-production-workflow';
import { NDAStateMachine } from '../workflows/nda-state-machine';
import { getCorsHeaders } from '../utils/response';

export class SecurePortalEndpoints {
  private env: Env;
  private db: any;
  private portalController: PortalAccessController;
  private investorWorkflow: CreatorInvestorWorkflow;
  private productionWorkflow: CreatorProductionWorkflow;
  private ndaStateMachine: NDAStateMachine;

  constructor(env: Env) {
    this.env = env;
    this.db = getDb(env);
    this.portalController = new PortalAccessController(env);
    this.investorWorkflow = new CreatorInvestorWorkflow(env);
    this.productionWorkflow = new CreatorProductionWorkflow(env);
    this.ndaStateMachine = new NDAStateMachine(env);
  }

  // ================================================================================
  // CREATOR PORTAL ENDPOINTS
  // ================================================================================

  /**
   * GET /api/creator/dashboard - Comprehensive creator dashboard
   */
  @requirePortalAccess('creator')
  async getCreatorDashboard(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      
      // Validate portal consistency
      const consistencyCheck = await validatePortalConsistency(this.env, user.id, 'creator');
      if (!consistencyCheck.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PORTAL_MISMATCH', message: consistencyCheck.reason }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Fetch comprehensive dashboard data
      const [
        pitchesOverview,
        investmentDeals,
        productionDeals,
        ndaRequests,
        recentActivity,
        revenueMetrics,
        analyticsData
      ] = await Promise.allSettled([
        this.getCreatorPitchesOverview(user.id),
        this.getCreatorInvestmentDeals(user.id),
        this.getCreatorProductionDeals(user.id),
        this.getCreatorNDARequests(user.id),
        this.getCreatorRecentActivity(user.id),
        this.getCreatorRevenueMetrics(user.id),
        this.getCreatorAnalytics(user.id)
      ]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          overview: {
            user_info: {
              id: user.id,
              name: user.name || user.username,
              user_type: user.userType || user.user_type,
              subscription_tier: user.subscription_tier,
              verified: user.company_verified || user.email_verified
            },
            pitches: this.getSettledValue(pitchesOverview, {}),
            investments: this.getSettledValue(investmentDeals, {}),
            production_deals: this.getSettledValue(productionDeals, {}),
            nda_requests: this.getSettledValue(ndaRequests, {}),
            revenue: this.getSettledValue(revenueMetrics, {}),
            analytics: this.getSettledValue(analyticsData, {})
          },
          recent_activity: this.getSettledValue(recentActivity, []),
          portal_permissions: {
            can_create_pitches: true,
            can_manage_deals: true,
            can_approve_ndas: true,
            subscription_features: user.subscription_tier !== 'free'
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Creator dashboard error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load creator dashboard' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * GET /api/creator/deals - Creator's investment and production deals
   */
  @requirePortalAccess('creator')
  async getCreatorDeals(request: Request): Promise<Response> {
    return this.investorWorkflow.getDealDashboard(request, 'creator');
  }

  /**
   * GET /api/creator/revenue - Creator revenue dashboard
   */
  @requirePortalAccess('creator')
  async getCreatorRevenue(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      const url = new URL(request.url);
      
      // Ensure creator can only access their own revenue data
      const targetUserId = url.searchParams.get('userId');
      if (targetUserId && parseInt(targetUserId) !== user.id) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot access other creators\' revenue data' }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      const revenueData = await this.getDetailedRevenueMetrics(user.id);

      return new Response(JSON.stringify({
        success: true,
        data: revenueData
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Creator revenue error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load revenue data' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * GET /api/creator/ndas - Creator's NDA management
   */
  @requirePortalAccess('creator')
  async getCreatorNDAs(request: Request): Promise<Response> {
    return this.ndaStateMachine.getNDADashboard(request, 'creator');
  }

  // ================================================================================
  // INVESTOR PORTAL ENDPOINTS
  // ================================================================================

  /**
   * GET /api/investor/dashboard - Comprehensive investor dashboard
   */
  @requirePortalAccess('investor')
  async getInvestorDashboard(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      
      // Validate portal consistency and investor verification
      const consistencyCheck = await validatePortalConsistency(this.env, user.id, 'investor');
      if (!consistencyCheck.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PORTAL_MISMATCH', message: consistencyCheck.reason }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Fetch investor-specific data
      const [
        portfolioOverview,
        investmentOpportunities,
        activeDeals,
        ndaStatus,
        savedPitches,
        performanceMetrics
      ] = await Promise.allSettled([
        this.getInvestorPortfolioOverview(user.id),
        this.getInvestorOpportunities(user.id),
        this.getInvestorActiveDeals(user.id),
        this.getInvestorNDAStatus(user.id),
        this.getInvestorSavedPitches(user.id),
        this.getInvestorPerformanceMetrics(user.id)
      ]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          overview: {
            user_info: {
              id: user.id,
              name: user.name || user.username,
              user_type: user.userType || user.user_type,
              subscription_tier: user.subscription_tier,
              verified: user.email_verified
            },
            portfolio: this.getSettledValue(portfolioOverview, {}),
            opportunities: this.getSettledValue(investmentOpportunities, {}),
            active_deals: this.getSettledValue(activeDeals, {}),
            nda_status: this.getSettledValue(ndaStatus, {}),
            saved_pitches: this.getSettledValue(savedPitches, {}),
            performance: this.getSettledValue(performanceMetrics, {})
          },
          portal_permissions: {
            can_invest: user.email_verified,
            can_request_ndas: true,
            can_save_pitches: true,
            large_investments: user.company_verified,
            subscription_features: user.subscription_tier !== 'free'
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Investor dashboard error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load investor dashboard' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * GET /api/investor/opportunities - Investment opportunities with filtering
   */
  @requirePortalAccess('investor')
  async getInvestmentOpportunities(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const filters = {
      genre: url.searchParams.getAll('genre'),
      format: url.searchParams.getAll('format'),
      budget_range: {
        min: parseInt(url.searchParams.get('min_budget') || '0'),
        max: parseInt(url.searchParams.get('max_budget') || '10000000')
      },
      seeking_investment: url.searchParams.get('seeking_investment') === 'true',
      location: url.searchParams.get('location') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '20'),
      offset: parseInt(url.searchParams.get('offset') || '0')
    };

    return this.investorWorkflow.getInvestmentOpportunities(request, filters);
  }

  /**
   * POST /api/investor/express-interest - Express investment interest
   */
  @requirePortalAccess('investor')
  async expressInvestmentInterest(request: Request): Promise<Response> {
    const body = await request.json() as Record<string, unknown>;
    const { pitch_id, investment_amount, equity_percentage, terms, message } = body;

    if (!pitch_id || !investment_amount) {
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'pitch_id and investment_amount are required' }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }

    return this.investorWorkflow.expressInvestmentInterest(request, pitch_id as number, {
      amount: investment_amount as number,
      equity_percentage: equity_percentage as number | undefined,
      terms: terms as string | undefined,
      message: message as string | undefined
    });
  }

  /**
   * GET /api/investor/portfolio - Investor portfolio dashboard
   */
  @requirePortalAccess('investor')
  async getInvestorPortfolio(request: Request): Promise<Response> {
    return this.investorWorkflow.getDealDashboard(request, 'investor');
  }

  /**
   * GET /api/investor/ndas - Investor's NDA status
   */
  @requirePortalAccess('investor')
  async getInvestorNDAs(request: Request): Promise<Response> {
    return this.ndaStateMachine.getNDADashboard(request, 'investor');
  }

  // ================================================================================
  // PRODUCTION PORTAL ENDPOINTS  
  // ================================================================================

  /**
   * GET /api/production/dashboard - Comprehensive production company dashboard
   */
  @requirePortalAccess('production')
  async getProductionDashboard(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    try {
      const user = (request as any).user;
      
      // Validate portal consistency and company verification
      const consistencyCheck = await validatePortalConsistency(this.env, user.id, 'production');
      if (!consistencyCheck.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'PORTAL_MISMATCH', message: consistencyCheck.reason }
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        });
      }

      // Fetch production-specific data
      const [
        pipelineOverview,
        productionOpportunities,
        activeDeals,
        talentSearch,
        projectsInDevelopment,
        performanceMetrics
      ] = await Promise.allSettled([
        this.getProductionPipelineOverview(user.id),
        this.getProductionOpportunitiesForUser(user.id),
        this.getProductionActiveDeals(user.id),
        this.getProductionTalentSearch(user.id),
        this.getProductionProjectsInDevelopment(user.id),
        this.getProductionPerformanceMetrics(user.id)
      ]);

      return new Response(JSON.stringify({
        success: true,
        data: {
          overview: {
            user_info: {
              id: user.id,
              name: user.name || user.username,
              company_name: user.company_name,
              user_type: user.userType || user.user_type,
              subscription_tier: user.subscription_tier,
              verified: user.company_verified
            },
            pipeline: this.getSettledValue(pipelineOverview, {}),
            opportunities: this.getSettledValue(productionOpportunities, {}),
            active_deals: this.getSettledValue(activeDeals, {}),
            talent: this.getSettledValue(talentSearch, {}),
            projects: this.getSettledValue(projectsInDevelopment, {}),
            performance: this.getSettledValue(performanceMetrics, {})
          },
          portal_permissions: {
            can_make_offers: user.company_verified,
            can_request_ndas: true,
            can_search_talent: true,
            large_deals: user.company_verified && user.subscription_tier !== 'free',
            subscription_features: user.subscription_tier !== 'free'
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });

    } catch (error) {
      console.error('Production dashboard error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to load production dashboard' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }
  }

  /**
   * GET /api/production/opportunities - Production opportunities with filtering
   */
  @requirePortalAccess('production')
  async getProductionOpportunities(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const filters = {
      genre: url.searchParams.getAll('genre'),
      format: url.searchParams.getAll('format'),
      production_stage: url.searchParams.getAll('production_stage'),
      budget_range: {
        min: parseInt(url.searchParams.get('min_budget') || '0'),
        max: parseInt(url.searchParams.get('max_budget') || '50000000')
      },
      location: url.searchParams.get('location') || undefined,
      seeking_production: url.searchParams.get('seeking_production') === 'true',
      available_rights: url.searchParams.getAll('available_rights'),
      limit: parseInt(url.searchParams.get('limit') || '20'),
      offset: parseInt(url.searchParams.get('offset') || '0')
    };

    return this.productionWorkflow.getProductionOpportunities(request, filters);
  }

  /**
   * POST /api/production/express-interest - Express production interest
   */
  @requirePortalAccess('production')
  async expressProductionInterest(request: Request): Promise<Response> {
    const body = await request.json() as Record<string, unknown>;
    const { pitch_id, deal_type, offer_amount, option_period, proposed_rights, production_timeline, message } = body;

    if (!pitch_id || !deal_type || !offer_amount) {
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'pitch_id, deal_type, and offer_amount are required' }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }

    return this.productionWorkflow.expressProductionInterest(request, pitch_id as number, {
      deal_type: deal_type as any,
      offer_amount: offer_amount as number,
      option_period: option_period !== undefined ? String(option_period) : undefined,
      proposed_rights: (proposed_rights || {}) as Record<string, unknown>,
      production_timeline: production_timeline as string | undefined,
      message: message as string | undefined
    });
  }

  /**
   * GET /api/production/deals - Production deals dashboard
   */
  @requirePortalAccess('production')
  async getProductionDeals(request: Request): Promise<Response> {
    return this.productionWorkflow.getProductionDealDashboard(request, 'production');
  }

  // ================================================================================
  // SHARED NDA ENDPOINTS (with portal-specific access)
  // ================================================================================

  /**
   * POST /api/nda/request - Create NDA request (investors/production)
   */
  async requestNDA(request: Request): Promise<Response> {
    const user = (request as any).user;
    const userType = user.userType || user.user_type;
    
    // Validate user can request NDAs
    if (!['investor', 'production'].includes(userType)) {
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only investors and production companies can request NDAs' }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }

    const body = await request.json() as Record<string, unknown>;
    const { pitch_id, template_name = 'basic_investor', custom_terms } = body;

    return this.ndaStateMachine.createNDARequest(request, pitch_id as number, template_name as string, custom_terms);
  }

  /**
   * POST /api/nda/{id}/sign - Sign NDA (investors/production)
   */
  async signNDA(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ndaId = parseInt(url.pathname.split('/')[3]);
    const body = await request.json() as {
      full_name: string;
      title?: string;
      company?: string;
      date: string;
      signature: string;
      terms_accepted: boolean;
      ip_address?: string;
      user_agent?: string;
    };

    return this.ndaStateMachine.signNDA(request, ndaId, body);
  }

  /**
   * POST /api/nda/{id}/approve - Approve/reject NDA (creators)
   */
  async processNDA(request: Request): Promise<Response> {
    const user = (request as any).user;
    if ((user.userType || user.user_type) !== 'creator') {
      const origin = request.headers.get('Origin');
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only creators can approve/reject NDAs' }
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      });
    }

    const url = new URL(request.url);
    const ndaId = parseInt(url.pathname.split('/')[3]);
    const body = await request.json() as Record<string, unknown>;
    const { decision, reason } = body;

    return this.ndaStateMachine.processNDADecision(request, ndaId, decision as 'approve' | 'reject', reason as string | undefined);
  }

  /**
   * GET /api/nda/check-access/{pitch_id} - Check NDA access status
   */
  async checkNDAAccess(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pitchId = parseInt(url.pathname.split('/')[4]);
    
    return this.ndaStateMachine.checkNDAAccess(request, pitchId);
  }

  // ================================================================================
  // PRIVATE HELPER METHODS
  // ================================================================================

  private getSettledValue<T>(result: PromiseSettledResult<T>, defaultValue: T): T {
    return result.status === 'fulfilled' ? result.value : defaultValue;
  }

  private async getCreatorPitchesOverview(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as total_pitches,
        COUNT(*) FILTER (WHERE status = 'published') as published_pitches,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_pitches,
        COALESCE(SUM(view_count), 0) as total_views,
        COALESCE(SUM(like_count), 0) as total_likes,
        COUNT(*) FILTER (WHERE seeking_investment = true) as seeking_investment,
        COUNT(*) FILTER (WHERE seeking_production = true) as seeking_production
      FROM pitches 
      WHERE user_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getCreatorInvestmentDeals(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE deal_state NOT IN ('completed', 'cancelled')) as active_deals,
        COUNT(*) FILTER (WHERE deal_state = 'completed') as completed_deals,
        COALESCE(SUM(investment_amount), 0) as total_investment_amount,
        COUNT(DISTINCT investor_id) as unique_investors
      FROM investment_deals
      WHERE creator_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getCreatorProductionDeals(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE deal_state NOT IN ('completed', 'cancelled')) as active_deals,
        COUNT(*) FILTER (WHERE deal_state = 'completed') as completed_deals,
        COALESCE(SUM(option_amount), 0) as total_option_amount,
        COALESCE(SUM(purchase_price), 0) as total_purchase_amount,
        COUNT(DISTINCT production_company_id) as unique_production_companies
      FROM production_deals
      WHERE creator_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getCreatorNDARequests(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as total_ndas,
        COUNT(*) FILTER (WHERE nda_state = 'pending') as pending_ndas,
        COUNT(*) FILTER (WHERE nda_state = 'signed') as signed_ndas,
        COUNT(*) FILTER (WHERE nda_state = 'approved') as approved_ndas,
        COUNT(*) FILTER (WHERE nda_state = 'rejected') as rejected_ndas
      FROM enhanced_ndas
      WHERE creator_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getCreatorRecentActivity(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        'investment_deal' as activity_type,
        d.deal_state as status,
        d.updated_at as activity_date,
        p.title as pitch_title,
        u.username as other_party,
        d.investment_amount as amount
      FROM investment_deals d
      JOIN pitches p ON d.pitch_id = p.id
      JOIN users u ON d.investor_id = u.id
      WHERE d.creator_id = ${userId}
      
      UNION ALL
      
      SELECT 
        'production_deal' as activity_type,
        pd.deal_state as status,
        pd.updated_at as activity_date,
        p.title as pitch_title,
        u.company_name as other_party,
        pd.option_amount as amount
      FROM production_deals pd
      JOIN pitches p ON pd.pitch_id = p.id
      JOIN users u ON pd.production_company_id = u.id
      WHERE pd.creator_id = ${userId}
      
      UNION ALL
      
      SELECT 
        'nda_request' as activity_type,
        n.nda_state as status,
        n.updated_at as activity_date,
        p.title as pitch_title,
        u.username as other_party,
        NULL as amount
      FROM enhanced_ndas n
      JOIN pitches p ON n.pitch_id = p.id
      JOIN users u ON n.requester_id = u.id
      WHERE n.creator_id = ${userId}
      
      ORDER BY activity_date DESC
      LIMIT 20
    `;
  }

  private async getCreatorRevenueMetrics(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COALESCE(SUM(i.investment_amount), 0) as total_investment_revenue,
        COALESCE(SUM(pd.option_amount), 0) as total_option_revenue,
        COALESCE(SUM(pd.purchase_price), 0) as total_purchase_revenue,
        COUNT(DISTINCT i.investor_id) as unique_investors,
        COUNT(DISTINCT pd.production_company_id) as unique_production_partners,
        COALESCE(AVG(i.investment_amount), 0) as avg_investment_size,
        COALESCE(AVG(pd.option_amount), 0) as avg_option_size
      FROM pitches p
      LEFT JOIN investment_deals i ON p.id = i.pitch_id AND i.deal_state = 'completed'
      LEFT JOIN production_deals pd ON p.id = pd.pitch_id AND pd.deal_state = 'completed'
      WHERE p.user_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getCreatorAnalytics(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(DISTINCT pv.viewer_id) as unique_viewers,
        COALESCE(SUM(pv.view_duration), 0) as total_view_time,
        COALESCE(AVG(pv.scroll_depth), 0) as avg_engagement,
        COUNT(pv.id) FILTER (WHERE pv.clicked_watch_this = true) as watch_clicks,
        COUNT(DISTINCT DATE(pv.viewed_at)) as active_days
      FROM pitches p
      LEFT JOIN pitch_views pv ON p.id = pv.pitch_id
      WHERE p.user_id = ${userId}
      AND pv.viewed_at > now() - interval '30 days'
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getDetailedRevenueMetrics(userId: number): Promise<any> {
    const [monthlyRevenue, revenueBreakdown, projectedRevenue] = await Promise.all([
      this.db`
        SELECT 
          DATE_TRUNC('month', completed_at) as month,
          SUM(COALESCE(investment_amount, option_amount, purchase_price)) as revenue
        FROM (
          SELECT completed_at, investment_amount, NULL as option_amount, NULL as purchase_price
          FROM investment_deals i
          JOIN pitches p ON i.pitch_id = p.id
          WHERE p.user_id = ${userId} AND i.deal_state = 'completed'
          
          UNION ALL
          
          SELECT updated_at as completed_at, NULL as investment_amount, option_amount, purchase_price
          FROM production_deals pd
          JOIN pitches p ON pd.pitch_id = p.id
          WHERE p.user_id = ${userId} AND pd.deal_state = 'completed'
        ) combined_revenue
        WHERE completed_at > now() - interval '12 months'
        GROUP BY month
        ORDER BY month
      `,
      this.db`
        SELECT 
          'investment' as source,
          COUNT(*) as deal_count,
          SUM(investment_amount) as total_amount,
          AVG(investment_amount) as avg_amount
        FROM investment_deals i
        JOIN pitches p ON i.pitch_id = p.id
        WHERE p.user_id = ${userId} AND i.deal_state = 'completed'
        
        UNION ALL
        
        SELECT 
          'production' as source,
          COUNT(*) as deal_count,
          SUM(COALESCE(purchase_price, option_amount)) as total_amount,
          AVG(COALESCE(purchase_price, option_amount)) as avg_amount
        FROM production_deals pd
        JOIN pitches p ON pd.pitch_id = p.id
        WHERE p.user_id = ${userId} AND pd.deal_state = 'completed'
      `,
      this.db`
        SELECT 
          SUM(COALESCE(investment_amount, option_amount)) as pipeline_value,
          COUNT(*) as active_negotiations
        FROM (
          SELECT investment_amount, NULL as option_amount
          FROM investment_deals i
          JOIN pitches p ON i.pitch_id = p.id
          WHERE p.user_id = ${userId} 
          AND i.deal_state IN ('negotiation', 'term_sheet', 'legal_review')
          
          UNION ALL
          
          SELECT NULL as investment_amount, option_amount
          FROM production_deals pd
          JOIN pitches p ON pd.pitch_id = p.id
          WHERE p.user_id = ${userId}
          AND pd.deal_state IN ('negotiation', 'term_sheet', 'legal_review')
        ) pipeline
      `.then((result: Record<string, unknown>[]) => result[0] || {})
    ]);

    return {
      monthly_revenue: monthlyRevenue,
      revenue_breakdown: revenueBreakdown,
      projected: projectedRevenue
    };
  }

  // Similar helper methods for investor and production portals would follow...
  // Implementation continues with investor and production specific data fetchers

  private async getInvestorPortfolioOverview(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as total_investments,
        COUNT(*) FILTER (WHERE deal_state = 'completed') as completed_investments,
        COUNT(*) FILTER (WHERE deal_state NOT IN ('completed', 'cancelled')) as active_investments,
        COALESCE(SUM(investment_amount), 0) as total_invested,
        COALESCE(AVG(investment_amount), 0) as avg_investment,
        COUNT(DISTINCT pitch_id) as unique_projects
      FROM investment_deals 
      WHERE investor_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getInvestorOpportunities(userId: number): Promise<any> {
    return await this.db`
      SELECT COUNT(*) as available_opportunities
      FROM pitches p
      WHERE p.status = 'published' 
      AND p.seeking_investment = true
      AND NOT EXISTS (
        SELECT 1 FROM investment_deals i 
        WHERE i.pitch_id = p.id AND i.investor_id = ${userId}
      )
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getInvestorActiveDeals(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        deal_state,
        COUNT(*) as count,
        SUM(investment_amount) as total_amount
      FROM investment_deals 
      WHERE investor_id = ${userId}
      AND deal_state NOT IN ('completed', 'cancelled')
      GROUP BY deal_state
    `;
  }

  private async getInvestorNDAStatus(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as total_ndas,
        COUNT(*) FILTER (WHERE nda_state = 'approved') as approved_ndas,
        COUNT(*) FILTER (WHERE nda_state = 'pending') as pending_ndas
      FROM enhanced_ndas 
      WHERE requester_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getInvestorSavedPitches(userId: number): Promise<any> {
    return await this.db`
      SELECT COUNT(*) as saved_count
      FROM saved_pitches 
      WHERE user_id = ${userId}
    `.then((result: Record<string, unknown>[]) => (result[0] as Record<string, unknown>)?.saved_count || 0);
  }

  private async getInvestorPerformanceMetrics(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) FILTER (WHERE deal_state = 'completed') as successful_deals,
        COUNT(*) FILTER (WHERE deal_state = 'cancelled') as cancelled_deals,
        COALESCE(AVG(EXTRACT(EPOCH FROM (state_changed_at - created_at)) / 86400), 0) as avg_deal_duration_days
      FROM investment_deals 
      WHERE investor_id = ${userId}
      AND deal_state IN ('completed', 'cancelled')
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  // Production company helper methods
  private async getProductionPipelineOverview(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as total_deals,
        COUNT(*) FILTER (WHERE deal_state = 'completed') as completed_deals,
        COUNT(*) FILTER (WHERE deal_state NOT IN ('completed', 'cancelled')) as active_deals,
        COALESCE(SUM(option_amount), 0) as total_options,
        COALESCE(SUM(purchase_price), 0) as total_purchases,
        COUNT(DISTINCT pitch_id) as unique_projects
      FROM production_deals 
      WHERE production_company_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getProductionActiveDeals(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        deal_type,
        deal_state,
        COUNT(*) as count,
        SUM(COALESCE(purchase_price, option_amount)) as total_amount
      FROM production_deals 
      WHERE production_company_id = ${userId}
      AND deal_state NOT IN ('completed', 'cancelled')
      GROUP BY deal_type, deal_state
    `;
  }

  private async getProductionTalentSearch(userId: number): Promise<any> {
    return { talent_searches: 0, saved_talent: 0 }; // Placeholder
  }

  private async getProductionProjectsInDevelopment(userId: number): Promise<any> {
    return await this.db`
      SELECT 
        COUNT(*) as projects_in_development,
        COUNT(*) FILTER (WHERE deal_type = 'development') as development_deals,
        COUNT(*) FILTER (WHERE deal_type = 'production') as production_deals
      FROM production_deals 
      WHERE production_company_id = ${userId}
      AND deal_state IN ('legal_review', 'funding', 'completed')
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  private async getProductionPerformanceMetrics(userId: number): Promise<any> {
    return await this.db`
      SELECT
        COUNT(*) FILTER (WHERE deal_state = 'completed') as successful_deals,
        COUNT(*) FILTER (WHERE deal_state = 'cancelled') as cancelled_deals,
        COALESCE(AVG(EXTRACT(EPOCH FROM (state_changed_at - created_at)) / 86400), 0) as avg_deal_duration_days,
        COUNT(DISTINCT deal_type) as deal_types_used
      FROM production_deals
      WHERE production_company_id = ${userId}
      AND deal_state IN ('completed', 'cancelled')
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }

  // Private helper method for production opportunities by userId (used in dashboard)
  private async getProductionOpportunitiesForUser(userId: number): Promise<any> {
    return await this.db`
      SELECT
        COUNT(*) as total_opportunities,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'reviewing') as under_review
      FROM production_deals
      WHERE production_company_id = ${userId}
    `.then((result: Record<string, unknown>[]) => result[0] || {});
  }
}

// Class is already exported via 'export class' declaration above