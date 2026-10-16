import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(80), allowNull: false, validate: { notEmpty: true, len: [2, 80] } },
  email: { type: DataTypes.STRING(254), allowNull: false, unique: true, validate: { isEmail: true, notEmpty: true } },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
}, { tableName: 'users', timestamps: true });
