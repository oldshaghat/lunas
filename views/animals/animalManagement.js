var animalManagement = angular.module('animalManagement', ['ngMaterial'])
.config( [ '$compileProvider', function ( $compileProvider ) {
  $compileProvider.preAssignBindingsEnabled( true );
} ] );

animalManagement.controller('AnimalManagementController', function AnimalManagementController($scope, $http) {

    
};