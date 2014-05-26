angular.module('app', ['ionic'])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
  });
})

.controller('AppController', function($scope) {

  // function formatDistance(meters) {
  //     if(meters > 1) {
  //         return meters.toFixed(3) + ' m';
  //     } else {
  //         return (meters * 100).toFixed(3) + ' cm';
  //     }
  // }

  $scope.beacons = [];

  document.addEventListener('deviceready', function() {
    // start looking for beacons
    window.EstimoteBeacons.startRangingBeaconsInRegion(function () {
        //every now and then get the list of beacons in range
        setInterval(function () {
            window.EstimoteBeacons.getBeacons(function (data) {
                $scope.beacons = data;
                $scope.$apply();
            });
        }, 200);
    });
  }, false);

  // var beaconManager = new BeaconManager();
  // beaconManager.startPulling(1000);

  // beaconManager.on('updated', function(beacon) {
      
  // });

  // beaconManager.on('added', function(beacon) {
  //   alert("added");
  //   $scope.push(beacon);
  // });

  // beaconManager.on('removed', function(beacon) {

  // });

})
