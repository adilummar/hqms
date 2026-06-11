const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgresql://postgres@127.0.0.1:5432/hqms' });

async function resetAdmin() {
  const hash = await bcrypt.hash('Admin@123', 10);
  console.log('Generated hash:', hash);

  const res = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE username = 'admin' RETURNING username, role",
    [hash]
  );
  console.log('Updated:', res.rows[0]);

  // Verify it works
  const user = await pool.query("SELECT password_hash FROM users WHERE username = 'admin'");
  const match = await bcrypt.compare('Admin@123', user.rows[0].password_hash);
  console.log('Password verify test:', match ? '✅ PASS' : '❌ FAIL');

  await pool.end();
}

resetAdmin().catch(e => { console.error(e); process.exit(1); });
