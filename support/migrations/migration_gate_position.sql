-- Add gate_position column to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS gate_position INTEGER DEFAULT 0;

-- Comment for clarity: 
-- gate_position = 0 means no gate (all slots are considered same)
-- gate_position = N means slots 1..N are INSIDE (Depot), slots N+1..M are OUTSIDE (Street)
