var reporting = angular.module('reporting', ['ngMaterial']);

reporting.controller('ReportController', function ReportController($scope, $http, $mdDialog) {
    
    
    $scope.emailOptions = {
        excludeMinors : true,
        respectOptOut : true,
        deDuplicate : true,
        skipInactive : true,
        skipDisqualified : true,
        filterTraining: false
    };
    
    $scope.emailReport = [];
    
    $scope.addressOptions = {
        respectOptOut : true,
        skipInactive : true,
        skipDisqualified : true
        
    };
    
    $scope.addressReport = [];
    
    $scope.emergOptions = {
        skipInactive : true
    };
    $scope.emergContactReport = [];
    
    $scope.runEmailReport = function() {
        $http.get('/api/report/email', {params : $scope.emailOptions})
            .then(function(r) { 
                $scope.emailReport = r.data;
        }, function (e) {
            console.log(e);
        });
    };
    
    $scope.runEmergContactReport = function() {
        $http.get('/api/report/emergencyContact', {params : $scope.emergOptions})
            .then(function(r) { 
                $scope.emergContactReport = r.data;
        }, function (e) {
            console.log(e);
        });
    };
    
    $scope.runAddressReport = function() {
        $http.get('/api/report/address', {params : $scope.addressOptions})
            .then(function(r) { 
                $scope.addressReport = r.data;
        }, function (e) {
            console.log(e);
        });
    };
});
  