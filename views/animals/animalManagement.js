var animalManagement = angular.module('animalManagement', ['ngMaterial'])
.config( [ '$compileProvider', function ( $compileProvider ) {
  $compileProvider.preAssignBindingsEnabled( true );
} ] );

animalManagement.controller('AnimalManagementController', function AnimalManagementController($scope, $http) {
    
    
    //set up lists and queries for animal breeds 
    $scope.aml = {};
    $scope.aml.searchKindsText = '';
    $scope.aml.queryKinds = function(q) {
        return q ? animalMenuLists.kinds.filter(createFilterFor(q)) : animalMenuLists.kinds;
    };
    $scope.aml.kindChanged = function(k) {
        //grr. if I don't use this then it's possible to make a lop dog ... validation? 
        //insulator? but .. ugh
     //    $scope.formData.breed = '';
    }
    $scope.aml.searchBreedsText = '';
    $scope.aml.queryBreeds = function(k, q) {
        if (!k) return [];
        var b = [];
        if (k === animalMenuLists.kinds[0]) b = animalMenuLists.birdBreeds;
        else if (k === animalMenuLists.kinds[1]) b = animalMenuLists.catBreeds;
        else if (k === animalMenuLists.kinds[2]) b = animalMenuLists.dogBreeds;
        else if (k === animalMenuLists.kinds[3]) b = animalMenuLists.rabbitBreeds;
        else if (k === animalMenuLists.kinds[4]) b = animalMenuLists.smallBreeds;
        else if (k === animalMenuLists.kinds[5]) b = animalMenuLists.reptileBreeds;
        else if (k === animalMenuLists.kinds[6]) b = animalMenuLists.otherBreeds;
        return q ? b.filter(createFilterFor(q)) : b;
    };
    // ['Bird', 'Cat', 'Dog', 'Rabbit', 'Small', 'Reptile', 'Other'];
    
    function createFilterFor(query) {
      var lowercaseQuery = angular.lowercase(query);

      return function filterFn(v) {
        var lv = angular.lowercase(v);
        return (lv.indexOf(lowercaseQuery) === 0);
      };
    }
    
    $scope.sizes = ['Small', 'Medium', 'Large', 'Very Large'];
    $scope.coats = ['Short', 'Medium', 'Long', 'Rough', 'Curly', 'Hairless'];
    $scope.statuses = ['Quarantined', 'Adoptable', 'Pending Adoption', 'Adopted', 'Archive', 'Deceased'];
    //should these be objects that know in vs out?
    $scope.transferTypes = ['Surrender', 'Transfer In', 'Stray', 'Animal Control', 'Return', 'Reclaim', 'Foster', 'Adoption', 'Transfer Out', 'Deceased'];
    $scope.locationType = ["Luna's", 'Individual', 'Other Shelter', 'Other'];
    
    $scope.currPage = 1;
    $scope.totalPages = 1;
    $scope.transferData = {};
    $scope.transferRowSelected = [];
    
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
        $http.get('/api/animals' + filterString)
            .then(function(data) {
                $scope.totalPages = Math.ceil(data.data.pageCount);
                $scope.animals = data.data.data; //jesus christ.
            }, function(data) {
                console.log(data);
            });
    }
    
    //initial load
    queryTableData();
    
    $scope.clearForm = function() {
        $scope.formData = {};
        $scope.transferData = {}
        $scope.animalSelected = [];
        $scope.transferRowSelected = [];
        $scope.aml.searchKindsText = '';
        $scope.aml.searchBreedsText = '';
        
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
            var term = $scope.filterModel.criteriaStatus;
            var code = term.split(":")[0];
            var desc = term.split(":")[1];
            var f = {summary : 'Status is ' + desc, kind : 'status', term : code};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 1) {
            var term = $scope.filterModel.criteriaText;
            term = escapeRegExp(term);
            var f = {summary : 'Name contains ' + term, kind : 'name', term : term};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 2) {
            var term = $scope.filterModel.criteriaSpecies;
            var f = {summary : 'Kind of animal is ' + term, kind : 'kind', term : term};
            addOrUpdateFilter(f);
        }
        else if ($scope.filterModel.criteriaType == 3) {
            var term = $scope.filterModel.criteriaText;
            term = escapeRegExp(term);
            var f = {summary : 'Breed name contains ' + term, kind : 'breed', term : term};
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
    
    //push form data up to server as new or updated animal data
    $scope.upsertAnimal = function() {
        $scope.animalSelected = [];
        $http.post('/api/animals' + buildFilterString(), $scope.formData)
            .then(function(data) {
                $scope.formData = {};
                $scope.totalPages = Math.ceil(data.data.pageCount);
                $scope.animals = data.data.data; //jesus christ.
            }, function(data) {
                console.log('Error: ' + data);
        });
    };
    
    $scope.duplicateAnimal = function() {
        $scope.formData._id = null;
        $scope.upsertAnimal();
    };
    
    $scope.deleteRecord = function() {
        if (confirm("Are you sure you want to delete this animal?")) {
            //TODO should this respect filters or clear them
            $scope.animalSelected = [];
            $scope.filters = [];
            var oid = $scope.formData._id
            $http.delete('/api/animals?id=' + oid)
                .then(function(data) {
                    $scope.formData = {};
                    $scope.totalPages = Math.ceil(data.data.pageCount);
                    $scope.animals = data.data.data; //jesus christ.
                }, function(data) {
                    console.log('Error: ' + data);
            })
        }
    };
    
    //really "obtain animal for editing"
    $scope.editAnimal = function (v) {
        var oid = v._id;
        $scope.animalSelected = [];
        $scope.animalSelected[oid] = true;
        $http.get('/api/animals?id=' + oid)
        .then(function(response) {
            var data = response.data;
            if (data.birthday) {data.birthday = new Date(data.birthday);}
            if (data.alteredDate) {data.alteredDate = new Date(data.alteredDate);}
            if (data.chippedDate) {data.chippedDate = new Date(data.chippedDate);}
            $scope.formData = data;
            
        }, function(data) {
            console.log('Error: ' + data);
        });
    
    };
    
    function copyTransferData(src, dest) {
        if (src.date) {
            dest.date = $scope.transferData.date;
        }
        dest.kind = src.kind;
        dest.origin = src.origin;
        dest.originType = src.originType;
        dest.dest = src.dest;
        dest.destType = src.destType;
        dest.notes = src.notes;
    }
    
   // should adding a transfer prompt to change status automatically?      $scope.statuses = ['Quarantined', 'Adoptable', 'Pending Adoption', 'Adopted', 'Archive', Deceased'];
    $scope.appendNewTransfer = function() {
        if ($scope.transferData) {
            if ($scope.updating || $scope.transferData._id) {
                //we are updating an existing transfer : 
                var index = $scope.transferRowSelected.indexOf(true);
                var t = $scope.formData.transfers[index];
                
                //we expect this is just correcting older data and therefore doesn't update animal status
                copyTransferData($scope.transferData, t);
                
            } else {
                var t = {};
                t.date = new Date(); //default to today
                copyTransferData($scope.transferData, t);
                
                //if some kind of transfer occurs, we assume it isn't fostered unless said so
                $scope.formData.fostered = false;
                //if we're recording a transfer of an intake then assume it's quarantined
                var tti = $scope.transferTypes.indexOf(t.kind);
                if (tti == 6) { //foster
                    //confirm? 
                    $scope.formData.fostered = true;
                    //maybe make the status adoptable or pending but we don't want to overwrite that I think? 
                }
                if (tti >= 0 && tti < 6) {
                    $scope.formData.status = $scope.statuses[0]; // Q
                }
                if (tti == 7) {
                    $scope.formData.status = $scope.statuses[3]; // Adopted
                }
                if (tti == 8) {
                    $scope.formData.status = $scope.statuses[4]; // Arch
                }
                if (tti == 9) {
                    $scope.formData.status = $scope.statuses[5]; // :(
                }

                if (!$scope.formData.transfers) {
                    $scope.formData.transfers = [];
                }
                $scope.formData.transfers.push(t);
            }
            $scope.transferData = {};
            $scope.transferRowSelected = [];
        }
    };
    
    $scope.editTransferData = function(data, index) {
        $scope.transferRowSelected = [];
        $scope.transferRowSelected[index] = true;
        $scope.transferData.date = new Date(data.date);
        $scope.transferData.kind = data.kind;
        $scope.transferData.origin = data.origin;
        $scope.transferData.originType = data.originType;
        $scope.transferData.dest = data.dest;
        $scope.transferData.destType = data.destType;
        $scope.transferData.notes = data.notes;
        //this isn't reliable = the transfer might not have been committed to the DB yet
        $scope.transferData._id = data._id; 
        $scope.transferData.updating = true;
    };
    
    $scope.deleteTransfer = function() {
        var index = $scope.transferRowSelected.indexOf(true);
        if (index >= 0) {
            $scope.formData.transfers.splice(index, 1);
            $scope.transferData = {};
            $scope.transferRowSelected = [];
        }
    }
    
   //  $scope.transferTypes = ['Surrender', 'Transfer In', 'Stray', 'Animal Control', 'Return', 'Reclaim', 'Foster', Adoption', 'Transfer Out', 'Deceased'];
    $scope.transferKindChanged = function() {
        //pre-set the From and To based on the transfer kind : assume that some are Luna's coming in and others are Luna's going out.
            $scope.transferData.originType = "";
            $scope.transferData.destType = "";
        if (
            $scope.transferData.kind == $scope.transferTypes[0] || 
            $scope.transferData.kind == $scope.transferTypes[1] || 
            $scope.transferData.kind == $scope.transferTypes[2] || 
            $scope.transferData.kind == $scope.transferTypes[3] || 
            $scope.transferData.kind == $scope.transferTypes[4] || 
            $scope.transferData.kind == $scope.transferTypes[5]  
           ) {
            $scope.transferData.originType = "";
            $scope.transferData.destType = "Luna's";
        } else if (
            $scope.transferData.kind == $scope.transferTypes[6] || 
            $scope.transferData.kind == $scope.transferTypes[7] ||
            $scope.transferData.kind == $scope.transferTypes[8]
        ){
            $scope.transferData.originType = "Luna's";
            $scope.transferData.destType = "";
        }
            
    };
    
    $scope.formatTransferOrigin = function(d) {
        if (d.originType == "Luna's") return "Luna's"; 
        else return d.originType + " : " + d.origin; 
    };
    $scope.formatTransferDestination = function(d) {
        if (d.destType == "Luna's") return "Luna's"; 
        else return d.destType + " : " + d.dest; 
    }
});