require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
var path = require('path');
const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: true,
  saveUninitialized: false,
  cookie: { secure: true }

}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  username: String,
  place: String,
  about_me: String,
  instagram: String,
  linkedin: String,
  github: String,
  googleId: String,
  secret: String,
  img:
  {
    data: Buffer,
    contentType: String
  }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, { id: user._id, username: user.username, googleId: user.googleId });
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

//IMG
var multer = require('multer');
const { profile } = require('console');

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now())
  }
});

var upload = multer({ storage: storage });

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/home",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
  scope: ['profile', 'email']
},
  function (accessToken, refreshToken,profile, cb) {
    const email = profile.emails[0].value;
    if (email.endsWith('@iiit-bh.ac.in') && email.startsWith('b5220')) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    } else {
      // console.log( "cb(null, false, { message: 'Invalid email domain' })");
      return cb(null, false, { message: 'Invalid email domain' });
    }
  }
));

app.get("/", function (req, res) {
  res.render("signin");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile","email"] })
);

app.get("/auth/google/home",
  passport.authenticate('google', { failureRedirect: "/" }),
  function (req, res, next) {
    // Successful authentication, redirect to form.
    // console.log(req.session.passport.user.googleId);
    res.redirect("/form");
  });
//Form

app.post('/form',
  passport.authenticate('local', { failureRedirect: '/', failureMessage: true }),
  (req, res) => {
    // User.getCollection('users').find({ _id: User.id })
    console.log(req.session.passport.user.googleId);


    // console.log(req.session);
    // passport.authenticate("local")(req, res, function () {
    // res.redirect("/secrets");
    // });
    const filter = { googleId: req.session.passport.user.googleId };
    User.updateOne(filter, {
      about_me: req.body.description,
      place: req.body.place,
      // img: {
      //     data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
      //     contentType: 'image/png'
      // },
      username: req.body.name,
      instagram: req.body.instagram,
      linkedin: req.body.linkedin,
      github: req.body.github
    })
      .then((item, err) => {
        if (err) {
          console.log(err);
        }
        else {
          // item.save();
          res.redirect('/home');
        }
      });
  });


app.get("/home", function (req, res) {
  User.find({ "home": { $ne: null } }, function (err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("home", { usersWithSecrets: foundUsers });
        res.render("homepage")
      }
    }
  });
});

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("home");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function (req, res) {
  const submittedSecret = req.body.secret;

  //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
  // console.log(req.user.id);

  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function () {
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.post("/register", function (req, res) {

  User.register({ username: req.body.username }, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });

});

app.post("/login", function (req, res) {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/homepage");
      });
    }
  });

});

app.get("/home", function (req, res) {
  res.render("homepage");
});

app.get("/form", function (req, res) {
  res.render("form");
});
app.get("/about", function (req, res) {
  res.render("about");
});
app.get("/society", function (req, res) {
  res.render("society");
});
app.get("/batch", function (req, res) {
  res.render("batch");
});
app.listen(3000, function () {
  console.log("Server started on port 3000.");
});
