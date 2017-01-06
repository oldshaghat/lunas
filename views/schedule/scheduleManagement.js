var scheduleManagement = angular.module('scheduleManagement', ['ngMaterial']);

scheduleManagement.controller('ScheduleManagementController', function ScheduleManagementController($scope, $http) {
    
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    
    $scope.today = new Date();
    $scope.viewingDate = $scope.today;
    
    
    //load schedule information for the month around the viewing date
    function loadScheduleData() {
        var year = $scope.viewingDate.getFullYear();
        var month = $scope.viewingDate.getMonth();
        $http.get('/api/schedule/' + year + '/' + month)
        .then(function(data) {
            $scope.schedule = data.data;
        }, function(data) {
            console.log(data);
        });
    };
    
    loadScheduleData();
    
    /*
        year    : Number,       //four digit year for event 
        month   : Number,       //0 based (js Date style) month of event
        dayOfMonth : Number,    //1 based (js Date style) day of month (new Date().getDate())
        timeslot : Number, // 0, 1, 2 : Morning, Afternoon, Evening
        assignment : Number
    */
    
    $scope.getScheduleClass = function(dateOffset, assignment, timeslot) {
        for (var i = 0; i < $scope.schedule.length; i++) {
            
        }
    };
    
    $scope.getScheduleData = function(dateOffset, assignment, timeslot) {
        
    };
    
    $scope.upsertSchedule = function(dateOffset, assignment, timeslot) {
        
    };
    
    $scope.getMonthName = function() {
        var i = $scope.viewingDate.getMonth();
        return months[i];
    };
    
    //return the date at the start of the week (Sunday)
    $scope.getWeekStart = function() {
        var copy = new Date($scope.viewingDate);
        var sunday = copy.getDate() - copy.getDay();
        copy.setDate(sunday);
        return copy;
    };
    
    //return the date at the end of the week (Saturday)
    $scope.getWeekEnd = function() {
        var copy = new Date($scope.viewingDate);
        var saturday = copy.getDate() - copy.getDay() + 6;
        copy.setDate(saturday);
        return copy;
    };
    
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
        if ($scope.viewingDate.getMonth() != m)
            loadScheduleData();
    };
    
    $scope.nextWeek = function() {
        var m = $scope.viewingDate.getMonth();
        var d = $scope.viewingDate.getDate() + 7;
        $scope.viewingDate.setDate(d);
        if ($scope.viewingDate.getMonth() != m)
            loadScheduleData();
    };
    
    $scope.previousDay = function() {
        var m = $scope.viewingDate.getMonth();
        var d = $scope.viewingDate.getDate() - 1;
        $scope.viewingDate.setDate(d);
        if ($scope.viewingDate.getMonth() != m)
            loadScheduleData();
    };
    
    $scope.nextDay = function() {
        var m = $scope.viewingDate.getMonth();
        var d = $scope.viewingDate.getDate() +1;
        $scope.viewingDate.setDate(d);
        if ($scope.viewingDate.getMonth() != m)
            loadScheduleData();
    };
});