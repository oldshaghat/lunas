var animalManagement = angular.module('animalManagement', ['ngMaterial'])
.config( [ '$compileProvider', function ( $compileProvider ) {
  $compileProvider.preAssignBindingsEnabled( true );
} ] );

animalManagement.controller('AnimalManagementController', function AnimalManagementController($scope, $http) {
    
    $scope.currPage = 1;
    $scope.totalPages = 1;
    
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
        $scope.animalSelected = [];
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
            $scope.formData = data;
            //try to be simple maybe this time
            
        }, function(data) {
            console.log(data);
        });
    
    };
    
    
};