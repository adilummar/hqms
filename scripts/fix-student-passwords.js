const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: 'postgresql://postgres:postgres@localhost:5432/hqms'
});

async function fixStudentPasswords() {
  // Fix Muhammed Ummer's password - reset to DOB as bcrypt
  const students = await pool.query(`
    SELECT s.id, s.date_of_birth::text as dob_text, u.id as user_id, u.username 
    FROM students s 
    JOIN users u ON u.id = s.user_id 
    WHERE u.role = 'student'
  `);

  console.log(`Found ${students.rows.length} student(s) to fix`);

  for (const student of students.rows) {
    // Use the text date directly from postgres (no timezone conversion)
    const dob = student.dob_text; // already "YYYY-MM-DD" string
    
    const hash = await bcrypt.hash(dob, 10);
    
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, student.user_id]
    );
    
    console.log(`✅ Fixed password for ${student.username} (DOB: ${dob})`);
  }

  await pool.end();
  console.log('Done!');
}

fixStudentPasswords().catch(e => { console.error(e); process.exit(1); });
