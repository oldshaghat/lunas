var mongoose     = require('mongoose');

/*
A schedule - a list of people / time events  : person on day for assignment and timeslot
We can multiple book (see cats) - not constrained
Schedule elements can be eliminated or edited individually

But how do we do recurrences? 
That's someone saying "book me in this time (weekly, first friday, whatever) for this assignment for a bunch of time in advance"

One option is to leave it in the UI : when I book someone I specify a repeat / recur step and we create a bunch of entries
And then if they want to extend something in the UI lets click on an existing booking and re-book it and let them pick the 
recurrance options again

Goog Cal treats recurrances as first class things

if we don't do that, we might need to have things like "cancel all future appts for this person" 

so this is really a list of 'events'

*/


var ScheduleSchema = new mongoose.Schema({
    
    volunteerId : String,   //this is the "team lead" id
    volunteerInitials : String, // the initials of the team lead
    year    : Number,       //four digit year for event 
    month   : Number,       //0 based (js Date style) month of event
    dayOfMonth : Number,    //1 based (js Date style) day of month (new Date().getDate())
    timeslot : Number, // 0, 1, 2 : Morning, Afternoon, Evening
    assignment : Number, //0 cats, 1 catsP, 2 dogs, 3 rab, 4 smalls
    teamSize : Number, //how many people in the team (usually 1 but parent child or whatever counts as more)
    notes : String  //optional text to accompany event - like fixed arrival time if a Tuesday
});


exports.ScheduleSchema = ScheduleSchema;