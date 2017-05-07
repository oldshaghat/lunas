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
    $scope.statuses = ['Quarantined', 'Adoptable', 'Pending Adoption', 'Adopted', 'Deceased'];
    //should these be objects that know in vs out?
    $scope.transferTypes = ['Surrender', 'Transfer In', 'Stray', 'Animal Control', 'Return', 'Reclaim', 'Adoption', 'Transfer Out', 'Deceased'];
    
    $scope.currPage = 1;
    $scope.totalPages = 1;
    $scope.transferData = {};
    
    
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
//        if ($scope.filterModel.criteriaType == 0) {
//            var term = $scope.filterModel.criteriaText;
//            term = escapeRegExp(term);
//            var f = {summary : 'Email contains ' + term, kind : 'email', term : term};
//            addOrUpdateFilter(f);
//        }
//        else if ($scope.filterModel.criteriaType == 1) {
//            var term = $scope.filterModel.criteriaText;
//            term = escapeRegExp(term);
//            var f = {summary : 'Name contains ' + term, kind : 'name', term : term};
//            addOrUpdateFilter(f);
//        }
//        else if ($scope.filterModel.criteriaType == 2) {
//            var term = $scope.filterModel.criteriaTraining;
//            var code = term.split(":")[0];
//            var desc = term.split(":")[1];
//            var f = {summary : 'Training for  ' + desc, kind : 'training', term : code};
//            addOrUpdateFilter(f);
//        }
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
            //try to be simple maybe this time
            
        }, function(data) {
            console.log(data);
        });
    
    };
    
    $scope.appendNewTransfer = function() {
        if ($scope.transferData) {
            var t = {};
            t.date = new Date(); //default to today
            if ($scope.transferData.date) {
                t.date = $scope.transferData.date;
            }
            t.kind = $scope.transferData.kind;
            t.origin = $scope.transferData.origin;
            t.dest = $scope.transferData.dest;
            t.notes = $scope.transferData.notes;
            
            if (!$scope.formData.transfers) {
                $scope.formData.transfers = [];
            }
            $scope.formData.transfers.push(t);
            $scope.transferData = {};
        }
    };
    
});