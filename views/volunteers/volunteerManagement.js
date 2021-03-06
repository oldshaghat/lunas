//eventually put dependencies in that array
var volunteerManagement = angular.module('volunteerManagement', ['ngMaterial'])
.config( [ '$compileProvider', function ( $compileProvider ) {
  $compileProvider.preAssignBindingsEnabled( true );
} ] );

volunteerManagement.controller('VolunteerManagementController', function VolunteerManagementController($scope, $http) {
    $scope.volunteerSelected = [];
    $scope.formData = {};
    $scope.minDate = new Date(1900,1,1);
    $scope.maxDate = new Date(2100,1,1);
    
    $scope.currPage = 1;
    $scope.totalPages = 1;
    
    $scope.states = ('MD AK AL AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA MA ME MI MN MS ' +
    'MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI ' +
    'WY').split(' ').map(function(state) {
        return {abbrev: state};
      });
    
    $scope.previousPage = function() {
        if ($scope.currPage > 1) {
            $scope.currPage = $scope.currPage -1;
            queryTableData();
        }  
    };
    $scope.nextPage = function() {
        if ($scope.currPage < $scope.totalPages) {
            $scope.currPage = $scope.currPage + 1;
            queryTableData();
        }  
    };
    
    //filter and pagination are query params
    function buildFilterString () {
        var q = "?page=" + ($scope.currPage - 1);
        if (!$scope.filters || $scope.filters.length == 0)
            return q;  
        for (var k = 0; k < $scope.filters.length; k++) {
            var f = $scope.filters[k];
            //todo : urlencode to avoid issues with special characters
            if (f)
                q+= "&" + f.kind + "=" + f.term;
        }
        return q;
    };
    
    function queryTableData () {
        //requery data 
        var filterString = buildFilterString();
        $http.get('/api/volunteers' + filterString)
            .then(function(data) {
                $scope.totalPages = Math.ceil(data.data.pageCount);
                $scope.volunteers = data.data.data; //jesus christ.
            }, function(data) {
                console.log(data);
            });
    }
    
    //initial load
    queryTableData();
    
    $scope.clearForm = function() {
        $scope.formData = {};
        $scope.volunteerSelected = [];
    };
    
 
    function escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    };
    
    function addOrUpdateFilter (f) {
        if (!$scope.filters) $scope.filters = [];
        for (var i = 0; i < $scope.filters.length; i++) {
            var filter = $scope.filters[i];
            //check replacement
            if (filter.kind === f.kind) {
                filter.term = f.term;
                filter.summary = f.summary;
                return;
            }
        }
        //didn't find it
        $scope.filters.push(f);
    }
    
    $scope.addCriteria = function() {
        //look to see what was selected
        if ($scope.filterModel.criteriaType == 0) {
            var term = $scope.filterModel.criteriaText;
            term = escapeRegExp(term);
            var f = {summary : 'Email contains ' + term, kind : 'email', term : term};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 1) {
            var term = $scope.filterModel.criteriaText;
            term = escapeRegExp(term);
            var f = {summary : 'Name contains ' + term, kind : 'name', term : term};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 2) {
            var term = $scope.filterModel.criteriaTraining;
            var code = term.split(":")[0];
            var desc = term.split(":")[1];
            var f = {summary : 'Training for  ' + desc, kind : 'training', term : code};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 3) {
            var term = $scope.filterModel.criteriaInterests;
            var code = term.split(":")[0];
            var desc = term.split(":")[1];
            var f = {summary : 'Interests in ' + desc, kind : 'interests', term : code};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 4) {
            var term = $scope.filterModel.criteriaAvailability;
            var code = term.split(":")[0];
            var desc = term.split(":")[1];
            var f = {summary : 'Availability on ' + desc, kind : 'availability', term : code};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 5) {
            var f = {summary : 'Active Volunteers Only', kind : 'activeOnly', term : '1'};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 6 || $scope.filterModel.criteriaType == 7) {
            var age = 14;
            if ($scope.filterModel.criteriaType == 7) age = 18;
            var f = {summary : 'Older than ' + age, kind : 'age', term : age};
            addOrUpdateFilter(f);
        }
        queryTableData();
        
        $scope.filterModel = {};
    };
    
    $scope.removeCriteria = function(findex) {
        $scope.filters.splice(findex, 1);
        //requery data
        queryTableData();
    }
    
    //push form data up to server as new or updated volunteer data
    $scope.upsertVolunteer = function() {
        $scope.volunteerSelected = [];
        $http.post('/api/volunteers' + buildFilterString(), $scope.formData)
            .then(function(data) {
                $scope.formData = {};
                $scope.totalPages = Math.ceil(data.data.pageCount);
                $scope.volunteers = data.data.data; //jesus christ.
            }, function(data) {
                console.log('Error: ' + data);
        });
    };
    
    $scope.duplicateVolunteer = function() {
        $scope.formData._id = null;
        $scope.upsertVolunteer();
    };
    
    $scope.deleteRecord = function() {
        if (confirm("Are you sure you want to delete this volunteer?")) {
            //TODO should this respect filters or clear them
            $scope.volunteerSelected = [];
            $scope.filters = [];
            var oid = $scope.formData._id
            $http.delete('/api/volunteers?id=' + oid)
                .then(function(data) {
                    $scope.formData = {};
                    $scope.totalPages = Math.ceil(data.data.pageCount);
                    $scope.volunteers = data.data.data; //jesus christ.
                }, function(data) {
                    console.log('Error: ' + data);
            })
        }
    };
    
    //really "obtain volunteer for editing"
    $scope.editVolunteer = function (v) {
        var oid = v._id;
        $scope.volunteerSelected = [];
        $scope.volunteerSelected[oid] = true;
        $http.get('/api/volunteers?id=' + oid)
        .then(function(response) {
            //could I just make this $scope.formData = data? 
            var data = response.data;
            $scope.formData = {};
            $scope.formData._id = data._id;
            $scope.formData.email = data.email;
            $scope.formData.firstName = data.firstName;
            $scope.formData.lastName = data.lastName;
            $scope.formData.address = data.address;
            $scope.formData.city = data.city;
            $scope.formData.state = data.state;
            $scope.formData.zip = data.zip;
            $scope.formData.phoneNumber = data.phoneNumber;
            $scope.formData.altPhoneNumber = data.alternatePhoneNumber;
            $scope.formData.workPhoneNumber = data.workPhoneNumber;
            $scope.formData.canGetSMS = data.canGetSMS;  //could elide
            $scope.formData.doNotEmail = data.doNotEmail;
            $scope.formData.contactPreference = data.contactPreference;
            $scope.formData.contactNotes = data.contactNotes;
            
            if (data.volunteerData) {
                var vd = data.volunteerData;
                
                $scope.formData.active = vd.activeVolunteer;
                $scope.formData.specialNeeds = vd.specialNeeds;
                $scope.formData.foster = vd.foster;
                $scope.formData.fostering = vd.fostering;
                
                if (vd.birthday)
                    $scope.formData.birthday = new Date(vd.birthday);
                if (vd.started)
                    $scope.formData.started = new Date(vd.started);
                if (vd.lastSeen)
                    $scope.formData.lastSeen = new Date(vd.lastSeen);
            
                $scope.formData.hoursWorked = vd.hoursWorked;
                $scope.formData.noShows = vd.noShows;
                $scope.formData.notes = vd.notes;
                $scope.formData.partners = vd.partners;
                $scope.formData.dependents = vd.dependents;
                $scope.formData.emergencyContactName = vd.emergencyContactName;
                $scope.formData.emergencyContactNumber = vd.emergencyContactNumber;
                $scope.formData.emergencyContactRelationship = vd.emergencyContactRelationship;
            
                if (vd.status) {
                    $scope.formData.statuswaiver = vd.status.waiver;
                    if (vd.status.oriented)
                        $scope.formData.statusoriented = new Date(vd.status.oriented);
                    if (vd.status.trainedCats)
                        $scope.formData.statustrainedCats = new Date(vd.status.trainedCats);
                    if (vd.status.trainedCatsQuarantine)
                        $scope.formData.statustrainedCatsQuarantine = new Date(vd.status.trainedCatsQuarantine);
                    if (vd.status.trainedCatsPetsmart)
                        $scope.formData.statustrainedCatsPetsmart = new Date(vd.status.trainedCatsPetsmart);
                    if (vd.status.trainedDogs)
                        $scope.formData.statustrainedDogs = new Date(vd.status.trainedDogs);
                    if (vd.status.trainedDogsQuarantine)
                        $scope.formData.statustrainedDogsQuarantine = new Date(vd.status.trainedDogsQuarantine);
                    if (vd.status.trainedRabbit)
                        $scope.formData.statustrainedRabbit = new Date(vd.status.trainedRabbit);
                    if (vd.status.trainedSmalls)
                        $scope.formData.statustrainedSmalls = new Date(vd.status.trainedSmalls);
                    if (vd.status.trainedRabbitQuarantine)
                        $scope.formData.statustrainedRabbitQuarantine = new Date(vd.status.trainedRabbitQuarantine);
                    if (vd.status.trainedSmallsQuarantine)
                        $scope.formData.statustrainedSmallsQuarantine = new Date(vd.status.trainedSmallsQuarantine);
                }
            
               if (vd.interests) {
                   if (vd.interests.cats > 0)
                       $scope.formData.interestscats = vd.interests.cats; 
                   if (vd.interests.dogs > 0)
                       $scope.formData.interestsdogs = vd.interests.dogs;
                   if (vd.interests.rabbits > 0)
                       $scope.formData.interestsrabbits = vd.interests.rabbits;
                   if (vd.interests.smalls > 0)
                       $scope.formData.interestssmalls = vd.interests.smalls;
                   if (vd.interests.maintenance > 0)
                       $scope.formData.interestsmaintenance = vd.interests.maintenance;
                   if (vd.interests.fundraising > 0)
                       $scope.formData.interestsfundraising = vd.interests.fundraising;
                   if (vd.interests.events > 0)
                       $scope.formData.interestsevents = vd.interests.events;
                   if (vd.interests.fosterCare > 0)
                       $scope.formData.interestsfostercare = vd.interests.fosterCare;
                    if (vd.interests.adopterEducation > 0)
                       $scope.formData.interestsadoptereducation = vd.interests.adopterEducation;                   
                    if (vd.interests.donationTransport > 0)
                       $scope.formData.interestsdonationtransport = vd.interests.donationTransport;
                   if (vd.interests.humaneEducation > 0)
                       $scope.formData.interestshumaneeducation = vd.interests.humaneEducation;
                }
            
                if (vd.availability) {
                    if (vd.availability.monday) {
                        $scope.formData.availabilitymondaymorning = vd.availability.monday.morning;
                        $scope.formData.availabilitymondayafternoon = vd.availability.monday.afternoon;
                        $scope.formData.availabilitymondayevening = vd.availability.monday.evening;
                    }
                    if (vd.availability.tuesday) {
                        $scope.formData.availabilitytuesdaymorning = vd.availability.tuesday.morning;
                        $scope.formData.availabilitytuesdayafternoon = vd.availability.tuesday.afternoon;
                        $scope.formData.availabilitytuesdayevening = vd.availability.tuesday.evening;
                    }
                    if (vd.availability.wednesday) {
                        $scope.formData.availabilitywednesdaymorning = vd.availability.wednesday.morning;
                        $scope.formData.availabilitywednesdayafternoon = vd.availability.wednesday.afternoon;
                        $scope.formData.availabilitywednesdayevening = vd.availability.wednesday.evening;
                    }
                    if (vd.availability.thursday) {
                        $scope.formData.availabilitythursdaymorning = vd.availability.thursday.morning;
                        $scope.formData.availabilitythursdayafternoon = vd.availability.thursday.afternoon;
                        $scope.formData.availabilitythursdayevening = vd.availability.thursday.evening;
                    }
                    if (vd.availability.friday) {
                        $scope.formData.availabilityfridaymorning = vd.availability.friday.morning;
                        $scope.formData.availabilityfridayafternoon = vd.availability.friday.afternoon;
                        $scope.formData.availabilityfridayevening = vd.availability.friday.evening;
                    }
                    if (vd.availability.saturday) {
                        $scope.formData.availabilitysaturdaymorning = vd.availability.saturday.morning;
                        $scope.formData.availabilitysaturdayafternoon = vd.availability.saturday.afternoon;
                        $scope.formData.availabilitysaturdayevening = vd.availability.saturday.evening;
                    }
                    if (vd.availability.sunday) {
                        $scope.formData.availabilitysundaymorning = vd.availability.sunday.morning;
                        $scope.formData.availabilitysundayafternoon = vd.availability.sunday.afternoon;
                        $scope.formData.availabilitysundayevening = vd.availability.sunday.evening;
                    }
                    $scope.formData.availabilitynotes = vd.availability.notes;
                }
            }
            
            if (data.donorData) {
                //array of :: gifts : [{dateOfGift : Date, amountOfGift : Number}]
                $scope.formData.donorDataGifts = data.donorData.gifts;
            }
            
            if (data.adopteeData) {
                //array of ::  adoptions : [{animalName : String, animalKind : String, adoptionDate : Date}]
                $scope.formData.adopteeDataAdoptions = data.adopteeData.adoptions;
            } 
            
            if (data.boardingData) {
                if (data.boardingData.lastBoarded) 
                    $scope.formData.boardingDate = new Date(data.boardingData.lastBoarded);
                $scope.formData.boardingNotes = data.boardingData.notes;
            }
            
            if (data.disqualifyingData) {
                if (data.disqualifyingData.surrenderedAnimal)
                    $scope.formData.dqSurrenderDate = new Date(data.disqualifyingData.surrenderedAnimal);
                if (data.disqualifyingData.failedVetCheck)
                    $scope.formData.dqFailedVetDate = new Date(data.disqualifyingData.failedVetCheck);
                if (data.disqualifyingData.failedHomeInspection)
                    $scope.formData.dqFailedHomeDate = new Date(data.disqualifyingData.failedHomeInspection);
                $scope.formData.dqNotes = data.disqualifyingData.notes;
            }
            
        }, function(data) {
            console.log(data);
        });
    
    };
    
    $scope.appendNewDonation = function() {
        if ($scope.newDonationData) {
            var amt = Number.parseFloat($scope.newDonationData.donationAmount);
            var date = new Date();
            if ($scope.newDonationData.donationDate) 
                date = $scope.newDonationData.donationDate;
            if (!Number.isNaN(amt)) {
                var donation = {};
                donation.dateOfGift = date;
                donation.amountOfGift = amt;
                if (!$scope.formData.donorDataGifts) {
                    $scope.formData.donorDataGifts = [];
                }
                $scope.formData.donorDataGifts.push(donation);
                $scope.newDonationData = {};
            }
        }
    };
    
    $scope.appendNewAdoption = function() {
        if ($scope.newAdoptionData) {
            var name = $scope.newAdoptionData.name;
            var kind = $scope.newAdoptionData.kind;
            var date = new Date();
            if ($scope.newAdoptionData.adoptionDate) 
                date = $scope.newAdoptionData.adoptionDate;
            if (name && kind) {
                var adoption = {};
                adoption.animalName = name;
                adoption.animalKind = kind;
                adoption.adoptionDate = date;
                if (!$scope.formData.adopteeDataAdoptions) {
                    $scope.formData.adopteeDataAdoptions = [];
                }
                $scope.formData.adopteeDataAdoptions.push(adoption);
                $scope.newAdoptionData = {};
            }
        }
    };
    
    $scope.formatPrefContact = function(v) {
        if (v.contactPreference === 0)
            return v.email;
        
        if (v.contactPreference === 1) 
            return v.phoneNumber;
        
        if (v.contactPreference === 2) {
            if (v.alternatePhoneNumber) {
                return 'Text Message to ' + v.alternatePhoneNumber;
            }
            return 'Text Message to ' + v.phoneNumber;  //fallback to home value
        }
        
        if (v.contactPreference === 3) 
            return v.alternatePhoneNumber;
        
        if (v.contactPreference === 4) 
            return v.workPhoneNumber;
        
        
        return "N/A";
    };
    $scope.formatStatus = function(v) {
        if (!v) return 'N/A';
        var vd = v.volunteerData;
        if (!vd) return 'N/A';
        
        if (vd.status) {
            if (!vd.status.waiver) {
                return "NO WAIVER";
            }
            if (!vd.status.oriented) {
                return "NOT ORIENTED";
            }
            var status = '';
            if (vd.status.trainedCats) {
                status += "C ";
            }
            if (vd.status.trainedCatsPetsmart) {
                status += "P ";
            }
            if (vd.status.trainedDogs) {
                status += "D ";
            }
            if (vd.status.trainedRabbit) {
                status += "R ";
            }
            if (vd.status.trainedSmalls) {
                status += "S ";
            }
            if (status.length == 0) {
                return "No Training";
            }
            return status;
        }
        return "No Data";
    };
    $scope.formatInterests = function(v) {
        if (!v) return '';
        var vd = v.volunteerData;
        if (!vd) return '';
        if (!vd.interests) {
            return "";
        }
        var i =[];
        i.push({n : 'C ', r : vd.interests.cats});
        i.push({n : 'D ', r : vd.interests.dogs});
        i.push({n : 'R ', r : vd.interests.rabbits});
        i.push({n : 'S ', r : vd.interests.smalls});
        //Lump everything else together ? This could get large
        i.push({n : 'M ', r : vd.interests.maintenance});
        i.push({n : 'F ', r : vd.interests.fundraising});
        i.push({n : 'E ', r : vd.interests.events});  
        i.sort(function(a, b) { return a.r - b.r;});
        
        var interestString = '';
        for (var k = 0; k < i.length; k++) {
            if (i[k].r > 0) {
                interestString += i[k].n;
            }
        }
        if (interestString.length ==0 )  //no op?
            return "";
        
        return interestString;
    };
    $scope.getAvailabilityClass = function(v, dayIndex, timeSlot) {
        if (!v) return 'unav';
        var vd = v.volunteerData;
        if (!vd) return 'unav';
        var a  = vd.availability;
        if (!a) return 'unav';
        var days = [  a.monday, a.tuesday, a.wednesday, a.thursday, a.friday, a.saturday,a.sunday];
        if (dayIndex >= 0 && dayIndex <= 6) {
            var d = days[dayIndex];
            if (!d) return 'unav';
            if (timeSlot == 0 && d.morning) {
                return "av";
            }
            if (timeSlot == 1 && d.afternoon) {
                return "av";
            }
            if (timeSlot == 2 && d.evening) {
                return "av";
            }
        }
        return "unav";
    };
    $scope.hasDisqualifyingData = function (v) {
        if (v && v.disqualifyingData) {
            if (v.disqualifyingData.failedHomeInspection || v.disqualifyingData.failedVetCheck || v.disqualifyingData.notes || v.disqualifyingData.surrenderedAnimal) {
                return true;
            }
        }
        return false;
    };
    
    $scope.isMinor = function(v) {
      if (v && v.volunteerData && v.volunteerData.birthday)  {
            var ageInMilliseconds = new Date() - new Date(v.volunteerData.birthday);
            return ageInMilliseconds < 567648000000; // 18 years in milliseconds
      }
    };
});

/*

 to think about : 
    mongoose/mongo PK / vol ID (email not compulsory esp for minors or might be duplicated)
    pagination & page controls
    searching and filtering options 
    select a row -> populate the form -> save the data 
    select a parent / guardian interface
    
    
*/
