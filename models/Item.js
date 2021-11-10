const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    itemName: {
        type: String,
        required: true
    },
    itemChemName: {
        type: String
    },
    itemCompany: {
        type: String,
        required: true
    },
    itemCategory: {
        type: String,
        required: true
    },
    itemQty: {
        type: Number,
        required: true
    },
    itemPrice: {
        type: Number,
        required: true
    },
    image: {
        data: Buffer, 
		contentType: String 
    },
    invoiceDetails: {
        type: Array
    },
    purchases: {
        type: Array
    },
    createdDate: {
        type: Date,
        default: Date.now
    }
});

const Item = mongoose.model('Item', ItemSchema);

module.exports = Item;