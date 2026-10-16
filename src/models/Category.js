import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(60), allowNull: false, validate: { notEmpty: true, len: [2, 60] } },
  userId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'categories',
  timestamps: true,
  indexes: [{ unique: true, fields: ['userId', 'name'] }],
});
