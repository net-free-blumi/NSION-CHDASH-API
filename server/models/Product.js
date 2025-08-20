import mongoose from 'mongoose';

const sizeSchema = new mongoose.Schema(
    {
        size: { type: String, required: false },
        price: { type: Number, required: false, default: 0 }
    },
    { _id: false }
);

const productSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    searchName: { type: String, required: false },
    category: { type: String, required: true },
    type: { type: String, enum: ['quantity', 'size', 'none', ''], default: '' },
    // Quantity-type fields
    defaultQuantity: { type: Number, required: false },
    predefinedQuantities: { type: [Number], default: undefined },
    unit: { type: String, required: false },
    quantity: { type: Number, required: false },
    // Size-type fields
    defaultSize: { type: String, required: false },
    sizes: { type: [sizeSchema], default: undefined },
    // Flat price (for non-size products)
    price: { type: Number, required: false },
    lastUpdate: { type: Date, default: Date.now }
});

export default mongoose.model('Product', productSchema);
