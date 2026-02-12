const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new Database(dbPath);

async function createAdminUser() {
  const email = 'admin@test.com';
  const password = 'admin';
  const nombre = 'Admin';
  const apellido = 'User';
  const rol = 'admin';

  console.log(`Creating user ${email}...`);

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const stmt = db.prepare(`
      INSERT INTO users (email, password, nombre, apellido, rol, activo)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(email, hashedPassword, nombre, apellido, rol, 1);
    console.log(`User created with ID: ${info.lastInsertRowid}`);
    console.log(`Credentials:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.log('User already exists.');
    } else {
      console.error('Error creating user:', error);
    }
  }
}

createAdminUser();
