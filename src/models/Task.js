import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Task = sequelize.define('Task', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(120), allowNull: false, validate: { notEmpty: true, len: [2, 120] } },
  description: { type: DataTypes.TEXT, allowNull: true, validate: { len: [0, 1000] } },
  completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: false, defaultValue: 'medium', validate: { isIn: [['low', 'medium', 'high']] } },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'tasks', timestamps: true, indexes: [{ fields: ['userId'] }] });
