var scheduleManagement = angular.module('scheduleManagement', ['ngMaterial']);

scheduleManagement.controller('ScheduleManagementController', function ScheduleManagementController($scope, $http, $mdDialog) {
    
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var classes = ['cats', 'catsP', 'dogs', 'rabbits', 'smalls'];
    var assignments = ["Cats", "PetSmart Cats", "Dogs", "Rabbits", "Smalls"];
    var times = ["Morning", "Afternoon", "Evening"];
    var qtrains = [ 'trainedCatsQuarantine','trainedCatsQuarantine','trainedDogsQuarantine','trainedRabbitQuarantine','trainedSmallsQuarantine'];
    
    var unschClass= 'unscheduled';
    
    function escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    };
    
    $scope.today = new Date();
    $scope.viewingDate = $scope.today;
    
    $scope.monthData = [];          
    $scope.weekData = [];           
    $scope.dayData = []; 
    $scope.schedule = [];
    
    $scope.tabSelect = 0;
    
    $scope.jumpToDay = function(date) {
        if (!date) return;
        
        //check if date is in a different month
        if (date.getMonth() != $scope.viewingDate.getMonth()) {
            $scope.viewingDate = date;
            loadScheduleData()
        } else {
            $scope.viewingDate = date;
            selectDayData();  //from month data
        }
        
        $scope.tabSelect = 0;
    };
    
    //load schedule information for the month around the viewing date
    function loadScheduleData() {
        var year = $scope.viewingDate.getFullYear();
        var month = $scope.viewingDate.getMonth();
        $http.get('/api/schedule/' + year + '/' + month)
        .then(function(data) {
            $scope.schedule = data.data;
            rejoinVolunteerData();
            
        }, function(err) {
            console.log(err);
        });
    };
    
    loadScheduleData();
    
    function rejoinVolunteerData() {
        //collect vol. ids and get that data
        var allVolIds = extractVolunteerIds();
        var postData = {ids : allVolIds};
        $http.post('/api/vsj', postData)
            .then(function(data) {
                $scope.volunteerData = data.data;
                rebuildAll();
            }, function(err) {
                console.log(err);
            });
    };
    
    function extractVolunteerIds() {
      return Array.from(new Set($scope.schedule.map(
          function (s) {
              return s.volunteerId;
          }
      )));
    };
    
    function rebuildAll() { 
        rebuildMonth();
       // selectWeekData(); //from month data
        selectDayData();  //from month data
    };
    
    function rebuildMonth() {
        $scope.monthData = []; 
        //add padding days to align the cal. consistently at start and end
        var d = new Date($scope.viewingDate); //copy
        d.setDate(1);  //day of month starts at 1 not 0 
        for (var p = 0; p < d.getDay(); p++) {
            addPaddingDay(d, p - d.getDay());
        }
        while(d.getMonth() == $scope.viewingDate.getMonth()) {
            addScheduleDay(d);
            d.setDate(d.getDate() + 1);
        }
        for (var p = d.getDay(); p < 7; p++) {
            addPaddingDay(d, p - d.getDay());
        }
    };
    
    //date is the reference day for the offset : either before or after it 
    //offset is how many days before or after the reference date we are
    function addPaddingDay(date, dayOffset) {
        var padder = {};
        padder.jobs = 1;
        padder.slots = 1;
        padder.rowHeight = "1:1";
        padder.topClass = "outOfBoundsDay";
        padder.events = [];
        var pd = new Date(date);
        pd.setDate(date.getDate() + dayOffset);
        padder.date = pd;
        padder.label = pd.getDate();
        $scope.monthData.push(padder);
    };
    
    //some set of events for a day
    function addScheduleDay(date) {
        var sched = {};
        sched.jobs = 5;
        sched.slots = 3;
        sched.rowHeight = "1:1";
        sched.topClass = "";
        sched.date = new Date(date);
        sched.label = date.getDate();
        sched.events = [];
        for (var t = 0; t < 3; t++) {
            for (var j = 0; j < 5; j++) {
                var e = {eventClass : unschClass};
                e.timeslot = t;
                e.assignment = j;
                
                var d = searchData(date, t, j);
                if (d.length > 0) {
                    e.eventClass = classes[j];
                    e.data = d; //possibly more than one
                    e.bookings = formatScheduledSlotData(d);
                }
                
                sched.events.push(e);
            }
        }
        
        $scope.monthData.push(sched);
    };
    
    function searchData(date, timeslot, assignment) {
        var matches = [];
        for (var i = 0; i < $scope.schedule.length; i++) {
            var e = $scope.schedule[i];
            //check year and month is prob not needed?
            if (e.dayOfMonth == date.getDate() && e.timeslot == timeslot && e.assignment == assignment) 
                matches.push(e);
        }
        return matches;
    }
    
    function selectWeekData() {
        $scope.weekData = [];
        var copy = new Date($scope.viewingDate);
        var dow = copy.getDay();
        var date = copy.getDate();
        
        for (var i = 0; i < 7; i++) {
            copy.setDate(date - dow + i);
            var d = getDayData(copy);
            $scope.weekData.push(d);
        }
        
    };  //from month data
    
    function selectDayData() {
        var d = getDayData($scope.viewingDate);
        $scope.dayData = d.events;
        
    };  //from month data
    


    function formatScheduledSlotData (data) {
        var bookings = [];
        for (var i = 0; i < data.length; i++) {
            var d = data[i].volunteerId;
            var v = lookupVolunteer(d);
            var booking = {};
            booking.id = data[i]._id;
            booking.volunteerId = d;
            var firstName = v.firstName || "";
            var lastName = v.lastName || "";
            booking.volunteerName = firstName + ' ' + lastName;
            booking.volunteerInitials = (firstName.substr(0,1) + lastName.substr(0,1)).toUpperCase();
            booking.teamsize = data[i].teamSize;
            booking.notes = data[i].notes;
            booking.arrivalTime = data[i].arrivalTime;
            booking.noShow = data[i].noShow;
            //which q do we want? 
            var stat = v.volunteerData.status;
            var qField = qtrains[data[i].assignment];
            booking.qFlag = stat[qField] ? 1 : 0;
            //add a warno if missing orientation, or something else?
            
            bookings.push(booking);
        }
        return bookings;
    };
    
    function lookupVolunteer(vid) {
        for ( var i = 0; i < $scope.volunteerData.length; i++) {
            var v = $scope.volunteerData[i];
            if (v._id === vid)
                return v;
        }
        return null;
    };
    
    /*
    volunteerId : String,   //this is the "team lead" id
    year    : Number,       //four digit year for event 
    month   : Number,       //0 based (js Date style) month of event
    dayOfMonth : Number,    //1 based (js Date style) day of month (new Date().getDate())
    timeslot : Number, // 0, 1, 2 : Morning, Afternoon, Evening
    assignment : Number, //0 cats, 1 catsP, 2 dogs, 3 rab, 4 smalls
    teamSize : Number, //how many people in the team (usually 1 but parent child or whatever counts as more)
    notes : String  //optional text to accompany event - like fixed arrival time if a Tuesday
    */

    function getDayData(date) {
        if (!date) return null;
        var dayOfMonth = date.getDate();
        for (var i = 0; i < $scope.monthData.length; i++){
            var d = $scope.monthData[i];
            if (d.date.getMonth() === date.getMonth() && d.date.getDate() === date.getDate()){
                return d;
            }
        } 
        return null;
    };
    
    

    
    //open a dialog box to either edit or insert new schedule data for this date / assignment / timeslot
    $scope.upsertSchedule = function(ev, date, slotData, bookingData) {
        
        if (!date) return;
        
        var data = {};
        data.assignment = slotData.assignment;
        data.timeslot = slotData.timeslot;
        data.date = date;
        
        if (bookingData) {
            data.id = bookingData.id;
            data.volunteerId = bookingData.volunteerId;
            data.volunteerName = bookingData.volunteerName;
            data.notes = bookingData.notes;
            data.teamSize = bookingData.teamsize;
            data.arrivalTime = bookingData.arrivalTime;
            data.noShow = bookingData.noShow;
            data.qFlag = bookingData.qFlag;
        }
        
        //. .... can I just ... push the booking data in? is this silly?
            
        $mdDialog.show({
            templateUrl: 'schedule/scheduleEventEditDialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose:true,
            fullscreen: false,
            locals : {src : data},
            controller: DialogController,
        })
        .then(function(answer) {
            if (answer.action == 'save') {
                saveData(answer, date, slotData); 
            } else if (answer.action == 'noshow') {
                markNoShow(answer, date, slotData);
            } else if (answer.action == 'delete') {
                deleteData(answer);
            } else if (answer.action == 'deleteall') {
                deleteAllFutureData(answer, date);
            }
            
        }, function() {
            //dialog cancelled
        });
    };
    
///////////////////////////   
//dialog actions :
    
    function saveData(answer, date, slotData) {
        //we might be wanting to update a record, insert a record, remove one or more records ... 
        if (answer && answer.selectedVolunteer && answer.selectedVolunteer.id) {
            var d = {};
            if (answer.id) {
                d._id = answer.id;
            }
            d.volunteerId = answer.selectedVolunteer.id;
            d.year = date.getFullYear();
            d.month = date.getMonth();
            d.day = date.getDate();
            d.timeslot = slotData.timeslot;
            d.assignment = slotData.assignment;
            d.teamSize = answer.teamsize;
            d.arrivalTime = answer.arrivalTime;
            d.notes = answer.notes;
            d.noShow = answer.noShow;
            $http.post('/api/schedule', d)
                .then(function(r) {
                    //add it to the local data model / update 
                    //oh but I need the new id and the post isn't giving it up here .. shit
                    //so I guess I just ask for everything again. Ugh.
                    loadScheduleData();
                }, function(e) {
                    console.log(e);
                });
                
        } 
    };
    
    function markNoShow(answer, date, slotData) {
        if (answer && answer.selectedVolunteer && answer.selectedVolunteer.id) {
            
            $http.post('/api/volunteers/' + answer.selectedVolunteer.id + '/noshowsInc');
            answer.noShow = true;
            saveData(answer, date, slotData);
        }
        
    };
    function deleteData(answer) {
        if (answer.id) {
            //escape/clean/validate before posting
            $http.delete('/api/schedule?id=' + answer.id)
            .then(function(r) {
                loadScheduleData();
            }, function(er) {
                console.log(er);
            });
        }
    
    };
    function deleteAllFutureData(answer, date) {
        //so .... yeah .. unclear API ftw.
        if (answer.selectedVolunteer && answer.selectedVolunteer.id) {
            $http.delete('/api/scheduleBatch?id=' + answer.selectedVolunteer.id + "&date=" + date)
            .then(function(r) {
                loadScheduleData();
            }, function(er) {
                console.log(er);
            });
        }
    };
    
    
    
    //The subcontroller for our dialog popup has to manage the form and autocomplete 
    function DialogController($scope, $mdDialog, $http, src) {
        $scope.hide = function() {
          $mdDialog.hide();
        };

        $scope.cancel = function() {
          $mdDialog.cancel();
        };

        $scope.answer = function(data) {
            data.action = 'save';
            $mdDialog.hide(data);
        };
        
        $scope.noshow = function(data) {
            data.action = 'noshow';
            $mdDialog.hide(data);            
        };
        
        $scope.delete = function(data) {
            data.action = 'delete';
            $mdDialog.hide(data);          
        };
        
        $scope.deleteAll = function(data) {
            data.action = 'deleteall';
            $mdDialog.hide(data);           
        };
        
        $scope.recur = function(data) {
            if (data.selectedVolunteer && data.selectedVolunteer.id) {
                data.assignment = src.assignment;
                data.timeslot = src.timeslot;
                data.date = src.date;
                //inception
                 $mdDialog.show({
                    templateUrl: 'schedule/recurranceEditDialog.html',
                    parent: angular.element(document.body),
                    clickOutsideToClose:true,
                    fullscreen: false,
                    locals : {src : data},
                    controller: RecurranceController,
                });
            }
        }
        
        $scope.formData = {};
        $scope.searchText = "";
        $scope.formData.selectedVolunteer = {id : "", display : " "}; //see https://github.com/angular/material/issues/3760 - MD Auto wants a 'truthy' value for display
        $scope.title = "Edit Schedule for " + assignments[src.assignment] + " in the " + times[src.timeslot];
        $scope.titleBarClass = classes[src.assignment];
        if (src.id) {
            //then we are updating - prefill the form data
            $scope.formData.id = src.id;
            $scope.formData.selectedVolunteer = { id : src.volunteerId, display: src.volunteerName};
            $scope.formData.teamsize = src.teamSize;
            $scope.formData.notes = src.notes;
            $scope.formData.arrivalTime = src.arrivalTime;
            $scope.formData.noShow = src.noShow;
            $scope.searchText = src.volunteerName;
        }

        //bind the query for the autocomplete
        $scope.querySearch = function(searchString) {
            //should we have a narrower api where we can project smaller chunks of data 
            //some search strings like "*" really screw this up
            var s = escapeRegExp(searchString);
            
            return $http.get('/api/volunteers?name=' + s)
                .then(function(data) {
                     var results = data.data.data;
                     if (results)
                         return results.map(function(v) { return { id : v._id, display : v.firstName + " " + v.lastName}});
                     return [];
                 }, function(err) {
                    console.log(err);
                 });
        };
    };
    
    
    /*
    Handle the creation of recurring schedule appts.
    */
    function RecurranceController($scope, $mdDialog, $http, src) {
        //if this is a new event we have (possibly) notes, arrivalTime, selectedVolunteer, teamsize fields in src
        //if this is an existing event that we are adding recurrance to, we have an id, and a noShow.
        $scope.title = "Create Recurring Appointments for " + src.selectedVolunteer.display;
        $scope.titleBarClass = classes[src.assignment];
        
        $scope.cancel = function() {
          $mdDialog.cancel();
        };
        
        $scope.answer = function(data) {
            //recur. always is making new events 
            //do we want to post N times or have the api accept arrays of data? 
            var d = {};
            d.volunteerId = src.selectedVolunteer.id;
            d.timeslot = src.timeslot;
            d.assignment = src.assignment;
            d.teamSize = src.teamsize;
            d.arrivalTime = src.arrivalTime;
            d.notes = src.notes;
            d.noShow = false;
            var skipInit = false;
            if (src.id) skipInit = true;
            var dateArray = produceRecurranceDates(src.date, data.period, data.limitType, data.limitAmount, skipInit);
            
            dateArray.map(function(rDate) {
                    d.year = rDate.getFullYear();
                    d.month = rDate.getMonth();
                    d.day = rDate.getDate();
                    var snapshot = Object.assign({}, d); //simple shallow cloning - might not be needed in the map?
                    return $http.post('/api/schedule', snapshot); //return the promise to the map
                }).reduce(function(p, c) { return p.then(c); }, Promise.resolve())
            .then(function(result) {
                loadScheduleData();
            });
            
            $mdDialog.hide(data);
        };
    };
    
    function produceRecurranceDates(date, period, limitType, limitAmount, skipInitial) {
        var offset; 
        if (period == 0) //daily
            {
                offset = function(d) { var x = new Date(d); x.setDate(d.getDate() + 1); return x; };
            }
        if (period == 1) //weekly
            {
                offset = function(d) { var x = new Date(d); x.setDate(d.getDate() + 7); return x; };
            }
        if (period == 2) //bi weekly
            {
                offset = function(d) { var x = new Date(d); x.setDate(d.getDate() + 14); return x; };
            } 
        if (period == 3) //monthly
            {
                //we want to repeat on the same relative timing of the month
                //ie, 3rd tuesday, 1st monday, etc. 
                offset = function(d) { 
                    var weekOrd = Math.ceil(d.getDate()/7); //the Nth week of the month
                    var dayOfMonth = d.getDay();
                    var x = new Date(d); 
                    //make it next month
                    x.setMonth(d.getMonth() + 1); 
                    x.setDate(1);
                    var startDay = x.getDay(); //this month starts on a ... 
                    //set the date 
                    var date = 1 + 7*(weekOrd - 1) + dayOfMonth - startDay;
                    x.setDate(date);
                    return x; 
                };
            }
        
        var done = function(date, count) { return true; }
        if (limitType == 0) {
            var end = new Date(limitAmount);
            done = function(date, count) {return (date >= end); };
        }
        if (limitType == 1) {
            done = function(date, count) {return count >= limitAmount; };
        }
        
        var i = 0;
        var d = date;
        var out = [];
        if (!skipInitial) {
            out.push(d);
            i++;
        }
        while (!done(d, i)) {
            d = offset(d);
            out.push(d);
            i++;
        }
        return out;
    };
    
    
    $scope.getMonthName = function() {
        var i = $scope.viewingDate.getMonth();
        return months[i];
    };
    
    
    ///////////Navigation functions//////////////
    
    $scope.previousMonth = function() {
        var m = $scope.viewingDate.getMonth() - 1;
        $scope.viewingDate.setMonth(m);
        loadScheduleData();
    };
    
    $scope.nextMonth = function() {
        var m = $scope.viewingDate.getMonth() + 1;
        $scope.viewingDate.setMonth(m);
        loadScheduleData();
    };
    
    $scope.previousWeek = function() {
        var m = $scope.viewingDate.getMonth();
        var d = $scope.viewingDate.getDate() - 7;
        $scope.viewingDate.setDate(d);
        if ($scope.viewingDate.getMonth() == m) {
            selectWeekData(); //from month data
            selectDayData();  //from month data
        } else 
            loadScheduleData();
    };
    
    $scope.nextWeek = function() {
        var m = $scope.viewingDate.getMonth();
        var d = $scope.viewingDate.getDate() + 7;
        $scope.viewingDate.setDate(d);
        if ($scope.viewingDate.getMonth() == m) {
            selectWeekData(); //from month data
            selectDayData();  //from month data
        } else 
            loadScheduleData();
    };
    
    $scope.previousDay = function() {
        var m = $scope.viewingDate.getMonth();
        var d = $scope.viewingDate.getDate() - 1;
        $scope.viewingDate.setDate(d);
        if ($scope.viewingDate.getMonth() == m)
            selectDayData();  //from month data
        else
            loadScheduleData();
    };
    
    $scope.nextDay = function() {
        var m = $scope.viewingDate.getMonth();
        var d = $scope.viewingDate.getDate() +1;
        $scope.viewingDate.setDate(d);
        if ($scope.viewingDate.getMonth() == m)
            selectDayData();  //from month data
        else
            loadScheduleData();
    };
});