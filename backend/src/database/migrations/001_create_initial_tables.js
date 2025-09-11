exports.up = async function(knex) {
  // Users table (not auth users, just people in expenses)
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Groups
  await knex.schema.createTable('groups', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Group membership
  await knex.schema.createTable('group_members', (table) => {
    table.integer('group_id').unsigned().references('id').inTable('groups').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.primary(['group_id', 'user_id']);
  });

  // Expenses
  await knex.schema.createTable('expenses', (table) => {
    table.increments('id').primary();
    table.integer('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.string('description').notNullable();
    table.integer('paid_by').unsigned().notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Who participates in each expense
  await knex.schema.createTable('expense_splits', (table) => {
    table.integer('expense_id').unsigned().references('id').inTable('expenses').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users');
    table.decimal('amount', 10, 2).notNullable();
    table.primary(['expense_id', 'user_id']);
  });

  // Activity log
  await knex.schema.createTable('activity_log', (table) => {
    table.increments('id').primary();
    table.string('action').notNullable(); // 'CREATE', 'DELETE'
    table.string('entity_type').notNullable(); // 'expense', 'user', 'group'
    table.integer('entity_id');
    table.text('details');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('activity_log');
  await knex.schema.dropTableIfExists('expense_splits');
  await knex.schema.dropTableIfExists('expenses');
  await knex.schema.dropTableIfExists('group_members');
  await knex.schema.dropTableIfExists('groups');
  await knex.schema.dropTableIfExists('users');
};
