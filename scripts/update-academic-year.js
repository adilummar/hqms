const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.kqjwubdxvumfljystbzp:HQms2026admin@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

(async () => {
  try {
    // 1. Update settings table: current_academic_year
    const r1 = await pool.query(
      "UPDATE settings SET value = '2025-26', updated_at = NOW() WHERE key = 'current_academic_year'"
    );
    console.log('Settings updated:', r1.rowCount, 'row(s)');

    // 2. Show current academic_years rows
    const r2 = await pool.query(
      'SELECT id, label, is_current, start_date, end_date FROM academic_years ORDER BY created_at'
    );
    console.log('Academic years in DB:', JSON.stringify(r2.rows, null, 2));

    // 3. Update academic_years: rename 2024-25 label and fix dates
    const r3 = await pool.query(
      "UPDATE academic_years SET label = '2025-26', start_date = '2025-06-01', end_date = '2026-05-31' WHERE label = '2024-25'"
    );
    console.log('Academic years label updated:', r3.rowCount, 'row(s)');

    console.log('Done!');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
