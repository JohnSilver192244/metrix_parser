-- Story 1.2 bootstrap migration
-- Purpose: establish a safe starting point for schema evolution and lock in
-- naming conventions before domain tables are introduced.

create schema if not exists app_public;

comment on schema app_public is
  'Primary application schema. Use snake_case for all future tables and columns.';
