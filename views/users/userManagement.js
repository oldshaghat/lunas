//eventually put dependencies in that array
var userManagement = angular.module('userManagement', ['ngMaterial']);

userManagement.controller('UserManagementController', function UserManagementController($scope, $http) {
    
    $http.get('/api/users')
        .then(function(data) {
            $scope.users = data.data;
        }, function(data) {
            console.log(data);
        });
    
    
    $scope.editUser = function(u) {
        //stop editing all other users
        for (var i = 0; i < $scope.users.length; i++) {
            var user = $scope.users[i];
            user.editing = false;
        }
        $scope.userData = {};
        $scope.userData.email = u.email;
        $scope.userData.role = u.role;
        u.editing = true;
    };
    
    $scope.saveUser = function(u) {
        var d = $scope.userData;
        d.id = u._id;
        $http.post('/api/users', d)
            .then(function(data) {$scope.users = data.data;}, 
                  function(errorData) { console.log(errorData);} );
        u.editing = false;
        $scope.userData = {};
    }
    
    $scope.deleteUser = function(u) {
        
    };
    
});