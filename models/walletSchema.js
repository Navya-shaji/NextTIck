const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },
    balance : {
        type : Number,
        min : 0,
        default : 0,
        required : true
    },
    history : [
       {
        status : {
            type : String,
            enum : ['credit', 'debit'],
            required : true,
        },
        payment : {
            type : Number,
            require : true
        },
        date : {
            type : Date,
            required : true
        }
       }
    ]
},{timestamps : true});


const Wallet = mongoose.model('Wallet',walletSchema);
module.exports = Wallet;