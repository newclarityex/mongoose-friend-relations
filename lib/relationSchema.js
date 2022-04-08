import mongoose from 'mongoose';
const { Schema } = mongoose;

export default new Schema({
    user: Schema.Types.ObjectId,
    status: {
        type: String,
        enum: ['pending', 'requested', 'accepted', 'blocked'],
    },
});
