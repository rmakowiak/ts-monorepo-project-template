import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...\n");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  console.log("✅ Existing data cleared\n");

  // Create categories
  console.log("📁 Creating categories...");
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: "Electronics",
        slug: "electronics",
        description: "Electronic devices and gadgets",
      },
    }),
    prisma.category.create({
      data: {
        name: "Accessories",
        slug: "accessories",
        description: "Computer and electronic accessories",
      },
    }),
    prisma.category.create({
      data: {
        name: "Gaming",
        slug: "gaming",
        description: "Gaming equipment and accessories",
      },
    }),
    prisma.category.create({
      data: {
        name: "Office",
        slug: "office",
        description: "Office supplies and equipment",
      },
    }),
    prisma.category.create({
      data: {
        name: "Audio",
        slug: "audio",
        description: "Audio equipment and accessories",
      },
    }),
  ]);
  console.log(`✅ Created ${categories.length} categories\n`);

  // Create products
  console.log("📦 Creating products...");
  const products = [
    // Electronics
    {
      name: "Wireless Mouse",
      sku: "MOUSE-001",
      price: 29.99,
      stock: 150,
      categoryId: categories[0].id,
      description: "Ergonomic wireless mouse with 6 buttons",
    },
    {
      name: "Mechanical Keyboard",
      sku: "KB-001",
      price: 89.99,
      stock: 75,
      categoryId: categories[0].id,
      description: "RGB mechanical keyboard with Cherry MX switches",
    },
    {
      name: "USB-C Hub",
      sku: "HUB-001",
      price: 45.99,
      stock: 200,
      categoryId: categories[0].id,
      description: "7-in-1 USB-C hub with 4K HDMI output",
    },
    {
      name: '27" Monitor',
      sku: "MON-001",
      price: 299.99,
      stock: 50,
      categoryId: categories[0].id,
      description: "27-inch 4K IPS monitor",
    },

    // Accessories
    {
      name: "Laptop Stand",
      sku: "STAND-001",
      price: 39.99,
      stock: 100,
      categoryId: categories[1].id,
      description: "Aluminum laptop stand with cooling",
    },
    {
      name: "Webcam 1080p",
      sku: "CAM-001",
      price: 79.99,
      stock: 80,
      categoryId: categories[1].id,
      description: "Full HD webcam with autofocus",
    },
    {
      name: "Mouse Pad XL",
      sku: "PAD-001",
      price: 19.99,
      stock: 250,
      categoryId: categories[1].id,
      description: "Extended gaming mouse pad",
    },
    {
      name: "Cable Organizer",
      sku: "CABLE-001",
      price: 12.99,
      stock: 300,
      categoryId: categories[1].id,
      description: "Cable management clips set",
    },

    // Gaming
    {
      name: "Gaming Headset",
      sku: "HEAD-001",
      price: 119.99,
      stock: 60,
      categoryId: categories[2].id,
      description: "7.1 surround sound gaming headset",
    },
    {
      name: "RGB Mousepad",
      sku: "RGBPAD-001",
      price: 34.99,
      stock: 120,
      categoryId: categories[2].id,
      description: "RGB illuminated gaming mousepad",
    },
    {
      name: "Gaming Chair",
      sku: "CHAIR-001",
      price: 299.99,
      stock: 30,
      categoryId: categories[2].id,
      description: "Ergonomic gaming chair with lumbar support",
    },

    // Office
    {
      name: "Desk Lamp LED",
      sku: "LAMP-001",
      price: 49.99,
      stock: 90,
      categoryId: categories[3].id,
      description: "Adjustable LED desk lamp",
    },
    {
      name: "Notebook Set",
      sku: "NOTE-001",
      price: 15.99,
      stock: 200,
      categoryId: categories[3].id,
      description: "Set of 3 premium notebooks",
    },
    {
      name: "Pen Holder",
      sku: "PEN-001",
      price: 9.99,
      stock: 150,
      categoryId: categories[3].id,
      description: "Wooden desk organizer",
    },

    // Audio
    {
      name: "Bluetooth Speaker",
      sku: "SPEAK-001",
      price: 59.99,
      stock: 100,
      categoryId: categories[4].id,
      description: "Portable Bluetooth speaker with bass",
    },
    {
      name: "Wireless Earbuds",
      sku: "EAR-001",
      price: 89.99,
      stock: 140,
      categoryId: categories[4].id,
      description: "Noise-cancelling wireless earbuds",
    },
    {
      name: "Studio Microphone",
      sku: "MIC-001",
      price: 149.99,
      stock: 45,
      categoryId: categories[4].id,
      description: "USB condenser microphone",
    },
  ];

  await prisma.product.createMany({ data: products });
  console.log(`✅ Created ${products.length} products\n`);

  console.log("🎉 Database seed completed!\n");
  console.log("📊 Summary:");
  console.log(`  - Categories: ${categories.length}`);
  console.log(`  - Products: ${products.length}`);
  console.log("\n✨ Ready for development!\n");
}

main()
  .catch((error) => {
    console.error("❌ Error during seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
