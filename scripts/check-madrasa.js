const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) envVars[key.trim()] = rest.join('=').trim();
});

const pool = new Pool({ connectionString: envVars.DATABASE_URL });

async function run() {
  // Class 5 madrasa id = d4f110ec-e6f5-460e-b904-f2576cf80b32
  const classId = 'd4f110ec-e6f5-460e-b904-f2576cf80b32';
  const tutorId = 'bc35b026-7710-4303-a809-01ca2e531376';

  console.log('\n=== Enrollments in Madrasa Class 5 ===');
  const enrollments = await pool.query(`
    SELECT 
      e.id, e.student_id, e.status, e.academic_year_id,
      ay.label as year_label, ay.is_current,
      s.first_name, s.last_name, s.status as student_status
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    JOIN academic_years ay ON ay.id = e.academic_year_id
    WHERE e.class_id = $1
    ORDER BY s.first_name
  `, [classId]);
  console.table(enrollments.rows);

  console.log('\n=== Tutor user details ===');
  const tutor = await pool.query(`
    SELECT id, username, role, is_active FROM users WHERE id = $1
  `, [tutorId]);
  console.table(tutor.rows);

  console.log('\n=== Exam subjects for Class 5 in madrasa exam ===');
  const subjects = await pool.query(`
    SELECT es.id, es.name, es.class_id
    FROM exam_subjects es
    WHERE es.class_id = $1
  `, [classId]);
  console.table(subjects.rows);
}

run().catch(console.error).finally(() => pool.end());
