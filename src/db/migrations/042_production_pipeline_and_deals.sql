-- Migration 042: Production Pipeline and Deals tables
-- Creates production_pipeline (INTEGER PKs) for dashboard/sidebar handlers,
-- production_deals, project_milestones, distribution_channels, location_bookings

-- 1. production_pipeline — referenced by production-dashboard.ts and production-sidebar.ts
CREATE TABLE IF NOT EXISTS production_pipeline (
  id SERIAL PRIMARY KEY,
  production_company_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
  title VARCHAR(255),
  stage VARCHAR(50) DEFAULT 'development' CHECK (stage IN ('development', 'pre-production', 'production', 'post-production', 'delivery', 'release')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  budget_allocated DECIMAL(14, 2) DEFAULT 0,
  budget_spent DECIMAL(14, 2) DEFAULT 0,
  budget_remaining DECIMAL(14, 2) DEFAULT 0,
  contingency_percentage DECIMAL(5, 2) DEFAULT 10,
  contingency_used DECIMAL(14, 2) DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  next_milestone VARCHAR(255),
  milestone_date DATE,
  start_date DATE,
  target_completion_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_company ON production_pipeline(production_company_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_pitch ON production_pipeline(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON production_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_status ON production_pipeline(status);

-- 2. production_deals — already exists from earlier migration (production_company_id, deal_state, etc.)
--    Indexes only (table creation skipped)
CREATE INDEX IF NOT EXISTS idx_deals_company ON production_deals(production_company_id);
CREATE INDEX IF NOT EXISTS idx_deals_creator ON production_deals(creator_id);
CREATE INDEX IF NOT EXISTS idx_deals_pitch ON production_deals(pitch_id);

-- 3. project_milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES production_pipeline(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id);

-- 4. distribution_channels
CREATE TABLE IF NOT EXISTS distribution_channels (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES production_pipeline(id) ON DELETE CASCADE,
  platform VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'negotiating', 'confirmed', 'active', 'completed')),
  terms TEXT,
  revenue DECIMAL(14, 2) DEFAULT 0,
  release_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribution_project ON distribution_channels(project_id);

-- 5. location_bookings
CREATE TABLE IF NOT EXISTS location_bookings (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES location_scouts(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES production_pipeline(id) ON DELETE CASCADE,
  booked_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  total_cost DECIMAL(14, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_location ON location_bookings(location_id);
CREATE INDEX IF NOT EXISTS idx_bookings_project ON location_bookings(project_id);
