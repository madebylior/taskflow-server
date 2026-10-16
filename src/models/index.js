import { User } from './User.js';
import { Task } from './Task.js';
import { Category } from './Category.js';

User.hasMany(Task, { foreignKey: 'userId', as: 'tasks', onDelete: 'CASCADE' });
Task.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
User.hasMany(Category, { foreignKey: 'userId', as: 'categories', onDelete: 'CASCADE' });
Category.belongsTo(User, { foreignKey: 'userId', as: 'owner' });
Category.hasMany(Task, { foreignKey: 'categoryId', as: 'tasks', onDelete: 'SET NULL' });
Task.belongsTo(Category, { foreignKey: 'categoryId', as: 'category', onDelete: 'SET NULL' });

export { User, Task, Category };
