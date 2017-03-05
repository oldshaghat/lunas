var mongoose     = require('mongoose');

/*
    An animal either at Lunas, adopted out, or otherwise tracked 
*/


var AnimalSchema = new mongoose.Schema({
    
    name : String,
    kind : String,  // Dog | Cat | Rabbit | Hamster | Gerbil | Guinea Pig | Chinchilla | Bird | Lizard | Turtle | Rat | Mouse 
    breed : String,     //derived enum from kind value
    coloration : String,
    sex : String,
    spayedOrNeutered : Boolean,
    
    notes : String,
    
    
    //we want to track 
    //   animals coming in (so @ lunas)
    //   animals going out (so to some person hopefully in the volunteer database but we can't know that for sure )
    transfers : [ {
        date : Date,
        kind : String, // (incoming) Surrender, Transfer In, Stray, (outgoing) Adoption, Deceased, Transfer Out
        origin : String, // Lunas | Individual Name | Shelter Name | N/A
        dest : String, // Lunas | Individual Name | Shelter Name | N/A
        originRefId : String, //optional obj id of volunteer id for origin
        destRefId : String, //optional obj id of volunteer id for destination
        notes : String
    }]
                     
});


exports.AnimalSchema = AnimalSchema;