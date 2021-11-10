const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');

const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');

//User model
const User = require('../models/User');

router.get('/', forwardAuthenticated, function(req, res) {
    res.redirect('/login');
});

router.get('/login', forwardAuthenticated, function(req, res) {
    res.render('login');
});

router.get('/signup', forwardAuthenticated, function(req, res) {
    res.render('signup');
});

//Signup handle
router.post('/signup', function(req, res) {
    const { name, email, password, password2, role } = req.body;
    let errors = [];

    //Check required fields
    if(!name || !email || !password || !password2 || !role) {
        errors.push({ msg: 'Please fill in all the fields' });
    }

    //Check password length
    else if(password.length < 6) {
        errors.push({ msg: 'Password should atleast be 6 characters long' });
    }

    //Check if passwords match
    else if(password != password2) {
        errors.push({ msg: 'Passwords do not match' });
    }

    if(errors.length > 0) {
        res.render('signup', {
            errors,
            name,
            email,
            password,
            password2,
            role
        });
    } else {
        //Validation passed
        User.findOne({ email: email })
            .then(function (user) {
                if(user) {
                    //User exists
                    errors.push({ msg: 'Email is already registered' });
                    res.render('signup', {
                        errors,
                        name,
                        email,
                        password,
                        password2,
                        role
                    });
                } else {
                    const newUser = new User ({
                        name,
                        email,
                        password,
                        role
                    });

                    //Hash password
                    bcrypt.genSalt(10, function(err, salt) {
                        bcrypt.hash(newUser.password, salt, function(err, hash) {
                            if(err) throw err;

                            //Set password to hashed
                            newUser.password = hash;

                            newUser.save()
                                .then(function(user) {
                                    req.flash('success_msg', 'Signup is successful and you can login!');
                                    res.redirect('/login');
                                })
                                .catch(function(err) {
                                    console.log(err);
                                });
                        });
                    });
                }
            });
    }
});

//Login handle
router.post('/login', function(req, res, next) {
    passport.authenticate('local', {
        successRedirect: '/user/dashboard',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res, next);
});

//Logout handle
router.get('/logout', function(req, res) {
    req.logout();
    req.flash('success_msg', 'You are logged out!');
    res.redirect('/login');
});

module.exports = router;