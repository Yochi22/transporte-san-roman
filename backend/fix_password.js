const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fix() {
  const email = 'admin@sanroman.com';
  const passwordHash = await bcrypt.hash('SanRoman22!', 10);

  const user = await prisma.usuario.upsert({
    where: { email },
    update: { passwordHash, activo: true },
    create: {
      nombre: 'Administrador',
      email,
      passwordHash,
      rol: 'ADMIN',
      activo: true
    },
  });

  console.log('✅ BASE DE DATOS ACTUALIZADA');
  console.log('Email:', user.email);
  console.log('Nueva Clave seteada correctamente.');
  process.exit(0);
}

fix().catch(err => {
  console.error('❌ ERROR:', err);
  process.exit(1);
});
