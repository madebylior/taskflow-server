import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const storage = process.env.DB_STORAGE || './data/taskflow.sqlite';
if (storage !== ':memory:') mkdirSync(dirname(resolve(storage)), { recursive: true });

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: false,
});
