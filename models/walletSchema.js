const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    totalBalance:{
        type:Number,
        required:true,
        default:0
    },
    transactions: [
        {
            type: {
                type: String,
                enum: ['Deposit', 'Withdrawal', 'Purchase', 'Refund', 'Referal'],
                required: true
            },
            amount: {
                type: Number,
                required: true
            },
            orderId: {
                type: String,
                ref: 'Order',
                required: function() {
                    return this.type === 'Purchase' || this.type === 'Refund';
                }
            },
            status: {
                type: String,
                enum: ['Completed', 'Failed', 'Pending'],
                default: 'Completed'
            },
            description: {
                type: String,
                required: false
            },
            date: {
                type: Date,
                default: Date.now
            }
        }
    ],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});
walletSchema.pre('save', function (next) {
    this.lastUpdated = Date.now();
    next();
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;