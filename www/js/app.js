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

.factory('myPouch', [function() {

    var mydb = new PouchDB('ng-pouch');
    PouchDB.replicate('ng-pouch', 'http://mdix.iriscouch.com/keyhunter', {continuous: true});
    PouchDB.replicate('http://mdix.iriscouch.com/keyhunter', 'ng-pouch', {continuous: true});
    return mydb;

}])
.factory('pouchWrapper', ['$q', '$rootScope', 'myPouch', function($q, $rootScope, myPouch) {

    return {
        get: function(id){
            var deferred = $q.defer();
            myPouch.get(id, function(err, res) {
                $rootScope.$apply(function() {
                    if (err) {
                        deferred.reject(err);
                        console.warn(err);
                    } else {
                        deferred.resolve(res);
                        console.log(res);
                    }
                });
            });
            return deferred.promise;
        },
        put: function(doc, id, rev){
            var deferred = $q.defer();
            myPouch.put(doc, id, rev, function(err, res) {
                $rootScope.$apply(function() {
                    if (err) {
                        deferred.reject(err);
                        console.warn(err);
                    } else {
                        deferred.resolve(res);
                        console.log(res);
                    }
                });
            });
            return deferred.promise;
        },
        add: function(doc) {
            var deferred = $q.defer();
            myPouch.post(doc, function(err, res) {
                $rootScope.$apply(function() {
                    if (err) {
                        deferred.reject(err)
                    } else {
                        deferred.resolve(res)
                    }
                });
            });
            return deferred.promise;
        },
        remove: function(id) {
            var deferred = $q.defer();
            myPouch.get(id, function(err, doc) {
                $rootScope.$apply(function() {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        myPouch.remove(doc, function(err, res) {
                            $rootScope.$apply(function() {
                                if (err) {
                                    deferred.reject(err)
                                } else {
                                    deferred.resolve(res)
                                }
                            });
                        });
                    }
                });
            });
            return deferred.promise;
        }
    }

}])
.factory('listener', ['$rootScope', 'myPouch', function($rootScope, myPouch) {

    myPouch.changes({
        continuous: true,
        onChange: function(change) {
            if (change.deleted === true) {
                $rootScope.$apply(function() {
                    $rootScope.$broadcast('deleteDBentry', change.id);
                });
            }else{
                $rootScope.$apply(function() {
                    myPouch.get(change.id, function(err, doc) {
                        $rootScope.$apply(function() {
                            if (err) console.log(err);
                            if(doc._id == "gamestatus") {
                                $rootScope.$broadcast('updateGamestatus', doc);
                            }else if(doc.type == "attack"){
                                $rootScope.$broadcast('updateAttacks', doc);
                            }else if(doc.type == "stealing"){
                                $rootScope.$broadcast('updateStealings', doc);
                            }
                        })
                    });
                })
            }
        }
    })
}])

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

.controller('AppController', ['$scope', '$state', '$interval', 'listener', 'pouchWrapper', function($scope, $state, $interval, listener, pouchWrapper) {
    $scope.playerId = 123123;
    $scope.form = {};

    // gamestatus
    pouchWrapper.get('gamestatus').then(function(res){
        $scope.gamestatus=res;
    });
    $scope.$on('updateGamestatus', function(event, doc) {
        $scope.gamestatus = doc;
    });
    $scope.storeGamestatus = function() {
        pouchWrapper.put($scope.gamestatus,$scope.gamestatus._id, $scope.gamestatus._rev);
    };
    $scope.$on('deleteDBentry', function(event, id) {
        for (var i = 0; i<$scope.attacks.length; i++) {
            if ($scope.attacks[i]._id === id) {
                $scope.attacks.splice(i,1);
            }
        };
        for (var i = 0; i<$scope.stealings.length; i++) {
            if ($scope.stealings[i]._id === id) {
                $scope.stealings.splice(i,1);
            }
        }
    });

    //attacks
    $scope.attacks = [];
    $scope.attack = function () {
        pouchWrapper.add({
            type : "attack",
            attacker: $scope.playerId,
            victim: $scope.form.newAttackVictim
        });
        $scope.form.newAttackVictim = '';
    };
    $scope.removeAttack = function(id){
        pouchWrapper.remove(id).then(function(res) {
            // console.log(res);
        }, function(reason) {
            console.warn(reason);
        });
    };
    $scope.$on('updateAttacks', function(event, doc) {
        $scope.attacks.push(doc);
    });


    //stealings
    $scope.stealings = [];
    $scope.steal = function () {
        pouchWrapper.add({
            type : "stealing",
            attacker: $scope.playerId,
            victim: $scope.form.newStealingVictim
        });
        $scope.form.newStealingVictim = '';
    };
    $scope.removeStealing = function(id){
        pouchWrapper.remove(id).then(function(res) {
            // console.log(res);
        }, function(reason) {
            console.warn(reason);
        });
    };
    $scope.$on('updateStealings', function(event, doc) {
        $scope.stealings.push(doc);
    });



    var gameLoopInterval;
    var gameLoopIntervalTime = 500;

    $scope.beaconsInRange;
    $scope.isBeacon = false;

    $scope.showPlayerWithin = 20;

    $scope.selectedPlayer = {};
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
      minor: 33333
    }];

    var KeystateEnum = {
      OUTOFRANGE : "button-light",
      INRANGE : "button-stable",
      WON : "button-positive"
    };

    // Master major: 52642
    $scope.beaconToPlayerName = {
      "1111111111": "Player1",
      "1111122222": "Player2",
      "1111133333": "Player3",
      "5264247840": "Master"
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


  $scope.formatDistance = function(meters) {
      if(meters > 1) {
          return meters.toFixed(3) + ' m';
      } else {
          return (meters * 100).toFixed(3) + ' cm';
      }
  };

  // UI callbacks
  $scope.choosePlayer = function(player) {
    $scope.isBeacon = false;
    $scope.selectedPlayer = player;
    window.EstimoteBeacons.startVirtualBeacon(player.major, player.minor, player.id, function() {
      console.log("Virtual Beacon started");
      gameLoopInterval = setInterval(gameLoop, gameLoopIntervalTime);
      $scope.isBeacon = true;
      $scope.$apply();
    });
  };

  $scope.filterPlayersOutOfRange = function(player) {
    return player.distance < $scope.showPlayerWithin;
  };

  // Init
  document.addEventListener('deviceready', function() {
    window.EstimoteBeacons.startRangingBeaconsInRegion(function () {
      setInterval(function () {
        window.EstimoteBeacons.getBeacons(function (data) {
          $scope.beaconsInRange = data;
          $scope.$apply();
          console.log(data);
        });
      }, gameLoopIntervalTime);
    });
  }, false);

  // Game Loop
  var gameLoop = function () {
    // fetch gamestatus from REST service

  };

}]);
