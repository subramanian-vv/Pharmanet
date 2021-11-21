const express = require('express');
const router = express.Router();
const multer = require('multer');

var fs = require('fs'); 
var path = require('path');
const plotly = require('plotly')(process.env.PLOTLY_USERNAME, process.env.PLOTLY_API_KEY);
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

const { ensureAuthenticated, buyerAuthenticated, sellerAuthenticated } = require('../config/auth');

//User model
const User = require('../models/User');

//Item model
const Item = require('../models/Item');

//Invoice model
const Invoice = require('../models/Invoice');

/*-------------------------------------COMMON ROUTES--------------------------------------------------*/
//Buyer and Seller dashboard
router.get('/dashboard', ensureAuthenticated, async function(req, res) {
    let items = await Item.find().sort({ createdDate: 'desc' });
    const role = req.user.role;
    if(role == 'buyer') {
        res.render('buyer-dash', {
            name: req.user.name,
            items: items,
            cart: req.user.cart
        });
    } else if(role == 'seller') {
        items = await Item.find({ email: req.user.email }).sort({ createdDate: 'desc' });
        res.render('seller-dash', {
            name: req.user.name,
            items: items
        });
    }
});

router.get('/search', ensureAuthenticated, function(req, res) {
    res.redirect('/user/dashboard');
});

//Case insensitive search using regular expression
router.post('/search', async function(req, res) {
    const { search } = req.body;
    const items = await Item.find({$or: [{itemName: new RegExp(search, 'i')}, {itemChemName: new RegExp(search, 'i')}, {itemCategory: new RegExp(search, 'i')}]});
    if(req.user.role == 'buyer') {
        res.render('buyer-search', {
            name: req.user.name,
            cart: req.user.cart,
            search,
            items: items
        });
    } else if(req.user.role == 'seller') {
        res.render('seller-search', {
            name: req.user.name,
            cart: req.user.cart,
            search,
            items: items
        });
    }
});


/*----------------------------------SELLER ROUTES---------------------------------------------------*/
const storage = multer.diskStorage({
    destination: './public/uploads',
    filename: function(req, file, callback) {
        callback(null, file.fieldname + '-' + Date.now() + 
        path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 },
    fileFilter: function(req, file, callback) {
        checkFileType(file, callback);
    }
});

//Check File Type
function checkFileType(file, callback, req, res) {
    //Image extensions
    const filetypes = /jpeg|jpg|png|gif/;
    //Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    //Check mimetype
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname) {
        return callback(null, true);
    } else {
        callback("Error: Images only!");
    }
}

//Route to add items
router.get('/add', ensureAuthenticated, sellerAuthenticated, async function(req, res) {
    items = await Item.find({ email: req.user.email });
    res.render('add-item', { item: new Item(), items: items });
});

router.post('/dashboard', upload.single('image'), async function(req, res) {
    var newItem = { 
		name: req.user.name, 
        email: req.user.email, 
        itemName: req.body.itemName,
        itemChemName: req.body.itemChemName,
        itemCompany: req.body.itemCompany,
        itemCategory: req.body.itemCategory,
        itemQty: 0,
        itemPrice: req.body.itemPrice,
		image: { 
			data: fs.readFileSync(path.join('./public/uploads/' + req.file.filename)), 
			contentType: 'image/png'
		} 
	} 

    Item.create(newItem, function(err) {
        if(err) {
            console.log(err);
            req.flash('error_msg', 'Images only!');
            res.render('/user/add', {
                            itemName,
                            itemChemName,
                            itemCompany,
                            itemCategory,
                            itemQty,
                            itemPrice,
                            image
                        });
        } else {
            req.flash('success_msg', 'Item added successfully!');
            res.redirect('/user/dashboard');
        }
    });
});

//Route to add invoice
router.get('/add-invoice', ensureAuthenticated, sellerAuthenticated, async function(req, res) {
    items = await Item.find({ email: req.user.email });
    res.render('add-invoice', { invoice: new Invoice(), items: items });
});

