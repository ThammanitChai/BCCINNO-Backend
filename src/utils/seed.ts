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

  // Printers
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
    await Printer.updateOne({ name: p.name }, { $setOnInsert: p }, { upsert: true });
  }
  console.log(`✓ ${printerNames.length} printers seeded`);

  // Filaments
  const filaments = [
    // PLA Pro
    { type: 'PLA Pro', brand: 'Polymaker', subBrand: 'Polylight', color: 'White',         recommendedStock: 15, minimumStock: 5, currentAmount: 14, pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA Pro', brand: 'Polymaker', subBrand: 'Polylight', color: 'Black',         recommendedStock: 15, minimumStock: 5, currentAmount: 10, pricePerGram: 2,   isDiscontinued: false },
    // PLA - Polymaker Polylight
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polylight', color: 'Blue',          recommendedStock: 5,  minimumStock: 2, currentAmount: 9,  pricePerGram: 2,   isDiscontinued: false },
    // PLA - Polymaker Polyterra
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polyterra', color: 'Charcoal Black',recommendedStock: 5,  minimumStock: 2, currentAmount: 10, pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polyterra', color: 'Army Blue',     recommendedStock: 4,  minimumStock: 2, currentAmount: 6,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polyterra', color: 'Fossil Grey',   recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polyterra', color: 'Forrest Green', recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polyterra', color: 'Mint',          recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polyterra', color: 'Banana',        recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Polyterra', color: 'Candy',         recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 2,   isDiscontinued: false },
    // PLA - Ender
    { type: 'PLA',     brand: 'Ender',                            color: 'Grey',          recommendedStock: 2,  minimumStock: 1, currentAmount: 1,  pricePerGram: 1.5, isDiscontinued: false },
    { type: 'PLA',     brand: 'Ender',                            color: 'Blue',          recommendedStock: 2,  minimumStock: 1, currentAmount: 1,  pricePerGram: 1.5, isDiscontinued: false },
    // PLA - Bambu
    { type: 'PLA',     brand: 'Bambu',                            color: 'White',         recommendedStock: 2,  minimumStock: 1, currentAmount: 1,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Bambu',                            color: 'Green',         recommendedStock: 2,  minimumStock: 1, currentAmount: 5,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Bambu',                            color: 'Orange',        recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 2,   isDiscontinued: false },
    // PLA Support
    { type: 'PLA Support', brand: 'Bambu',                        color: 'White',         recommendedStock: 3,  minimumStock: 1, currentAmount: 3,  pricePerGram: 2.5, isDiscontinued: false },
    // PLA Mussel / Trigo
    { type: 'PLA Mussel',  brand: 'Francofil',                    color: 'Brown',         recommendedStock: 2,  minimumStock: 1, currentAmount: 1,  pricePerGram: 2.5, isDiscontinued: false },
    { type: 'PLA Trigo',   brand: 'Francofil',                    color: 'Brown',         recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 2.5, isDiscontinued: false },
    // PLA - 3DD (Discontinued)
    { type: 'PLA',     brand: '3DD',                              color: 'Black',         recommendedStock: 0,  minimumStock: 0, currentAmount: 3,  pricePerGram: 2,   isDiscontinued: true },
    { type: 'PLA',     brand: '3DD',                              color: 'Red',           recommendedStock: 0,  minimumStock: 0, currentAmount: 2,  pricePerGram: 2,   isDiscontinued: true },
    // PLA - Polymaker Panchroma
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Panchroma', color: 'Cotton White',  recommendedStock: 2,  minimumStock: 1, currentAmount: 5,  pricePerGram: 2,   isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Panchroma', color: 'Sku Forrest Green', recommendedStock: 2, minimumStock: 1, currentAmount: 1, pricePerGram: 2, isDiscontinued: false },
    { type: 'PLA',     brand: 'Polymaker', subBrand: 'Panchroma', color: 'Pastel Banana', recommendedStock: 2, minimumStock: 1, currentAmount: 1,  pricePerGram: 2,   isDiscontinued: false },
    // PLA - Creality/Ender (Discontinued)
    { type: 'PLA',     brand: 'Creality',  subBrand: 'Ender',     color: 'Grey',          recommendedStock: 0,  minimumStock: 0, currentAmount: 1,  pricePerGram: 1.5, isDiscontinued: true },
    { type: 'PLA',     brand: 'Creality',  subBrand: 'Ender',     color: 'Blue',          recommendedStock: 0,  minimumStock: 0, currentAmount: 1,  pricePerGram: 1.5, isDiscontinued: true },
    // ABS
    { type: 'ABS',     brand: 'Polymaker', subBrand: 'Polylight', color: 'White',         recommendedStock: 10, minimumStock: 5, currentAmount: 16, pricePerGram: 2.5, isDiscontinued: false },
    { type: 'ABS',     brand: 'Polymaker', subBrand: 'Polylight', color: 'Black',         recommendedStock: 10, minimumStock: 5, currentAmount: 9,  pricePerGram: 2.5, isDiscontinued: false },
    // PC-ABS
    { type: 'PC-ABS',  brand: 'Polymaker',                        color: 'Black',         recommendedStock: 3,  minimumStock: 2, currentAmount: 2,  pricePerGram: 4,   isDiscontinued: false },
    { type: 'PC-ABS',  brand: 'Polymaker',                        color: 'White',         recommendedStock: 3,  minimumStock: 2, currentAmount: 2,  pricePerGram: 4,   isDiscontinued: false },
    // TPU95-HF
    { type: 'TPU95-HF',brand: 'Polymaker', subBrand: 'Polyflex',  color: 'Translucent',   recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 3,   isDiscontinued: false },
    { type: 'TPU95-HF',brand: 'Polymaker', subBrand: 'Polyflex',  color: 'White',         recommendedStock: 2,  minimumStock: 1, currentAmount: 4,  pricePerGram: 3,   isDiscontinued: false },
    { type: 'TPU95-HF',brand: 'Polymaker', subBrand: 'Polyflex',  color: 'Black',         recommendedStock: 2,  minimumStock: 1, currentAmount: 3,  pricePerGram: 3,   isDiscontinued: false },
    // PC
    { type: 'PC',      brand: 'Polymaker', subBrand: 'Polymax',   color: 'Black',         recommendedStock: 2,  minimumStock: 1, currentAmount: 3,  pricePerGram: 5,   isDiscontinued: false },
    // PETG-ESD
    { type: 'PETG-ESD',brand: 'Polymaker', subBrand: 'Polymax',   color: 'Black',         recommendedStock: 2,  minimumStock: 1, currentAmount: 2,  pricePerGram: 4,   isDiscontinued: false },
    // PVA
    { type: 'PVA',     brand: 'Bambu',                            color: 'Translucent',   recommendedStock: 4,  minimumStock: 2, currentAmount: 4,  pricePerGram: 5,   isDiscontinued: false },
  ];

  for (const f of filaments) {
    await Filament.updateOne(
      { type: f.type, brand: f.brand, subBrand: (f as any).subBrand || null, color: f.color },
      { $set: f },
      { upsert: true }
    );
  }
  console.log(`✓ ${filaments.length} filaments seeded`);

  await mongoose.disconnect();
  console.log('\n✓ Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
