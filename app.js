const http         = require('http'),
      process      = require('process'),
      fs           = require('fs'),
      path         = require('path'),
      contentTypes = require('./utils/content-types'),
      sysInfo      = require('./utils/sys-info'),
      env          = process.env,
      mongo        = require('mongodb').MongoClient,
      mongoose     = require('mongoose'),
      passport     = require('passport'),
      LocalStrategy= require('passport-local').Strategy,
      express      = require('express'),
      session      = require('express-session'),
      bodyParser   = require('body-parser'),
      cookieParser = require('cookie-parser'),
      crypto       = require('crypto'),
      emailer      = require('nodemailer'),
      //load schemas
      userschema   = require('./schema/user'),
      voluschema   = require('./schema/volunteer');
    

var dbUrl = 'mongodb://localhost:27017/volunteers';
//look for process variables (ie, we're deployed on open shift) to rewrite the url 
if (process.env.OPENSHIFT_MONGODB_DB_PASSWORD) {
    dbUrl = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
    process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
    process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
    process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
    process.env.OPENSHIFT_APP_NAME;
}

var User;
var Volunteer;

//TODO : create a new gmail account for volunteering . sources suggest that we can dispatch 99 emails a day this way.
// we may have to do some configurating on the account to make this happen. 
//var emailTransport = emailer.createTransport('smtps:tbd%40gmail.com:pass@smtp.gmail.com');
var emailTransport = {}; //emailer.createTransport('smtps:tbd%40gmail.com:pass@smtp.gmail.com');

mongoose.connect(dbUrl);
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error to db'));
//create collection roots
db.once('open', function() {
    User = mongoose.model('User', userschema.UserSchema);
    
    //do we have at least one user? 
    User.count({}, function(err, count) {
       if (count == 0) {
           createUser('admin', 'snarglepuss', 'oldshaghat@gmail.com', 0);
       } 
    });
    
    
    Volunteer = mongoose.model('Volunteer', voluschema.VolunteerSchema);
});

var app = express();

app.use(express.static('static'));
app.use('/bower', express.static(path.join(__dirname, 'bower_components')));
app.use(express.static('views'));
app.use(cookieParser());
app.use(bodyParser.urlencoded( { extended : true }));
app.use(bodyParser.json());
app.use(session( {
    secret : 'blinky foobar dongerdash',
    saveUninitialized : true,
    resave : true
})); //must precede passport session
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user.username);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use('local', new LocalStrategy( {
                            usernameField : 'username',
                            passwordField : 'password',
                            passReqToCallback : true
                        },
                   //verification method: 
                  function(req, username, password, done) {
                    User.findOne({ username: username }, function (err, user) {
                      if (err) { return done(err); }
                      if (!user) {
                        return done(null, false, { message: 'Incorrect username.' });
                      }
                      if (!user.validPassword(password)) {
                        return done(null, false, { message: 'Incorrect password.' });
                      }
                      return done(null, user);
                    });
                  }
));

function verifyAuth(req,res,next) {
  if ( !req.isAuthenticated() ) {
      return res.redirect('/');
  }
  next();
};

function validateNumber(n, defaultValue) {
    if (Number.isFinite(n)) {
        return n;
    }
    if (!Number.isNaN(Number.parseInt(n))) {
        return Number.parseInt(n);
    }
    return defaultValue;
};

function createUser(uname, pword, emailAddress, roleNumber) {
    var p = User.hashpw(pword);
    var u = new User({username : uname, password : p , email : emailAddress, role : roleNumber});
    u.save(function(err) {
        if (err) console.log(err);
    });  
};

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
};


////////////////////////////////////
/// API routes
////////////////////////////////////

//user management - view / edit registered users of the portal
app.get('/api/users', 
       verifyAuth,
       function(req, res) {
            User.find(function(err, users) {
                if (err) res.send(err);
                else
                res.json(users);
            });
});

app.post('/api/users', 
       verifyAuth,
       function(req, res) {
            //update a user  
            
            
            //return current list of users
            User.find(function(err, users) {
                if (err) res.send(err); else
                res.json(users);
            });
});

app.delete('/api/users', 
       verifyAuth,
       function(req, res) {
            //remove a user  
            
            //return current list of users
            User.find(function(err, users) {
                if (err) res.send(err); else
                res.json(users);
            });
});


