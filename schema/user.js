var mongoose     = require('mongoose');
var crypto       = require('crypto');

/*
    Users of the web portal.
*/
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    username : String,
    password : String,      //hashed pw
    email : String,         //for pw resets
    role : Number,          // 0 normal ... 1 admin
    lastLogon : Date,
    secret : String         //for resets
});

/////I think that this mongoose file is going to stay in the server .. should I be reading the salt from an env. var? 
UserSchema.statics.hashpw = function (pw) {
    return crypto.pbkdf2Sync(pw, 'ok*^jkh9555kjh20hlkKHL*lj9fg7hohaouihwd', 10000, 512, 'sha512').toString('hex');
};

UserSchema.methods.generateNewResetSecret = function () {
    var data = new Date().getTime() + this.username + '9o8h98h32ngoi8h' + this.email;   
    var mess = crypto.pbkdf2Sync(data, '308975029375029', 100, 512, 'sha512').toString('hex');
    //take the first 36 characters of that
    this.secret = mess.substr(0,36);
    return this.secret;
};

UserSchema.methods.validPassword = function (pw) {
    //hash the pw before comparing
    var hashedPw = UserSchema.statics.hashpw(pw);
    
    if (hashedPw === this.password) {
        return true;
    }
    return false;
};

UserSchema.methods.isAdmin = function () {
  return this.role > 0;  
};


exports.UserSchema = UserSchema;