//eventually put dependencies in that array
var userManagement = angular.module('userManagement', []);

userManagement.controller('UserManagementController', function UserManagementController($scope, $http) {
    
    $http.get('/api/users')
        .then(function(data) {
            $scope.users = data.data;
        }, function(data) {
            console.log(data);
        })
    

});