//////////////////////////////////////
//volunteer management - view, search, edit, volunteers stored in the portal

function buildCriteria(req) {
    var criteria = {}; //we're going to AND together a set of clauses 
    var critList = []; 
    
    if (req.query.email) {
        critList.push({'email' : new RegExp(req.query.email, 'i')});
    }
    if (req.query.name) {
        //look at first or last name
        var reg = new RegExp(req.query.name, 'i');
        critList.push({'$or' : [ {'firstName' : reg}, {'lastName' : reg}]});
    }
    if (req.query.training) {
        var training = req.query.training;
        //we expect this to be a # 0 .. 4
        if (training == 0) {
            critList.push({'volunteerData.status.trainedCats' : {'$exists' : true}});
        } else if (training == 1) {
            critList.push({'volunteerData.status.trainedCatsPetsmart' : {'$exists' : true}});
        } else if (training == 2) {
            critList.push({'volunteerData.status.trainedDogs' : {'$exists' : true}});
        } else if (training == 3) {
            critList.push({'volunteerData.status.trainedRabbit' : {'$exists' : true}});
        } else if (training == 4) {
            critList.push({'volunteerData.status.trainedSmalls' : {'$exists' : true}});
        }
    }
    if (req.query.interests) {
        var interests = req.query.interests;
        //we expect this to be a # 0 .. 6
        if (interests == 0) {
            critList.push({'volunteerData.interests.cats' : {'$gt' : 0}});
        } else if (interests == 1) {
            critList.push({'volunteerData.interests.dogs' : {'$gt' : 0}});
        } else if (interests == 2) {
            critList.push({'volunteerData.interests.rabbits' : {'$gt' : 0}});
        } else if (interests == 3) {
            critList.push({'volunteerData.interests.smalls' : {'$gt' : 0}});
        } else if (interests == 4) {
            critList.push({'volunteerData.interests.maintenance' : {'$gt' : 0}});
        } else if (interests == 5) {
            critList.push({'volunteerData.interests.fundraising' : {'$gt' : 0}});
        } else if (interests == 6) {
            critList.push({'volunteerData.interests.events' : {'$gt' : 0}});
        }
    }
    if (req.query.availability) {
        var av = req.query.availability;
        //we expect this to be in the form x_y : day and time period  ...
        var dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        var timeNames = ['morning', 'afternoon', 'evening'];
        var tokes = av.split("_");
        var dayIndex = parseInt(tokes[0]);
        var timeIndex = parseInt(tokes[1]);
        var faccess = 'volunteerData.availability.' + dayNames[dayIndex] +'.' +timeNames[timeIndex];
        var o = {};
        o[faccess] = true;
        critList.push(o);
    }
    if (req.query.activeOnly) {
        critList.push({'volunteerData.activeVolunteer' : true});
    }
    //we want all of these supplied criteria to be true
    if (critList.length > 0) {
        criteria['$and'] = critList;
    }
    return criteria;
};

app.get('/api/volunteers/' , 
        verifyAuth,
        function (req, res) {
            if (req.query.id) {
                Volunteer.findOne({ _id: req.query.id }, function (err, v) {
                    if (err) 
                        res.send(err); 
                    else
                        res.json(v);
                });
            } else {
                //examine the query parameters for any other filters or criteria 
                var criteria = buildCriteria(req);
                
                //return current list of volunteers
                //plausibly we want to project here since this query drives a summary table
                var projection = {
                    
                };
                Volunteer.find(criteria, function(err, vtrs) {
                    if (err) 
                        res.send(err); 
                    else
                        res.json(vtrs);
                });
            }
});

