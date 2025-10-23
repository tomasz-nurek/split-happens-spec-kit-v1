/**
 * Migration: Add group_id to activity_log for efficient group-scoped queries
 * 
 * Performance improvement: Denormalize group_id to avoid fetching all expense 
 * activities and filtering in memory (O(n) → O(log n) with index).
 */

exports.up = async function(knex) {
  await knex.schema.table('activity_log', (table) => {
    // Add nullable group_id column for efficient filtering
    table.integer('group_id').unsigned().nullable();
    
    // Add index for fast lookups by group_id
    table.index('group_id');
    
    // Add composite index for common query pattern (group_id + created_at DESC)
    table.index(['group_id', 'created_at']);
  });

  // Backfill group_id for existing expense activities
  // Parse the details JSON to extract groupId and update records
  const expenseActivities = await knex('activity_log')
    .where('entity_type', 'expense')
    .select('*');

  for (const activity of expenseActivities) {
    if (activity.details) {
      try {
        const details = JSON.parse(activity.details);
        if (details.groupId) {
          await knex('activity_log')
            .where('id', activity.id)
            .update({ group_id: details.groupId });
        }
      } catch (err) {
        // Skip invalid JSON
        console.warn(`Could not parse details for activity ${activity.id}`);
      }
    }
  }

  // Backfill group_id for group entity activities
  await knex.raw(`
    UPDATE activity_log 
    SET group_id = entity_id 
    WHERE entity_type = 'group'
  `);
};

exports.down = async function(knex) {
  await knex.schema.table('activity_log', (table) => {
    table.dropIndex(['group_id', 'created_at']);
    table.dropIndex('group_id');
    table.dropColumn('group_id');
  });
};
