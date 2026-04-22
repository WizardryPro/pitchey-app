/**
 * Investment-related database queries using raw SQL
 * Replaces Drizzle ORM with parameterized Neon queries
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany, DatabaseError, withTransaction } from './base';

// Type definitions
export interface Investment {
  id: string;
  pitch_id: string;
  investor_id: string;
  amount: number;
  currency: string;
  investment_type: 'equity' | 'debt' | 'revenue_share' | 'convertible_note' | 'other';
  status: 'pending' | 'committed' | 'funded' | 'cancelled' | 'refunded';
  equity_percentage?: number;
  valuation?: number;
  terms?: string;
  notes?: string;
  committed_at?: Date;
  funded_at?: Date;
  cancelled_at?: Date;
  refunded_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface InvestmentInterest {
  id: string;
  pitch_id: string;
  investor_id: string;
  interest_level: 'low' | 'medium' | 'high' | 'very_high';
  investment_range_min?: number;
  investment_range_max?: number;
  notes?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InvestmentDocument {
  id: string;
  investment_id: string;
  document_type: 'term_sheet' | 'agreement' | 'wire_confirmation' | 'other';
  document_name: string;
  document_url: string;
  uploaded_by_id: string;
  is_signed: boolean;
  signed_at?: Date;
  created_at: Date;
}

export interface CreateInvestmentInput {
  pitch_id: string;
  investor_id: string;
  amount: number;
  currency?: string;
  investment_type: Investment['investment_type'];
  equity_percentage?: number;
  valuation?: number;
  terms?: string;
  notes?: string;
}

export interface InvestmentFilters {
  investor_id?: string;
  pitch_id?: string;
  status?: Investment['status'];
  investment_type?: Investment['investment_type'];
  min_amount?: number;
  max_amount?: number;
  start_date?: Date;
  end_date?: Date;
}

// Core investment queries
export async function createInvestment(
  sql: SqlQuery,
  input: CreateInvestmentInput
): Promise<Investment> {
  return await withTransaction(sql, async (txSql) => {
    // Create investment
    const result = await txSql`
      INSERT INTO investments (
        pitch_id, investor_id, amount, currency,
        investment_type, status,
        equity_percentage, valuation,
        terms, notes, metadata,
        created_at, updated_at
      ) VALUES (
        ${input.pitch_id}, ${input.investor_id}, 
        ${input.amount}, ${input.currency || 'USD'},
        ${input.investment_type}, 'pending',
        ${input.equity_percentage || null}, ${input.valuation || null},
        ${input.terms || null}, ${input.notes || null}, 
        '{}'::jsonb,
        NOW(), NOW()
      )
      RETURNING *
    `;
    
    const investment = extractFirst<Investment>(result);
    if (!investment) {
      throw new DatabaseError('Failed to create investment');
    }

    // Update pitch investment count
    await txSql`
      UPDATE pitches 
      SET 
        investment_count = investment_count + 1,
        updated_at = NOW()
      WHERE id = ${input.pitch_id}
    `;

    // Create notification for creator
    await txSql`
      INSERT INTO notifications (
        user_id, type, title, message,
        related_pitch_id, related_user_id,
        priority, created_at
      )
      SELECT 
        p.creator_id,
        'investment_received',
        'New Investment Interest',
        'An investor has shown interest in your pitch',
        ${input.pitch_id}, ${input.investor_id},
        'high', NOW()
      FROM pitches p
      WHERE p.id = ${input.pitch_id}
    `;

    return investment;
  });
}

export async function getInvestmentById(
  sql: SqlQuery,
  investmentId: string
): Promise<Investment | null> {
  const result = await sql`
    SELECT 
      i.*,
      p.title as pitch_title,
      u.username as investor_username,
      u.company_name as investor_company
    FROM investments i
    LEFT JOIN pitches p ON i.pitch_id = p.id
    LEFT JOIN users u ON i.investor_id = u.id
    WHERE i.id = ${investmentId}
  `;
  return extractFirst<Investment>(result);
}

export async function updateInvestmentStatus(
  sql: SqlQuery,
  investmentId: string,
  status: Investment['status'],
  userId: string
): Promise<Investment | null> {
  const statusTimestamp = ({
    'committed': 'committed_at',
    'funded': 'funded_at',
    'cancelled': 'cancelled_at',
    'refunded': 'refunded_at'
  } as Record<string, string>)[status];

  const query = statusTimestamp 
    ? `
      UPDATE investments 
      SET 
        status = $1,
        ${statusTimestamp} = NOW(),
        updated_at = NOW()
      WHERE id = $2 
        AND (investor_id = $3 OR EXISTS (
          SELECT 1 FROM pitches p 
          WHERE p.id = pitch_id AND p.creator_id = $3
        ))
      RETURNING *
    `
    : `
      UPDATE investments 
      SET 
        status = $1,
        updated_at = NOW()
      WHERE id = $2 
        AND (investor_id = $3 OR EXISTS (
          SELECT 1 FROM pitches p 
          WHERE p.id = pitch_id AND p.creator_id = $3
        ))
      RETURNING *
    `;

  const result = await sql.query(query, [status, investmentId, userId]);
  return extractFirst<Investment>(result);
}

// Investor portfolio queries
export async function getInvestorPortfolio(
  sql: SqlQuery,
  investorId: string,
  filters?: InvestmentFilters
): Promise<Investment[]> {
  const wb = new WhereBuilder();
  wb.add('i.investor_id = $param', investorId);
  wb.addOptional('i.status', '=', filters?.status);
  wb.addOptional('i.investment_type', '=', filters?.investment_type);
  wb.addOptional('i.amount', '>=', filters?.min_amount);
  wb.addOptional('i.amount', '<=', filters?.max_amount);
  wb.addOptional('i.created_at', '>=', filters?.start_date);
  wb.addOptional('i.created_at', '<=', filters?.end_date);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      i.*,
      p.title as pitch_title,
      p.genre as pitch_genre,
      p.format as pitch_format,
      p.status as pitch_status,
      u.username as creator_username,
      u.company_name as creator_company
    FROM investments i
    JOIN pitches p ON i.pitch_id = p.id
    JOIN users u ON p.creator_id = u.id
    ${where}
    ORDER BY i.created_at DESC
  `;
  
  const result = await sql.query(query, params);
  return extractMany<Investment>(result);
}

export async function getInvestorStats(
  sql: SqlQuery,
  investorId: string
): Promise<{
  totalInvested: number;
  activeInvestments: number;
  committedAmount: number;
  fundedAmount: number;
  averageInvestment: number;
  portfolioValue: number;
  roi: number;
}> {
  const result = await sql`
    SELECT 
      COUNT(*)::int as total_investments,
      COUNT(CASE WHEN status IN ('committed', 'funded') THEN 1 END)::int as active_investments,
      COALESCE(SUM(CASE WHEN status = 'committed' THEN amount END), 0) as committed_amount,
      COALESCE(SUM(CASE WHEN status = 'funded' THEN amount END), 0) as funded_amount,
      COALESCE(AVG(amount), 0) as average_investment,
      COALESCE(SUM(
        CASE 
          WHEN status = 'funded' AND valuation > 0 AND equity_percentage > 0
          THEN (valuation * equity_percentage / 100)
          ELSE amount 
        END
      ), 0) as portfolio_value
    FROM investments
    WHERE investor_id = ${investorId}
  `;
  
  const stats = extractFirst<any>(result) || {};
  const fundedAmount = Number(stats.funded_amount || 0);
  const portfolioValue = Number(stats.portfolio_value || 0);
  
  return {
    totalInvested: Number(stats.funded_amount || 0),
    activeInvestments: Number(stats.active_investments || 0),
    committedAmount: Number(stats.committed_amount || 0),
    fundedAmount,
    averageInvestment: Number(stats.average_investment || 0),
    portfolioValue,
    roi: fundedAmount > 0 ? ((portfolioValue - fundedAmount) / fundedAmount) * 100 : 0
  };
}

// Pitch investment queries
export async function getPitchInvestments(
  sql: SqlQuery,
  pitchId: string,
  status?: Investment['status']
): Promise<Investment[]> {
  const wb = new WhereBuilder();
  wb.add('i.pitch_id = $param', pitchId);
  wb.addOptional('i.status', '=', status);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      i.*,
      u.username as investor_username,
      u.company_name as investor_company,
      u.profile_image as investor_avatar
    FROM investments i
    JOIN users u ON i.investor_id = u.id
    ${where}
    ORDER BY i.amount DESC, i.created_at DESC
  `;
  
  const result = await sql.query(query, params);
  return extractMany<Investment>(result);
}

export async function getPitchInvestmentStats(
  sql: SqlQuery,
  pitchId: string
): Promise<{
  totalRaised: number;
  committedAmount: number;
  investorCount: number;
  averageInvestment: number;
  largestInvestment: number;
  targetAmount?: number;
  percentageRaised: number;
}> {
  const result = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'funded' THEN amount END), 0) as total_raised,
      COALESCE(SUM(CASE WHEN status IN ('committed', 'funded') THEN amount END), 0) as committed_amount,
      COUNT(DISTINCT investor_id)::int as investor_count,
      COALESCE(AVG(amount), 0) as average_investment,
      COALESCE(MAX(amount), 0) as largest_investment,
      p.target_funding_amount as target_amount
    FROM investments i
    JOIN pitches p ON i.pitch_id = p.id
    WHERE i.pitch_id = ${pitchId}
      AND i.status NOT IN ('cancelled', 'refunded')
    GROUP BY p.target_funding_amount
  `;
  
  const stats = extractFirst<any>(result) || {};
  const totalRaised = Number(stats.total_raised || 0);
  const targetAmount = Number(stats.target_amount || 0);
  
  return {
    totalRaised,
    committedAmount: Number(stats.committed_amount || 0),
    investorCount: Number(stats.investor_count || 0),
    averageInvestment: Number(stats.average_investment || 0),
    largestInvestment: Number(stats.largest_investment || 0),
    targetAmount: targetAmount || undefined,
    percentageRaised: targetAmount > 0 ? (totalRaised / targetAmount) * 100 : 0
  };
}

// Investment interest tracking
export async function createInvestmentInterest(
  sql: SqlQuery,
  pitchId: string,
  investorId: string,
  interestLevel: InvestmentInterest['interest_level'],
  rangeMin?: number,
  rangeMax?: number,
  notes?: string
): Promise<InvestmentInterest> {
  const result = await sql`
    INSERT INTO investment_interests (
      pitch_id, investor_id, interest_level,
      investment_range_min, investment_range_max,
      notes, is_active,
      created_at, updated_at
    ) VALUES (
      ${pitchId}, ${investorId}, ${interestLevel},
      ${rangeMin || null}, ${rangeMax || null},
      ${notes || null}, true,
      NOW(), NOW()
    )
    ON CONFLICT (pitch_id, investor_id) 
    DO UPDATE SET
      interest_level = EXCLUDED.interest_level,
      investment_range_min = EXCLUDED.investment_range_min,
      investment_range_max = EXCLUDED.investment_range_max,
      notes = EXCLUDED.notes,
      is_active = true,
      updated_at = NOW()
    RETURNING *
  `;
  
  const interest = extractFirst<InvestmentInterest>(result);
  if (!interest) {
    throw new DatabaseError('Failed to create investment interest');
  }
  return interest;
}

export async function getInvestmentInterests(
  sql: SqlQuery,
  filters: {
    pitch_id?: string;
    investor_id?: string;
    interest_level?: InvestmentInterest['interest_level'];
    is_active?: boolean;
  }
): Promise<InvestmentInterest[]> {
  const wb = new WhereBuilder();
  wb.addOptional('ii.pitch_id', '=', filters.pitch_id);
  wb.addOptional('ii.investor_id', '=', filters.investor_id);
  wb.addOptional('ii.interest_level', '=', filters.interest_level);
  wb.addOptional('ii.is_active', '=', filters.is_active);
  
  const { where, params } = wb.build();
  
  const query = `
    SELECT 
      ii.*,
      p.title as pitch_title,
      u.username as investor_username,
      u.company_name as investor_company
    FROM investment_interests ii
    LEFT JOIN pitches p ON ii.pitch_id = p.id
    LEFT JOIN users u ON ii.investor_id = u.id
    ${where}
    ORDER BY 
      CASE ii.interest_level
        WHEN 'very_high' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      ii.created_at DESC
  `;
  
  const result = await sql.query(query, params);
  return extractMany<InvestmentInterest>(result);
}

// Investment documents
export async function addInvestmentDocument(
  sql: SqlQuery,
  investmentId: string,
  document: {
    document_type: InvestmentDocument['document_type'];
    document_name: string;
    document_url: string;
    uploaded_by_id: string;
  }
): Promise<InvestmentDocument> {
  const result = await sql`
    INSERT INTO investment_documents (
      investment_id, document_type,
      document_name, document_url,
      uploaded_by_id, is_signed,
      created_at
    ) VALUES (
      ${investmentId}, ${document.document_type},
      ${document.document_name}, ${document.document_url},
      ${document.uploaded_by_id}, false,
      NOW()
    )
    RETURNING *
  `;
  
  const doc = extractFirst<InvestmentDocument>(result);
  if (!doc) {
    throw new DatabaseError('Failed to add investment document');
  }
  return doc;
}

export async function getInvestmentDocuments(
  sql: SqlQuery,
  investmentId: string
): Promise<InvestmentDocument[]> {
  const result = await sql`
    SELECT 
      id.*,
      u.username as uploaded_by_username
    FROM investment_documents id
    LEFT JOIN users u ON id.uploaded_by_id = u.id
    WHERE id.investment_id = ${investmentId}
    ORDER BY id.created_at DESC
  `;
  return extractMany<InvestmentDocument>(result);
}

export async function markDocumentSigned(
  sql: SqlQuery,
  documentId: string,
  userId: string
): Promise<boolean> {
  const result = await sql`
    UPDATE investment_documents
    SET 
      is_signed = true,
      signed_at = NOW()
    WHERE id = ${documentId}
      AND EXISTS (
        SELECT 1 FROM investments i
        WHERE i.id = investment_id
          AND (i.investor_id = ${userId} OR EXISTS (
            SELECT 1 FROM pitches p 
            WHERE p.id = i.pitch_id AND p.creator_id = ${userId}
          ))
      )
    RETURNING id
  `;
  return result.length > 0;
}

// Analytics
export async function getInvestmentTrends(
  sql: SqlQuery,
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month' = 'month'
): Promise<Array<{
  period: string;
  total_amount: number;
  investment_count: number;
  investor_count: number;
}>> {
  const dateFormat = {
    'day': 'YYYY-MM-DD',
    'week': 'YYYY-WW',
    'month': 'YYYY-MM'
  }[groupBy];

  const result = await sql`
    SELECT 
      TO_CHAR(created_at, ${dateFormat}) as period,
      SUM(amount) as total_amount,
      COUNT(*) as investment_count,
      COUNT(DISTINCT investor_id) as investor_count
    FROM investments
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
      AND status IN ('committed', 'funded')
    GROUP BY period
    ORDER BY period ASC
  `;
  
  return extractMany<any>(result);
}