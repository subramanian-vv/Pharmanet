const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

const User = require('../models/User');

module.exports = function (passport) {
    passport.use(
        new LocalStrategy({ usernameField: 'email' }, function (email, password, done) {
            //Match user
            User.findOne({ email: email })
                .then(function(user) {
                    //Check if email doesn't exist
                    if(!user) {
                        return done(null, false, { message: 'Email is not registered' });
                    }

                    //Match password
                    bcrypt.compare(password, user.password, function (err, isMatch) {
                        if(err) throw err;

                        if(isMatch) {
                            return done(null, user);
                        } 
                        else {
                            return done(null, false, { message: 'Password is incorrect' });
                        }
                    });
                })
                .catch(function (err) {
                    console.log(err);
                });
        })
    );

    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function (id, done) {
        User.findById(id, function (err, user) {
            done(err, user);
        });
    });
}