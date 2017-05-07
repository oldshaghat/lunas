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
      voluschema   = require('./schema/volunteer'),
      animalschema   = require('./schema/animal'),
      schSchema    = require('./schema/schedule');

    

var dbUrl = 'mongodb://localhost:27017/volunteers';
//look for process variables (ie, we're deployed on open shift) to rewrite the url 
if (process.env.OPENSHIFT_MONGODB_DB_PASSWORD) {
    dbUrl = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
    process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
    process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
    process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
    process.env.OPENSHIFT_APP_NAME;
}

//Data Access Obj.
var User;
var Volunteer;
var Schedule;
var Animal;

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
    Schedule = mongoose.model('Schedule', schSchema.ScheduleSchema);
    Animal = mongoose.model('Animal', animalschema.AnimalSchema);
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
    if (typeof n === "undefined") {
        return defaultValue;
    }
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
            if (req.body.id) {
                 User.findOne({ _id: req.body.id }, 
                            function (err, user) {
                                 if (user) {
                                     user.email = req.body.email;
                                     user.role = req.body.role;
                                     user.save(
                                         function(err) {
                                                if (err) console.log(err);
                                            });
                                 }
                            });
            }
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

const itemsPerPage = 20;
//look for page# parameter on the query - if not found assume first page
function buildPagination(req) {
    var page = req.query.page || 0;
    return { skip : page*itemsPerPage, limit : itemsPerPage};
};

function buildCriteria(req) {
    var criteria = {}; //we're going to AND together a set of clauses 
    var critList = []; 
    
    if (req.query.email) {
        critList.push({'email' : new RegExp(req.query.email, 'i')});
    }
    if (req.query.name) {
        //if name term contains a space they might be typing a first name part and a last name part or vice versa (search for smith bob vs bob smith)
        if (req.query.name.indexOf(' ') > 0) {
            //what if we're looking for some name via three pieces? haha
            var tokes = req.query.name.split(' ');
            var fnReg = new RegExp(tokes[0].trim(), 'i');
            var lnReg = new RegExp(tokes[1].trim(), 'i');
            critList.push({'$or' : [ {'firstName' : fnReg}, {'lastName' : lnReg}]});
        } else {
            //use same regex for both
            var reg = new RegExp(req.query.name, 'i');
            critList.push({'$or' : [ {'firstName' : reg}, {'lastName' : reg}]});
        }
    }
    if (req.query.training) {
        var training = req.query.training;
        //we expect this to be a # 0 .. 8
        var fields = ['trainedCats', 'trainedCatsPetsmart', 'trainedDogs', 'trainedRabbit', 'trainedSmalls', 'trainedCatsQuarantine', 'trainedDogsQuarantine', 'trainedRabbitQuarantine', 'trainedSmallsQuarantine'];
        var fname = 'volunteerData.status.' + fields[training];
        var c = {};
        c[fname] = {'$exists' : false};
        critList.push(c);
    }
    if (req.query.interests) {
        var interests = req.query.interests;
        //we expect this to be a # 0 .. 6
        var fields = ['cats', 'dogs', 'rabbits', 'smalls', 'maintenance', 'fundraising', 'events']; //TODO add new interests to filter support
        var fname = 'volunteerData.interests.' + fields[interests];
        var c = {}; 
        c[fname] = {'$gt' : 0};
        critList.push(c);
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
    if (req.query.age) {
        //back calculate the birthday
        var age = req.query.age; 
        var bday = new Date(); 
        bday.setFullYear(bday.getFullYear() - age);
        critList.push({'volunteerData.birthday' : {$lte : bday}});
    }
    //we want all of these supplied criteria to be true
    if (critList.length > 0) {
        criteria['$and'] = critList;
    }
    return criteria;
};

function volunteerTableQuery(req, res) {
        //examine the query parameters for any other filters or criteria 
        var criteria = buildCriteria(req);
        var options = buildPagination(req);
        //return current list of volunteers
        //plausibly we want to project here since this query drives a summary table
        var projection = {

        };
        //count in this filter set
        Volunteer.count(criteria, function(err, c) {
            var pageCount = c / itemsPerPage;
            Volunteer.find(criteria, projection, options).sort('lastName').exec(function(err, vtrs) {
                if (err) 
                    res.send(err); 
                else {
                    var paginateData = {pageCount : pageCount, data : vtrs};
                    res.json(paginateData);
                }
            });
        });
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
                volunteerTableQuery(req, res);
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
            var validatedNoShows = validateNumber(req.body.noShows, 0);
            var prefContact = validateNumber(req.body.contactPreference, 0); 
            var iCat = validateNumber(req.body.interestscats, -1);  
            var iDog = validateNumber(req.body.interestsdogs, -1);  
            var iRab = validateNumber(req.body.interestsrabbits, -1);  
            var iSml = validateNumber(req.body.interestssmalls, -1);  
            var iMnt = validateNumber(req.body.interestsmaintenance, -1);  
            var iFnd = validateNumber(req.body.interestsfundraising, -1);  
            var iEvt = validateNumber(req.body.interestsevents, -1);  
            var iFos = validateNumber(req.body.interestsfostercare, -1);
            var iAdo = validateNumber(req.body.interestsadoptereducation, -1);
            var iDon = validateNumber(req.body.interestsdonationtransport, -1);
            var iHum = validateNumber(req.body.interestshumaneeducation, -1);
    
            Volunteer.findOneAndUpdate(
                { _id : oid },
                {   
                    email : req.body.email,
                    firstName : req.body.firstName,
                    lastName : req.body.lastName,
                    address : req.body.address,
                    city : req.body.city,
                    state : req.body.state,
                    zip : req.body.zip,
                    phoneNumber : req.body.phoneNumber,
                    alternatePhoneNumber : req.body.altPhoneNumber,
                    workPhoneNumber : req.body.workPhoneNumber,
                    canGetSMS : req.body.canGetSMS,
                    contactPreference : prefContact,
                    doNotEmail : req.body.doNotEmail,
                    contactNotes : req.body.contactNotes,

                    //TODO should we check to see if we have any data to save first?
                    volunteerData : {
                        activeVolunteer : req.body.active,
                        specialNeeds : req.body.specialNeeds,
                        foster : req.body.foster,
                        fostering : req.body.fostering,
                        noShows : validatedNoShows,
                        birthday : req.body.birthday,
                        started : req.body.started,
                        lastSeen : req.body.lastSeen,
                        hoursWorked : hoursValue,
                        notes : req.body.notes,
                        partners : req.body.partners,
                        dependents : req.body.dependents,
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
                            trainedSmalls : req.body.statustrainedSmalls,
                            trainedCatsQuarantine : req.body.statustrainedCatsQuarantine,
                            trainedDogsQuarantine : req.body.statustrainedDogsQuarantine,
                            trainedRabbitQuarantine : req.body.statustrainedRabbitQuarantine,
                            trainedSmallsQuarantine : req.body.statustrainedSmallsQuarantine
                        },

                        interests : {
                            cats : iCat,
                            dogs : iDog,
                            rabbits : iRab,
                            smalls : iSml,
                            maintenance : iMnt,
                            fundraising : iFnd,
                            events : iEvt,
                            fosterCare : iFos,
                            adopterEducation : iAdo,
                            donationTransport : iDon,
                            humaneEducation : iHum
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
                            },
                            notes : req.body.availabilitynotes
                        }
                    },

                    donorData : {
                        gifts : req.body.donorDataGifts
                    },

                    adopteeData : {
                        adoptions : req.body.adopteeDataAdoptions
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
                        volunteerTableQuery(req, res);
                    }
                });
});

