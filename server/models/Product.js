import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    price: Number,
    unit: String,
    lastUpdate: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Product', productSchema);
