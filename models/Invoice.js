const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    items: {
        type: Array
    },
    totalCost: {
        type: Number,
        required: true
    },
    createdDate: {
        type: Date,
        default: Date.now
    }
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);

module.exports = Invoice;