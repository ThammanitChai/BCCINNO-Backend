import 'dotenv/config';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Printer } from '../models/Printer';
import { Filament } from '../models/Filament';
import mongoose from 'mongoose';

async function seed() {
  await connectDB(process.env.MONGODB_URI as string);

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@bcc1852.com';
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    await User.create({
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || 'ChangeMe!2026',
      firstName: 'IEMS',
      lastName: 'Admin',
      studentId: 'ADMIN-001',
      track: 'staff',
      role: 'admin',
      hoursQuota: 9999,
    });
    console.log('✓ Admin user created');
  } else {
    console.log('• Admin user already exists');
  }

  // Sample printers — match Bambu Lab fleet from the doc
  const printerNames = [
    { name: 'Bambu Lab P1P #1', modelName: 'P1P', type: 'FDM' as const },
    { name: 'Bambu Lab P1P #2', modelName: 'P1P', type: 'FDM' as const },
    { name: 'Bambu Lab P1P #3', modelName: 'P1P', type: 'FDM' as const },
    { name: 'Bambu Lab P1S #1', modelName: 'P1S', type: 'FDM' as const },
    { name: 'Bambu Lab P1S #2', modelName: 'P1S', type: 'FDM' as const },
    { name: 'Bambu Lab P1S #3', modelName: 'P1S', type: 'FDM' as const },
    { name: 'Bambu Lab X1-Carbon', modelName: 'X1-Carbon', type: 'FDM' as const },
  ];
  for (const p of printerNames) {
    await Printer.updateOne(
      { name: p.name },
      { $setOnInsert: p },
      { upsert: true }
    );
  }
  console.log(`✓ ${printerNames.length} printers seeded`);

  // Sample filaments — derived from the IEMS stock sheet
  const filaments = [
    { type: 'PLA Pro', brand: 'Polymaker', subBrand: 'Polylight', color: 'White', recommendedStock: 15, minimumStock: 5, currentAmount: 14, pricePerGram: 2 },
    { type: 'PLA Pro', brand: 'Polymaker', subBrand: 'Polylight', color: 'Black', recommendedStock: 15, minimumStock: 5, currentAmount: 10, pricePerGram: 2 },
    { type: 'PLA', brand: 'Polymaker', subBrand: 'Polylight', color: 'Blue', recommendedStock: 5, minimumStock: 2, currentAmount: 9, pricePerGram: 1.875 },
    { type: 'PLA', brand: 'Polymaker', subBrand: 'Polyterra', color: 'Charcoal Black', recommendedStock: 5, minimumStock: 2, currentAmount: 10, pricePerGram: 1.875 },
    { type: 'PLA', brand: 'Polymaker', subBrand: 'Polyterra', color: 'Army Blue', recommendedStock: 4, minimumStock: 2, currentAmount: 6, pricePerGram: 1.875 },
    { type: 'PLA', brand: 'Polymaker', subBrand: 'Polyterra', color: 'Mint', recommendedStock: 2, minimumStock: 1, currentAmount: 2, pricePerGram: 1.875 },
    { type: 'PLA', brand: 'Bambu', color: 'White', recommendedStock: 2, minimumStock: 1, currentAmount: 1, pricePerGram: 2 },
    { type: 'PLA', brand: 'Bambu', color: 'Green', recommendedStock: 2, minimumStock: 1, currentAmount: 5, pricePerGram: 2 },
    { type: 'ABS', brand: 'Polymaker', subBrand: 'Polylight', color: 'White', recommendedStock: 10, minimumStock: 5, currentAmount: 16, pricePerGram: 2.5 },
    { type: 'ABS', brand: 'Polymaker', subBrand: 'Polylight', color: 'Black', recommendedStock: 10, minimumStock: 5, currentAmount: 9, pricePerGram: 2.5 },
    { type: 'PC-ABS', brand: 'Polymaker', color: 'Black', recommendedStock: 3, minimumStock: 2, currentAmount: 2, pricePerGram: 4 },
    { type: 'PC-ABS', brand: 'Polymaker', color: 'White', recommendedStock: 3, minimumStock: 2, currentAmount: 2, pricePerGram: 4 },
  ];
  for (const f of filaments) {
    await Filament.updateOne(
      { type: f.type, brand: f.brand, color: f.color, subBrand: f.subBrand || null },
      { $setOnInsert: f },
      { upsert: true }
    );
  }
  console.log(`✓ ${filaments.length} filaments seeded`);

  // Demo students
  const demoStudents = [
    {
      email: 'thanapong.sa@bcc1852.com',
      password: 'student1234',
      firstName: 'Thanapong',
      lastName: 'Satapornnanont',
      studentId: '01979',
      nationalIdLast4: '1327',
      track: 'biomedical' as const,
    },
    {
      email: 'suwanna@bcc1852.com',
      password: 'student1234',
      firstName: 'Suwanna',
      lastName: 'Demo',
      studentId: '12345',
      nationalIdLast4: '0000',
      track: 'engineer' as const,
    },
  ];
  for (const s of demoStudents) {
    const exists = await User.findOne({ email: s.email });
    if (!exists) await User.create(s);
  }
  console.log(`✓ Demo students seeded`);

  await mongoose.disconnect();
  console.log('\n✓ Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
