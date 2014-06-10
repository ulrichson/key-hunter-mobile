angular.module('app', ['ionic'])


.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('index', {
            url: "/",
            templateUrl: "play.html"
        })
        .state('play', {
            url: "/play",
            templateUrl: "play.html"
        })
        .state('won', {
            url: "/win",
            templateUrl: "win.html"
        })
		.state('attcked', {
            url: "/attacked",
            templateUrl: "attacked.html"
        });

    $urlRouterProvider.otherwise("/");

})

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

.controller('AppController', function($scope,$interval) {
    var KeystateEnum = {
        OUTOFRANGE : "button-light",
        INRANGE : "button-stable",
        WON : "button-positive"
    };


    function Key() {
        this.state = KeystateEnum.OUTOFRANGE
    }
    $scope.keys = [new Key(), new Key(), new Key(), new Key()];
    $scope.finalWin = false;
    $scope.download = {
        state : false,
        index : false,
        value : 0,
        start : function(index) {
            $scope.download.index = index;
            $scope.download.state = true;
            $scope.download._interval = $interval(function() {
                $scope.download.value >= 100 ? $scope.download.won() : $scope.download.value++;
            }, 50)
        },
        stop : function () {
            $scope.download.value = 0;
            $scope.download.state = false;
            $interval.cancel($scope.download._interval);
            
           downloaded = 0;
            for(var i = 0 ; i < $scope.keys.length; i++){
            	if($scope.keys[i].state == KeystateEnum.WON){
            		downloaded++;
            	}else{
            		break;
            	}
            	
            }
            if(downloaded == $scope.keys.length){
           		// redirectTo: '/win';
           		// alert($location);
              window.location.href = '#/win'
            }
        },
        won : function () {
            $scope.keys[$scope.download.index].state = KeystateEnum.WON;
            $scope.download.stop();
        },
        _interval : 0
    }




    // set some presets
    $scope.keys[1].state = KeystateEnum.INRANGE;
    $scope.keys[2].state = KeystateEnum.WON;







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

    window.EstimoteBeacons.startVirtualBeacon(major, minor, id, function() {
      alert("beacon started");
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
