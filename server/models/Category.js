import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    }
});

export default mongoose.model('Category', categorySchema);
