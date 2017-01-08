var mongoose     = require('mongoose');

/*
A volunteer - really any sort of relationship to Lunas
*/


var VolunteerSchema = new mongoose.Schema({
    email : String,
    firstName : String,
    lastName : String,
    address : String,
    city : String,
    state : String,
    zip : String,
    phoneNumber : String,
    alternatePhoneNumber : String,
    canGetSMS : Boolean,
    contactPreference : Number, //0 : Email, 1 : Phone, 2 : TxtMsg (implies canGetSMS?)

    //Does this person volunteer at the shelter?
    volunteerData : {
        activeVolunteer : Boolean,
        specialNeeds : Boolean,
        foster : Boolean,
        fostering : String,
        noShows : Number,
        birthday : Date,
        started : Date,
        lastSeen : Date, //or ... active? 
        hoursWorked : Number,  //wee bit of future proofing
        notes : String,
        partners : String,  //who supervises me (if anyone)
        dependents : String, //who do I supervise (if anyone)
        emergencyContactName : String,
        emergencyContactNumber : String,
        emergencyContactRelationship : String,
        
        //status
        //orient and training should have dates
        status : {
            waiver : Boolean,
            oriented : Date,
            trainedCats : Date,
            trainedCatsPetsmart : Date,
            trainedCatsQuarantine : Date,
            trainedDogs : Date,
            trainedDogsQuarantine : Date,
            trainedRabbit : Date,
            trainedRabbitQuarantine : Date,
            trainedSmalls : Date,
            trainedSmallsQuarantine : Date
        },
    
        //0 or <0 : no interest; then 1 high priority .. 10 lower priority
        //interests 
        interests  : {
            cats : Number,
            dogs : Number,
            rabbits : Number,
            smalls : Number,
            maintenance : Number,
            fundraising : Number,
            events : Number
        },
    
        //availability 
        availability : {
            monday : {
                morning : Boolean,
                afternoon : Boolean,
                evening : Boolean
            },
            tuesday : {
                morning : Boolean,
                afternoon : Boolean,
                evening : Boolean
            },
            wednesday : {
                morning : Boolean,
                afternoon : Boolean,
                evening : Boolean
            },
            thursday : {
                morning : Boolean,
                afternoon : Boolean,
                evening : Boolean
            },
            friday : {
                morning : Boolean,
                afternoon : Boolean,
                evening : Boolean
            },
            saturday : {
                morning : Boolean,
                afternoon : Boolean,
                evening : Boolean
            },
            sunday : {
                morning : Boolean,
                afternoon : Boolean,
                evening : Boolean
            },
            notes : String
        }         
    },
    
    //do they write checks to Luna's
    donorData : {
        gifts : [{dateOfGift : Date, amountOfGift : Number}]
    },
    
    //have they adopted an animal from Luna's?
    adopteeData : {
        adoptions : [{animalName : String, animalKind : String, adoptionDate : Date}]
    },
    
    //do they board their animals at Luna's
    boardingData : {
        lastBoarded : Date,
        notes : String
    },
    
    //any reason we don't want to do business with them?
    disqualifyingData : {
        surrenderedAnimal : Date,
        failedVetCheck : Date,
        failedHomeInspection : Date,
        notes : String
    }
                     
});


exports.VolunteerSchema = VolunteerSchema;