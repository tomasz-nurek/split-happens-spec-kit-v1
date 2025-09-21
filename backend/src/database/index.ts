import knex from 'knex';
import { Knex } from 'knex';

const knexConfig = require('../../knexfile.js');

// Create a singleton knex instance
const db: Knex = knex(knexConfig[process.env.NODE_ENV || 'test']);

export default db;