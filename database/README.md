# Database

`init/001-event-planner.sql` bootstraps the existing EventPlanner schema for a
fresh local MySQL volume.

The current schema supports users, events, attendees, and tasks. Marketplace
tables will be added through versioned, backward-compatible migrations. Do not
use destructive startup scripts for production; production migrations will run
as an explicit deployment step.
