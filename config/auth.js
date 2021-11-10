module.exports = {
    //Ensures users don't access the dashboard when logged out
    ensureAuthenticated: function (req, res, next) {
        if(req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'Login to access the dashboard');
        res.redirect('/login');
    },

    //Ensures users don't access the signup/login page when logged in
    forwardAuthenticated: function (req, res, next) {
        if(!req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'You are already logged in!');
        res.redirect('/user/dashboard');
    }, 

    //Ensures buyers don't access the seller-specific pages
    sellerAuthenticated: function(req, res, next) {
        if(req.user.role == 'seller') {
            return next();
        }
        res.redirect('/user/dashboard');
    },

    buyerAuthenticated: function(req, res, next) {
        if(req.user.role == 'buyer') {
            return next();
        }
        res.redirect('/user/dashboard');
    }
};