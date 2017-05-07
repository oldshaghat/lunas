var mongoose     = require('mongoose');

/*
    An animal either at Lunas, adopted out, or otherwise tracked 
*/


var AnimalSchema = new mongoose.Schema({
    
    //description
    name : String,
    kind : String,  
    breed : String,     //derived enum from kind value - see animalManagement.js 
    coloration : String,  //standard list? 
    size : String, // Small | Medium | Large | Very Large
    coat : String, // Short | Medium | Long | Rough | Curly | Hairless 
    approxWeight : Number, // in LBS
    birthday : Date,
    birthdayApproximated : Boolean, //do we know or just a guess?
    descriptionNotes : String, //other comments about appearance
    sex : String,
    
    //status 
    altered : Boolean, //spay or neuter
    alteredDate : Date,
    healthNotes : String, 
    microchipped : Boolean,
    chippedDate : Date,
    chipId : String,
    chipModel : String, // maybe? 
    housetrained : Boolean,

    status : String,
    fostered : Boolean,
    
    //cat only 
    isDeclawed : Boolean,
    fivlTested : Boolean, //also track FIV+ / FLV+ ? 
    fivPositive : Boolean,
    flvPositive : Boolean,
    
    //dog only
    heartwormTested : Boolean,
    heartwormPositive : Boolean,
    rabiesTag : String,
    
    
    //does this really matter? some of these are bonkers 
   // surrenderReason : String, // Abandoned, Abuse, Allergies, Biting, Died (owner?), Relationship / Marital Issue, Sick / Injured (who, the pet or the caregiver?), Stray, Can't Afford, Can't Cope, Unsuitable Accomodation
    //should be in the notes for the transfer anyway
    
    pictures : [ {
       fileName : String,
        description : String
    }],
    
    //behavioral notes ? 
    getsAlongWithCats : Boolean,
    getsAlongWithDogs : Boolean,
    getsAlongWithKids : Boolean,
    //etc?
    
    //relationships with other animals? 
    //was this part of a litter? siblings? 
    //bonded with ?
    litterNotes : String,
    bondedWith : String, // free text ? list of names / references to other animals? 
    
    

    
    //we want to track 
    //   animals coming in (so @ lunas)
    //   animals going out (so to some person hopefully in the volunteer database but we can't know that for sure )
    transfers : [ {
        date : Date,
        kind : String, // (incoming) Surrender, Transfer In, Stray, Animal Control, Return, (outgoing) Adoption, Deceased, Transfer Out
        origin : String, //string data
        originType : String, // Lunas | Individual Name | Shelter Name | N/A //enum data 
        dest : String,
        destType : String, // Lunas | Individual Name | Shelter Name | N/A
        originRefId : String, //optional obj id of volunteer id for origin
        destRefId : String, //optional obj id of volunteer id for destination
        notes : String
    }]
    //Movements : Reservation (?), Adoption, Foster, Transfer, Escaped, Reclaimed, Stolen, Released to Wild, Retailer (?)
    //this means we would infer current location (status)
    //by looking at the last transfer (by date)
});


exports.AnimalSchema = AnimalSchema;