//what's the RESTful way to do this I wonder? probably not exactly this.
//I suppose it's an edit of a particular property but I don't want to get and then set it 
//but I might want to decrement it too 
//maybe api/vol/:vid/noshows/inc or /dec ? in terms of idempotentcy I guess I really would want to read it, update it outside the api, and submit back the 
//new correct value
app.post('/api/volunteers/:vid/noshows/inc',
         verifyAuth,
         function(req, res) {
            var criteria = {_id : req.params.vid};
            var updateOp = { '$inc' : { 'volunteerData.noShows' : 1}};
            Volunteer.findOneAndUpdate(criteria, updateOp, function(err, r) {
                if (err) console.log(err);
            });
    
});
app.post('/api/volunteers/:vid/noshows/dec',
         verifyAuth,
         function(req, res) {
            var criteria = {_id : req.params.vid};
            var updateOp = { '$inc' : { 'volunteerData.noShows' : -1}};
            Volunteer.findOneAndUpdate(criteria, updateOp, function(err, r) {
                if (err) console.log(err);
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
            //Also / first remove this volunteer from any schedules
            Schedule.remove ({volunteerId : req.query.id}).exec();
            Volunteer.remove(
                { _id : req.query.id },
                function (err, r) {
                    volunteerTableQuery(req, res);
                });
});

//////////////////
/// Animals API

function buildAnimalCriteria(req) {
    var criteria = {}; //we're going to AND together a set of clauses 
    return criteria;
};

function animalTableQuery(req, res) {
    //examine the query parameters for any other filters or criteria 
    var criteria = buildAnimalCriteria(req);
    var options = buildPagination(req);
    //return current list of animals
    //plausibly we want to project here since this query drives a summary table
    var projection = {

    };
    //count in this filter set
    Animal.count(criteria, function(err, c) {
        var pageCount = c / itemsPerPage;
        Animal.find(criteria, projection, options).sort('name').exec(function(err, vtrs) {
            if (err) 
                res.send(err); 
            else {
                var paginateData = {pageCount : pageCount, data : vtrs};
                res.json(paginateData);
            }
        });
    });
};

app.get('/api/animals/',
       verifyAuth,
       function(req, res) {
            if (req.query.id) {
                Animal.findOne({ _id: req.query.id }, function (err, a) {
                    if (err) 
                        res.send(err); 
                    else
                        res.json(a);
                });
            } else {
                animalTableQuery(req, res);
            }
});

app.post('/api/animals/',
       verifyAuth,
       function(req, res) {
            //if the body doesn't supply an ID we are inserting a new one
            var oid = req.body._id;
            if (!oid) {
                oid = new mongoose.mongo.ObjectID();
            }
            //VALIDATION / defaulting
//            var hoursValue = validateNumber(req.body.hoursWorked, 0); 
        Animal.findOneAndUpdate(
                { _id : oid },
            req.body,       //maybe we can just ... pass the body directly? 
            { upsert : true },
            function(err, ani) {
                if (err) {
                    console.log(err);
                    res.redirect('/adb'); 
                } else {
                    animalTableQuery(req, res);
                }
            });
});

app.delete('/api/animals/',
       verifyAuth,
       function(req, res) {
            if (!req.query.id) {
                 Animal.find(function(err, animals) {
                    if (err) res.send(err);
                    res.json(animals);
                });
            }
            //Also / first remove this volunteer from any schedules
           Animal.remove(
                { _id : req.query.id },
                function (err, r) {
                    animalTableQuery(req, res);
                });
});

///////////////////////////
///// Schedule API

app.get('/api/schedule/:year/:month', 
       verifyAuth,
       function (req, res) {
            var criteria = {};
            
            criteria['year'] = req.params.year;
            criteria['month'] = req.params.month;
            Schedule.find(criteria, function(err, scheduledItems) {
                    if (err) res.send(err);
                    res.json(scheduledItems);
                });
});

//assume form data in body is either new event or edit of existing event
//should we also allow posting to api/schedule/2017/11/ ? 
app.post('/api/schedule', 
       verifyAuth,
       function (req, res) {
            //check for upserts
            var oid = req.body._id;
            if (!oid) {
                oid = new mongoose.mongo.ObjectID();
            }
            var validatedTeamSize = validateNumber(req.body.teamSize, 1);
            var validatedTimeSlot = validateNumber(req.body.timeslot, 0);
            var validatedAssignment = validateNumber(req.body.assignment, 0);

            //if the form passes a date object, extract these values instead of the year/month/day set
            var valYear = req.body.year;
            var valMonth = req.body.month;
            var valDate = req.body.day;
            if (req.body.scheduledDate) {
                valYear = req.body.scheduledDate.getFullYear();
                valMonth = req.body.scheduledDate.getMonth();
                valDate = req.body.scheduledDate.getDate();
            }

            Schedule.findOneAndUpdate(
                { _id : oid },
                {
                    volunteerId : req.body.volunteerId,
                    year : valYear,
                    month : valMonth,
                    dayOfMonth : valDate,
                    timeslot : validatedTimeSlot,               // 0, 1, 2 : Morning, Afternoon, Evening
                    assignment : validatedAssignment,           //0 cats, 1 catsP, 2 dogs, 3 rab, 4 smalls
                    teamSize : validatedTeamSize,               //how many people in the team (usually 1 but parent child or whatever counts as more)
                    notes : req.body.notes,                      //optional text to accompany event - like fixed arrival time if a Tuesday
                    arrivalTime : req.body.arrivalTime,
                    noShow : req.body.noShow
                },
                { upsert : true },
                 
                function(err, sch) {
                    if (err) {
                        console.log(err);
                        res.redirect('/sch'); 
                    } else {
                        res.json(sch);
                    }
                });
});

//delete an event by id
app.delete('/api/schedule', 
       verifyAuth,
       function (req, res) {
            if (!req.query.id) {
                res.redirect('/sch'); 
            }
            Schedule.remove(
                { _id : req.query.id },
                function (err, r) {
                     if (err) {
                        console.log(err);
                     }
                    res.json(r);
                });
    
});

//strange misfit toy API route for doing a delete-all-forward call
app.delete('/api/scheduleBatch',
          verifyAuth,
          function(req, res) {
            if (!req.query.id) {
                res.redirect('/sch'); 
            }
            var volunteerId = req.query.id;
            var deleteForwardFromDate = new Date(req.query.date);
            var year = deleteForwardFromDate.getFullYear();
            var month = deleteForwardFromDate.getMonth();
            var day = deleteForwardFromDate.getDate();
            //we want to delete things that happen after this time but we can't do multiplicative criteria
            //so that's everything in the next year; or everything that is this year and next month, or everything that is this year and month and the next day
            var clauses = [];
            clauses.push({'year' : {'$gt' : year}}); //delete everything in following years
            clauses.push({'$and' : [{'year' : year, 'month' : {'$gt' : month}}]}); //delete everything this year that happens at a later month
            clauses.push({'$and' : [{'year' : year, 'month' : month, 'dayOfMonth' : {'$gte' : day}}]}); //delete everything this month that happens today or later.
            Schedule.remove(
                { 
                    'volunteerId' : volunteerId,
                    '$or' : clauses
                },
                function (err, r) {
                     if (err) {
                        console.log(err);
                     }
                    res.json(r);
                });
});


///////// Mongo Can't Join -- Joey doesn't share food ///////
app.post('/api/vsj',
       verifyAuth, 
       function(req, res) {
            var idList = req.body.ids;
            if (idList) {
                var oidList = idList.map(function(id) { return new mongoose.mongo.ObjectID(id)});
                var criteria = {'_id' : { '$in' : oidList}};
                //we don't want everything
                var projection = { 'firstName' : 1, 'lastName' : 1, 'volunteerData.status' : 1 };
                
                Volunteer.find(criteria, projection, function (err, results) {
                    if (err) {
                        console.log(err);
                    }
                    res.json(results);
                });
            }
    
});

//////////////////
//// Report API

app.get('/api/report/email',
       verifyAuth,
       function(req, res) {
            var excludeMinors = req.query.excludeMinors;
            var respectOptOut = req.query.respectOptOut;
            var skipInactive = req.query.skipInactive;
            var skipDisqualified = req.query.skipDisqualified;
    
            var minorsBornAfter = new Date();
            minorsBornAfter.setFullYear(minorsBornAfter.getFullYear() - 18);
    
            var deDuplicate = req.query.deDuplicate;
    
            var projection = {'email' : 1};
            var criteria = {
                'email' : {'$ne' : null},
            };
    
            if (excludeMinors != 'false') {
                criteria['volunteerData.birthday'] = {'$lte' : minorsBornAfter};
            }
            if (respectOptOut != 'false') {
                criteria['doNotEmail'] = {'$in' : [null, false]};
            }
            if (skipInactive != 'false') {
                criteria['volunteerData.activeVolunteer'] = true;
            }
            if (skipDisqualified != 'false') {
                criteria['disqualifyingData.surrenderedAnimal'] =  null;
                criteria['disqualifyingData.failedVetCheck'] =  null;
                criteria['disqualifyingData.failedHomeInspection'] =  null;
                criteria['disqualifyingData.notes'] =  null;
            }
            Volunteer.find(criteria, projection, function (err, results) {
                    if (err) {
                        console.log(err);
                    }
                    //manual distinct since mongoose doesn't like to do projection + distincting
                    if (deDuplicate != 'false') {
                        results = Array.from(new Set(results.map(
                              function (s) {
                                  return s.email;
                              }
                          )));
                    } else {
                        results = results.map(function(s) {return s.email;});
                    }
                    res.json(results);
                });
});


app.get('/api/report/emergencyContact',
       verifyAuth,
       function(req, res) {
            var skipInactive = req.query.skipInactive;
            var projection = {
                'email' : 1, 
                'firstName' : 1, 
                'lastName' : 1, 
                'volunteerData.emergencyContactName' : 1,
                'volunteerData.emergencyContactNumber' : 1
            };
            var criteria = {
                '$or' : [{'volunteerData.emergencyContactName' : null}, {'volunteerData.emergencyContactNumber' : null}]
            };
    
            if (skipInactive != 'false') {
                criteria['volunteerData.activeVolunteer'] = true;
            }
    
            Volunteer.find(criteria, projection, function (err, results) {
                    if (err) {
                        console.log(err);
                    }
                    res.json(results);
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

app.get('/adb',
       verifyAuth,
       function (req, res) {
            res.sendFile(__dirname + '/views/animals/index.html');
});

app.get('/sch',
       verifyAuth,
       function(req, res) {
            res.sendFile(__dirname + '/views/schedule/index.html') 
});

app.get('/rpt',
       verifyAuth,
       function(req, res) {
            res.sendFile(__dirname + '/views/report/index.html') 
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
                            createUser(req.body.username, req.body.password, req.body.email, req.body.role);
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