//upserts
app.post('/api/volunteers/' , 
        verifyAuth,
        function (req, res) {
            //if the body doesn't supply an ID we are inserting a new one
            var oid = req.body._id;
            if (!oid) {
                oid = new mongoose.mongo.ObjectID();
            }
                
            //VALIDATION / defaulting
            var hoursValue = validateNumber(req.body.hoursWorked, 0); 
            var prefContact = validateNumber(req.body.contactPreference, 0); 
            var iCat = validateNumber(req.body.interestscats, -1);  
            var iDog = validateNumber(req.body.interestsdogs, -1);  
            var iRab = validateNumber(req.body.interestsrabbits, -1);  
            var iSml = validateNumber(req.body.interestssmalls, -1);  
            var iMnt = validateNumber(req.body.interestsmaintenance, -1);  
            var iFnd = validateNumber(req.body.interestsfundraising, -1);  
            var iEvt = validateNumber(req.body.interestsevents, -1);  
                
            Volunteer.findOneAndUpdate(
                { _id : oid },
                {   
                    email : req.body.email,
                    firstName : req.body.firstName,
                    lastName : req.body.lastName,
                    address : req.body.address,
                    phoneNumber : req.body.phoneNumber,
                    canGetSMS : req.body.canGetSMS,
                    contactPreference : prefContact,

                    //TODO should we check to see if we have any data to save first?
                    volunteerData : {
                        activeVolunteer : req.body.active,
                        specialNeeds : req.body.specialNeeds,
                        birthday : req.body.birthday,
                        started : req.body.started,
                        lastSeen : req.body.lastSeen,
                        hoursWorked : hoursValue,
                        notes : req.body.notes,
                        partners : req.body.partners,
                        emergencyContactName : req.body.emergencyContactName,
                        emergencyContactNumber : req.body.emergencyContactNumber,
                        emergencyContactRelationship   : req.body.emergencyContactRelationship,

                        status : {
                            waiver : req.body.statuswaiver,
                            oriented : req.body.statusoriented,
                            trainedCats : req.body.statustrainedCats,
                            trainedCatsPetsmart : req.body.statustrainedCatsPetsmart,
                            trainedDogs : req.body.statustrainedDogs,
                            trainedRabbit : req.body.statustrainedRabbit,
                            trainedSmalls : req.body.statustrainedSmalls
                        },

                        interests : {
                            cats : iCat,
                            dogs : iDog,
                            rabbits : iRab,
                            smalls : iSml,
                            maintenance : iMnt,
                            fundraising : iFnd,
                            events : iEvt
                        },

                        availability : {
                            monday : {
                                morning : req.body.availabilitymondaymorning,
                                afternoon : req.body.availabilitymondayafternoon,
                                evening : req.body.availabilitymondayevening
                            },
                            tuesday : {
                                morning : req.body.availabilitytuesdaymorning,
                                afternoon : req.body.availabilitytuesdayafternoon,
                                evening : req.body.availabilitytuesdayevening
                            },
                            wednesday : {
                                morning : req.body.availabilitywednesdaymorning,
                                afternoon : req.body.availabilitywednesdayafternoon,
                                evening : req.body.availabilitywednesdayevening
                            },
                            thursday : {
                                morning : req.body.availabilitythursdaymorning,
                                afternoon : req.body.availabilitythursdayafternoon,
                                evening : req.body.availabilitythursdayevening
                            },
                            friday : {
                                morning : req.body.availabilityfridaymorning,
                                afternoon : req.body.availabilityfridayafternoon,
                                evening : req.body.availabilityfridayevening
                            },
                            saturday : {
                                morning : req.body.availabilitysaturdaymorning,
                                afternoon : req.body.availabilitysaturdayafternoon,
                                evening : req.body.availabilitysaturdayevening
                            },
                            sunday : {
                                morning : req.body.availabilitysundaymorning,
                                afternoon : req.body.availabilitysundayafternoon,
                                evening : req.body.availabilitysundayevening
                            }
                        }
                    },

                    donorData : {

                    },

                    adopteeData : {

                    },
                    
                    boardingData : {
                        lastBoarded : req.body.boardingDate,
                        notes : req.body.boardingNotes
                    },
    
                    disqualifyingData : {
                        surrenderedAnimal : req.body.dqSurrenderDate,
                        failedVetCheck : req.body.dqFailedVetDate,
                        failedHomeInspection : req.body.dqFailedHomeDate,
                        notes : req.body.dqNotes
                    }
                        
                    
                },
                { upsert : true },
                 
                function(err, vol) {
                    if (err) {
                        console.log(err);
                        res.redirect('/vdb'); 
                    } else {
                        //how does this see the current state of the filters tho
                        var criteria = buildCriteria(req);
                        //return current list of volunteers
                        Volunteer.find(criteria, function(err, vtrs) {
                            if (err) res.send(err); else
                            res.json(vtrs);
                        });
                    }
                });
});

