import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const dir = path.join(process.cwd(), "drizzle");
const backupDir = path.join(process.cwd(), "drizzle_backup");

// Backup
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql"));

for (const file of files) {
  const filePath = path.join(dir, file);
  const backupPath = path.join(backupDir, file);
  fs.copyFileSync(filePath, backupPath);
  
  // Clear file
  fs.writeFileSync(filePath, "-- empty\n");
}

console.log("Files backed up and cleared. Running db:migrate...");

try {
  execSync("npm run db:migrate", { stdio: "inherit" });
  console.log("Migrate successful!");
} catch (err) {
  console.error("Migrate failed", err);
}

// Restore
console.log("Restoring files...");
for (const file of files) {
  const filePath = path.join(dir, file);
  const backupPath = path.join(backupDir, file);
  fs.copyFileSync(backupPath, filePath);
}

console.log("Done!");
