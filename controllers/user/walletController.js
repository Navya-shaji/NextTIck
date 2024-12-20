// const Razorpay = require("razorpay");
// const { webhookSignature } = require('razorpay');
require('dotenv').config();
// const crypto = require('crypto')

const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');

const getWalletBalance = async (req, res) => {
    try {
        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
            await wallet.save();
        }
        res.json({ balance: wallet.balance });
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addMoney = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
        }

        wallet.balance += amount;
        wallet.history.push({
            status: 'credit',
            payment: amount,
            date: new Date()
        });

        await wallet.save();
        res.json({ message: 'Money added successfully', balance: wallet.balance });
    } catch (error) {
        console.error('Error adding money to wallet:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getWalletHistory = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            return res.json({ history: [] });
        }
        res.json({ history: wallet.history });
    } catch (error) {
        console.error('Error fetching wallet history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const refundToWallet = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        if (!orderId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid order or amount' });
        }

        let wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) {
            wallet = new Wallet({ user: req.user._id });
        }

        wallet.balance += amount;
        wallet.history.push({
            status: 'credit',
            payment: amount,
            date: new Date()
        });

        await wallet.save();
        res.json({ message: 'Refund processed successfully', balance: wallet.balance });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


module.exports = {
    getWalletBalance,
    addMoney ,
    getWalletHistory,
    refundToWallet
}