router.post('/invoice', async function(req, res) {
    let total = parseInt(req.body.total);
    let itemArray = [];
    let totalAmount = 0;
    for(let i = 0; i < total; i++) {
        invoiceItem = await Item.findOne({ email: req.user.email, itemName: req.body["item" + i + ".name"] });
        let item = {};
        item.qty = parseInt(req.body["item" + i + ".qty"]);
        item.batchno = req.body["item" + i + ".batchno"];
        item.expiry = req.body["item" + i + ".expiry"];
        
        invoiceItem.itemQty += parseInt(item.qty);
        invoiceItem.invoiceDetails.push(item);
        invoiceItem = await invoiceItem.save();
        
        item.id = invoiceItem._id;
        item.amount = req.body["item" + i + ".amount"];
        item.name = req.body["item" + i + ".name"];

        totalAmount += parseFloat(item.amount);
        itemArray.push(item);
    }
    var newInvoice = { 
		name: req.user.name, 
        email: req.user.email,
        totalCost: totalAmount, 
        items: itemArray
	} 

    Invoice.create(newInvoice, function(err) {
        if(err) {
            console.log(err);
            req.flash('error_msg', 'Internal Server error. Please try again later!');
            res.redirect('/user/dashboard');
        } else {
            req.flash('success_msg', 'Invoice added successfully!');
            res.redirect('/user/dashboard');
        }
    });
});

//Router to view invoices
router.get('/invoices', ensureAuthenticated, sellerAuthenticated, async function(req, res) {
    invoices = await Invoice.find({ email: req.user.email });
    let costPrice = 0;
    invoices.forEach(function(invoice) {
        costPrice += parseFloat(invoice.totalCost);
    });
    res.render('invoice-history', {
        name: req.user.name,
        costPrice: costPrice,
        invoices: invoices
    });
});

//Seller route for sales history 
router.get('/history', ensureAuthenticated, sellerAuthenticated, async function(req, res) {
    const items = await Item.find({ email: req.user.email });
    var graphItem = [];
    var graphPrice = [];
    var totalAmount = 0;
    items.forEach(function(item) {
        let tempQty = 0;
        graphItem.push(item.itemName);
        item.purchases.forEach(function(purchase) {
            tempQty += parseInt(purchase.itemQty);
            totalAmount += parseFloat(purchase.itemPrice);
        });
        graphPrice.push(tempQty);
    });
    //Plotting statistics
    var data = [
        {
          x: graphItem,
          y: graphPrice,
          type: 'bar'
        }
    ];
    var layout = {
        title: 'Item sales details',
        xaxis: {
            title: 'Item name'
        },
        yaxis: {
            title: 'Quantity sold'
        }
    };
    var graphOptions = {layout: layout, filename: 'basic-bar', fileopt: 'overwrite'};
    plotly.plot(data, graphOptions, function (err, msg) {
        console.log(msg);
    });
    res.render('seller-history', {
        name: req.user.name,
        items: items,
        totalAmount
    });
});

//Remove item
router.put('/:id', async function(req, res) {
    let item = await Item.findById(req.params.id);
    try {
        if(item.isVisible) {
            item.isVisible = false;
            item = await item.save();
            req.flash('error_msg', 'The item has been removed from public view');
            res.redirect('/user/dashboard');
        }
        else {
            item.isVisible = true;
            item = await item.save();
            req.flash('error_msg', 'The item has been restored for public view');
            res.redirect('/user/dashboard');
        }
    }
    catch (err) {
        console.log(err);
        req.flash('error_msg', 'Internal server error. Please try again later!');
        res.redirect('/user/dashboard');
    }
});

//Edit item
router.get('/edit/:id', ensureAuthenticated, sellerAuthenticated, async function(req, res) {
    const item = await Item.findById(req.params.id);
    res.render('edit-item', {
        itemQty: req.body.itemQty,
        itemPrice: req.body.itemPrice,
        item: item
    });
});

router.put('/:id', async function(req, res) {
    let item = await Item.findById(req.params.id);
    item.itemPrice = req.body.itemPrice;
    try {
        item = await item.save();
        req.flash('success_msg', 'The item details has been updated successfully');
        res.redirect('/user/dashboard');
    }
    catch (err) {
        console.log(err);
        req.flash('error_msg', 'Please fill all the details!');
        res.render('edit-item', {
            itemQty: req.body.itemQty,
            itemPrice: req.body.itemPrice,
            item: item
        });
    }
});


