import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './models/Category.js';

dotenv.config();

const initialCategories = [
    { code: "kitchen", name: "מוצרי מטבח" },
    { code: "bakery", name: "קונדיטורייה" },
    { code: "fruits", name: "פירות" },
    { code: "sushi", name: "סושי" },
    { code: "amar", name: "קונדיטורייה עמר" },
    { code: "kitchenProducts", name: "מטבח מוסטפה" },
    { code: "online", name: "אונליין" },
    { code: "warehouse", name: "מחסן" },
    { code: "sizes", name: "מוצרי גדלים" },
    { code: "quantities", name: "מוצרי כמות" }
];

async function initializeDb() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing categories
        await Category.deleteMany({});
        console.log('Cleared existing categories');

        // Insert new categories
        await Category.insertMany(initialCategories);
        console.log('Added initial categories');

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    } finally {
        await mongoose.disconnect();
    }
}

initializeDb();
