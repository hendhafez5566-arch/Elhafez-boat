BEGIN;
-- Add operational evidence to the existing queue; never create another dispatch path.
ALTER TABLE chatbot_integration_jobs ADD COLUMN reconciliation_decision text CHECK(reconciliation_decision IN ('DELIVERED','NOT_DELIVERED'));
ALTER TABLE chatbot_integration_jobs ADD COLUMN reconciled_by uuid REFERENCES users(id);
ALTER TABLE chatbot_integration_jobs ADD COLUMN reconciled_at timestamptz;
ALTER TABLE chatbot_integration_jobs ADD CONSTRAINT integration_reconciliation_evidence CHECK(
 (reconciliation_decision IS NULL AND reconciled_by IS NULL AND reconciled_at IS NULL) OR
 (reconciliation_decision IS NOT NULL AND reconciled_by IS NOT NULL AND reconciled_at IS NOT NULL)
);
COMMIT;
