angular.module('app', ['ionic'])

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
    .state("home", {
      url: "/",
      templateUrl: "home.html"
    })
    .state("play", {
      url: "/play",
      templateUrl: "play.html"
    })
    .state("end", {
      url: "/end",
      templateUrl: "end.html"
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

.controller('AppController', function($scope, $state, $interval) {
    var gameLoop;
    var gameIntervalTime = 500;

    $scope.beaconsInRange = [];
    $scope.isBeacon = false;

    $scope.showBeaconWithin = 20;

    $scope.player = {};
    $scope.players = [{
      name: "Player 1",
      id: "9728D74C-CD81-4215-B454-FC9E66F38CEA",
      major: 11111,
      minor: 11111
    }, {
      name: "Player 2",
      id: "A4B015E9-544D-431A-B4AA-3ABE0FFFD804",
      major: 11111,
      minor: 22222
    }, {
      name: "Player 3",
      id: "AF31C6CA-9A06-477B-9AAA-52C0888697E5",
      major: 11111,
      minor: 22222
    }];

    var KeystateEnum = {
      OUTOFRANGE : "button-light",
      INRANGE : "button-stable",
      WON : "button-positive"
    };

    $scope.beaconIdToPlayerName = {
      "11111": "Player1",
      "22222": "Player2",
      "33333": "Player3",
      "52642": "Master"
    }

    function Key() {
      this.state = KeystateEnum.OUTOFRANGE
    }

    $scope.keys = [new Key(), new Key(), new Key()];
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
              // window.location.href = '#/win'
              $state.go("end");
            }
        },
        won : function () {
            $scope.keys[$scope.download.index].state = KeystateEnum.WON;
            $scope.download.stop();
        },
        _interval : 0
    }




    // set some presets
    // $scope.keys[1].state = KeystateEnum.INRANGE;
    // $scope.keys[2].state = KeystateEnum.WON;


  // function formatDistance(meters) {
  //     if(meters > 1) {
  //         return meters.toFixed(3) + ' m';
  //     } else {
  //         return (meters * 100).toFixed(3) + ' cm';
  //     }
  // }

  // UI callbacks
  $scope.choosePlayer = function(player) {
    $scope.player = player;
    // $state.go("play");

    window.EstimoteBeacons.startVirtualBeacon(player.major, player.minor, player.id, function() {
      console.log("Phone is now a beacon");
      $scope.isBeacon = true;

      // Game loop
      gameLoop = setInterval(function () {
        // fetch gamestatus from REST service

      }, gameIntervalTime);

    });
  };

  // Init
  document.addEventListener('deviceready', function() {
    // start looking for beacons
    window.EstimoteBeacons.startRangingBeaconsInRegion(function () {
        //every now and then get the list of beacons in range
        setInterval(function () {
            window.EstimoteBeacons.getBeacons(function (data) {
                $scope.beaconsInRange = data;
                $scope.$apply();
            });
        }, gameIntervalTime);
    });
  }, false);

})
