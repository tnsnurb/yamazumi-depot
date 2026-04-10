-- Optimization for checklist item counting
-- 1. Add indices for faster joining and filtering
CREATE INDEX IF NOT EXISTS idx_checklist_instance_items_instance_id ON checklist_instance_items(instance_id);
CREATE INDEX IF NOT EXISTS idx_checklist_instance_items_is_completed ON checklist_instance_items(is_completed);

-- 2. Create a view for pre-calculated progress
-- This allows the backend to fetch total/completed counts in a single query
CREATE OR REPLACE VIEW view_active_checklist_progress AS
SELECT 
    ci.id as instance_id,
    count(cii.id) as total_items,
    count(cii.id) FILTER (WHERE cii.is_completed = true) as completed_items
FROM checklist_instances ci
LEFT JOIN checklist_instance_items cii ON ci.id = cii.instance_id
WHERE ci.status != 'completed'
GROUP BY ci.id;