app.delete('/api/volunteers/' , 
        verifyAuth,
        function (req, res) {
            if (!req.query.id) {
                 Volunteer.find(function(err, vtrs) {
                    if (err) res.send(err);
                    res.json(vtrs);
                });
            }
            Volunteer.remove(
                { _id : req.query.id },
                function (err, r) {
                    //return current list of volunteers
                    Volunteer.find(function(err, vtrs) {
                        if (err) res.send(err);
                        res.json(vtrs);
                    });
                });
});

//////////////////////////////////////////
////// Views / pages

app.get('/vu',
       verifyAuth,
       function (req, res) {
            res.sendFile(__dirname + '/views/users/index.html');
});

app.get('/vdb',
       verifyAuth,
       function (req, res) {
            res.sendFile(__dirname + '/views/volunteers/index.html');
});

app.get('/sch',
       verifyAuth,
       function(req, res) {
            res.sendFile(__dirname + '/views/schedule/index.html') 
});

//TODO these should be over https not http
//http://stackoverflow.com/questions/5998694/how-to-create-an-https-server-in-node-js
app.post('/login',
  passport.authenticate('local'),
  function(req, res) {
    res.redirect('/vdb');
 });

app.post('/register', 
        verifyAuth,
        function(req, res) {
            //assert we aren't overwriting username 
            User.findOne({ username: req.body.username }, function (err, user) {
                      if (err) { return res.redirect('/');; }
                      if (!user) {
                            createUser(req.body.username, req.body.password);
                            res.sendStatus(200);
                      }
                    });
});

app.post('/passwordreset',
         function(req, res) {
            //check that the username exists
            User.findOne({ username: req.body.username }, function (err, user) {
                  if (err) { return res.redirect('/');; }
                  if (user && user.email) {
                        //generate and store a secret
                        user.generateNewResetSecret();
                        user.save(function(err) {
                            if (err) console.log(err);
                        });
                        //generate email to send to user
                        var hostnm = req.headers.hostname;  //or os.hostname() per http://stackoverflow.com/questions/7507015/get-hostname-of-current-request-in-node-js-express
                        var message = {
                            from : '"Lunas House Portal" <lunas_portal_admin@gmail.com>',
                            to : user.email,
                            subject : 'Password Reset Link',
                            text : 'To reset your password, visit http://' + hostnm + '/passwordreset?s=' + user.secret
                        };
                        emailTransport.sendMail(message, function(error, info) {
                            if (error) {
                                console.log("Message Error : " + error);
                            }
                           console.log("Message Sent : " + info.response); 
                        });
                        res.sendStatus(200);
                  }
                });
    
});

//throttle requests somehow?
app.post('/usernameLookup', function(req, res) {
    
});

//Open shift health monitoring
app.get('/health', function(req, res) {
    res.sendStatus(200);
});


//Route catcher
app.get('*', function(req, res) {
   res.redirect('/'); 
});

var server = http.createServer(app);

server.listen(env.NODE_PORT || 3000, env.NODE_IP || 'localhost', function () {
  console.log(`Application worker ${process.pid} started...`);
});

/*
let server = http.createServer(function (req, res) {
  let url = req.url;
  if (url == '/') {
    url += 'index.html';
  }

  // IMPORTANT: Your application HAS to respond to GET /health with status 200
  //            for OpenShift health monitoring

  if (url == '/health') {
    res.writeHead(200);
    res.end();
  } else if (url == '/info/gen' || url == '/info/poll') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.end(JSON.stringify(sysInfo[url.slice(6)]()));
  } else {
    fs.readFile('./static' + url, function (err, data) {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        let ext = path.extname(url).slice(1);
        res.setHeader('Content-Type', contentTypes[ext]);
        if (ext === 'html') {
          res.setHeader('Cache-Control', 'no-cache, no-store');
        }
        res.end(data);
      }
    });
  }
});

server.listen(env.NODE_PORT || 3000, env.NODE_IP || 'localhost', function () {
  console.log(`Application worker ${process.pid} started...`);
});
*/