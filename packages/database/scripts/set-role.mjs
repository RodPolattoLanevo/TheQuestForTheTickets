// Promotes/demotes a user by email. Usage: tsx scripts/set-role.mjs <email> <EMPLOYEE|ADMIN>
import { getPrismaClient } from "../src/index.js";

const [email, role] = process.argv.slice(2);

if (!email || !["EMPLOYEE", "ADMIN"].includes(role)) {
  console.error("Usage: tsx scripts/set-role.mjs <email> <EMPLOYEE|ADMIN>");
  process.exit(1);
}

const prisma = getPrismaClient();

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}

const updated = await prisma.user.update({
  where: { email },
  data: { role },
});

console.log(`${updated.email} is now ${updated.role}`);