/*----------------------------------BUYER ROUTES----------------------------------------------------------*/
router.get('/cart', ensureAuthenticated, buyerAuthenticated, async function(req, res) {
    const items = await Item.find().sort({ createdDate: 'desc' });
    const totalItems = req.user.cart.length;
    let totalPrice = 0;
    req.user.cart.forEach(function(cartElement) {
        totalPrice += parseFloat(cartElement.price);
    });
    res.render('buyer-cart', {
        name: req.user.name,
        cart: req.user.cart,
        purchases: req.user.purchases,
        items: items,
        totalItems,
        totalPrice
    });
});

//Route to add items to cart
router.post('/cart/:id', async function(req, res) {
    const { quantity } = req.body;
    let item = await Item.findById(req.params.id);
    let user = req.user;
    let cartObject = {
        id: item.id,
        name: item.itemName,
        category: item.itemCategory,
        qty: quantity,
        price: quantity*item.itemPrice,
        eventDate: new Date()
    };
    
    let itemFlag = true;
    user.cart.forEach(function (cartElement) {
        if(cartElement.id == cartObject.id) {
            itemFlag = false;
            req.flash('error_msg', "Item already in cart");
            res.redirect('/user/cart');
        }
    });

    if(itemFlag) {
        if(quantity > item.itemQty) {
            req.flash('error_msg', "Item quantity exceeds the available stock");
            res.redirect('/user/dashboard');
        } else if(quantity < 1 || Math.floor(quantity) !== Math.ceil(quantity)) {
            req.flash('error_msg', "Item quantity is not a valid integer greater than zero");
            res.redirect('/user/dashboard');
        } else {
            user.cart.push(cartObject);
            user = await user.save();
            req.flash('success_msg', "Item added to cart successfully!");
            res.redirect('/user/dashboard');
        }
    }
});

//Route to remove items from cart
router.post('/remove/:id', async function(req, res) {
    let item = await Item.findById(req.params.id);
    let user = req.user;
    for(let i = 0; i < user.cart.length; i++) {
        if(user.cart[i].id == item.id) {
            user.cart.splice(i, 1);
            user = await user.save();
            req.flash('success_msg', 'Item removed from the cart');
            res.redirect('/user/dashboard');
            break;
        }
    }
});

router.get('/purchases', ensureAuthenticated, buyerAuthenticated, function(req, res) {
    res.render('buyer-purchases', {
        name: req.user.name,
        cart: req.user.cart,
        purchases: req.user.purchases.reverse()
    });
});

//Route to purchase from cart
router.post('/purchases', async function(req, res) {
    try {
        var items = await Item.find();
        var user = req.user;
        let purchaseArray = [];
        for(let i = 0; user.cart.length > 0; i++) {
            for(let j = 0; j < items.length; j++) {
                if(items[j].id == user.cart[i].id) {
                    let tempItem = await Item.findById(items[j].id);
                    tempItem.itemQty = tempItem.itemQty - user.cart[i].qty;
                    if(tempItem.itemQty < 0) {
                        req.flash('error_msg', 'An item is currently not in stock. Kindly try again later.');
                        res.redirect('/user/cart');
                        continue;
                    } else {
                        let tempCart = user.cart[i];
                        tempCart.eventDate = new Date();
                        purchaseArray.push(tempCart);
                        user.cart.splice(i, 1);
                        let salesHistory = {
                            itemQty: tempCart.qty,
                            itemPrice: tempCart.price,
                            eventDate: tempCart.eventDate,
                            buyerName: req.user.name,
                            buyerEmail: req.user.email
                        }
                        tempItem.purchases.push(salesHistory);
                        tempItem = await tempItem.save();
                        break;
                    }
                }
            }
            i--;
        }
        user.purchases.push(purchaseArray);
        user = await user.save();
        req.flash('success_msg', "Items purchased successfully!");
        res.redirect('/user/purchases');
    } 
    catch (err) {
        console.log(err);
        req.flash('error_msg', 'Some error occurred. Please try later');
        res.redirect('/user/cart');
    }
});

//Route to display news
router.get('/news', ensureAuthenticated, buyerAuthenticated, async function(req, res) {
    newsapi.v2.topHeadlines({
        category: 'health',
        language: 'en'
    }).then(response => {
        res.render('news', {
            name: req.user.name,
            cart: req.user.cart,
            news: response.articles
        });
    });
});

//Handling 404 errors
router.get('*', ensureAuthenticated, function (req, res) { 
    res.render('404', {
        name: req.user.name,
        role: req.user.role,
        cart: req.user.cart
    }); 
});

module.exports = router;