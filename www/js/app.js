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
                        console.log("db get:",res);
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
                        console.log("db put:",res);
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
                            }else if(doc._id.indexOf('player') == 0){
                                $rootScope.$broadcast('updatePlayer', doc);
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

.controller('AppController', ['$scope', '$state', '$q', '$interval', 'listener', 'pouchWrapper', function($scope, $state, $q, $interval, listener, pouchWrapper) {
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

    var KeystateEnum = {
        MISSING : "button-light",
        WON : "button-positive"
    };

    var gameLoopInterval;
    var gameLoopIntervalTime = 500;

    $scope.beaconsInRange;
    $scope.isBeacon = false;

    $scope.showPlayerWithin = 20;
    $scope.selectedPlayer = {};


    // Master major: 52642
    $scope.beaconToPlayerName = {
      "1111111111": "Player1",
      "1111122222": "Player2",
      "1111133333": "Player3",
      "5264247840": "Master"
    };
    $scope.beaconToPlayerId = {
        "1111111111": "player1",
        "1111122222": "player2",
        "1111133333": "player3",
        "5264247840": "Master"
    };

    function Key() {
      this.state = KeystateEnum.MISSING
    }

    $scope.finalWin = false;
    $scope.download = {
        state : false,
        value : 0,
        start : function() {
            $scope.download.state = true;
            $scope.download._interval = $interval(function() {
                $scope.download.value >= 500 ? $scope.download.won() : $scope.download.value++;
            }, 50)
        },
        stop : function () {
            $scope.download.value = 0;
            $scope.download.state = false;
            $interval.cancel($scope.download._interval);
            
            downloaded = 0;
            for(var i = 0 ; i < $scope.selectedPlayer.keys.length; i++){
              if($scope.selectedPlayer.keys[i].state == KeystateEnum.WON){
                downloaded++;
              }else{
                break;
              }
            }

            if(downloaded == $scope.selectedPlayer.keys.length){
              $state.go("end");
            }
        },
        won : function () {
            //$scope.keys[$scope.download.index].state = KeystateEnum.WON;
            // TODO hier muss der erste key des victims gestolen werden


            console.warn("you have won!!!");
            $scope.download.stop();
            $scope.selectedPlayer.attackTimeOut = true;
        },
        _interval : 0
    };



  $scope.formatDistance = function(meters) {
      if(meters > 1) {
          return meters.toFixed(3) + ' m';
      } else {
          return (meters * 100).toFixed(3) + ' cm';
      }
  };

  // UI callbacks
    $scope.attack = function(beacon){
        var victim = $scope.beaconToPlayerId[beacon.major+""+beacon.minor];
        $scope.players[$scope.getPlayerArrayId(victim)].underAttack = $scope.selectedPlayer._id;
        $scope.download.start();
    };
    $scope.defend = function(){     // TODO Ulrich: diese methode aufrufen wenn beacon out of range
        $scope.players[$scope.getPlayerArrayId($scope.selectedPlayer.underAttack)].attackTimeOut = true;
        $scope.selectedPlayer.underAttack = false;
    };

    $scope.$on('updatePlayer', function(event, doc) {
        var id = $scope.getPlayerArrayId(doc._id);
        $scope.players[id]=doc;
        if($scope.selectedPlayer._id == $scope.players[id]._id) $scope.selectedPlayer = $scope.players[id];


        if($scope.selectedPlayer.underAttack){
            //attack is going on, nothing to do right now
        }
        if($scope.selectedPlayer.attackTimeOut){
            $scope.download.stop();
            // TODO hier muss der cooldown angezeigt werden
        }
    });

  $scope.choosePlayer = function(player) {
    $scope.isBeacon = false;
    $scope.selectedPlayer = player;
    if(typeof window.EstimoteBeacons === "undefined") {
        //simulation
        $scope.isBeacon = true;
        if($scope.selectedPlayer._id == "player1") {
            $scope.beaconsInRange = [{
                major: 11111,
                minor: 22222,
                distance: 15
            }];
        }else if($scope.selectedPlayer._id == "player2") {
            $scope.beaconsInRange = [{
                major: 11111,
                minor: 11111,
                distance: 15
            }];
        }else if($scope.selectedPlayer._id == "player3") {
            $scope.beaconsInRange = [{
                major: 11111,
                minor: 11111,
                distance: 15
            }];
        }
    }else{
        window.EstimoteBeacons.startVirtualBeacon(player.major, player.minor, player.id, function () {
            console.log("Virtual Beacon started");
            gameLoopInterval = setInterval(gameLoop, gameLoopIntervalTime);
            $scope.isBeacon = true;
            $scope.$apply();
        });
    }
  };

  $scope.filterPlayersOutOfRange = function(player) {
    return player.distance < $scope.showPlayerWithin;
  };

  // Init
  document.addEventListener('deviceready', function() {
      if(typeof window.EstimoteBeacons !== "undefined") {
          window.EstimoteBeacons.startRangingBeaconsInRegion(function () {
              setInterval(function () {
                  window.EstimoteBeacons.getBeacons(function (data) {
                      $scope.beaconsInRange = data;
                      $scope.$apply();
                      console.log(data);
                  });
              }, gameLoopIntervalTime);
          });
      }
  }, false);


    $scope.resetPlayer = function (id) {
        $scope.players = $scope.players || [];
        $scope.players[id].name = "Player "+(id+1);
        $scope.players[id].major = 1111;
        $scope.players[id].minor = Array(4).join(id+1);
        $scope.players[id].img = "assets/player"+(id+1)+".jpg";
        $scope.players[id].keys = [
            new Key(), new Key(), new Key()
        ];
        $scope.players[id].underAttack = false;
        $scope.players[id].attackTimeOut = false;
    };

    $scope.getPlayerArrayId = function (_id) {
        for(var i=0;i<$scope.players.length;i++){
            if($scope.players[i]._id == _id) return i;
        }
    };


    // get players from db and bind any changes to $scope.players
    $scope.players = $scope.players || [];
    $q.all([
        pouchWrapper.get('player1'),
        pouchWrapper.get('player2'),
        pouchWrapper.get('player3')
    ]).then(function(res){
        $scope.players[0]=res[0];
        $scope.players[1]=res[1];
        $scope.players[2]=res[2];

        // players[0].major, players[0].minor, players[0].img,
        for(var i=0;i<3;i++){
            (function(i){
                $scope.$watch("[players["+i+"].name, players["+i+"].keys, players["+i+"].underAttack, players["+i+"].attackTimeOut]", function(newValue, oldValue) {
                    pouchWrapper.put($scope.players[i],$scope.players[i]._id,$scope.players[i]._rev).then(function(res){
                        $scope.players[i]._rev = res.rev;
                    });
                },true);
            })(i);
        }

        //reset players

        $scope.resetPlayer(0);
        $scope.resetPlayer(1);
        $scope.resetPlayer(2);
        // */

        // set some presets
        $scope.players[0].keys[0].state = KeystateEnum.WON;
        $scope.players[1].keys[1].state = KeystateEnum.WON;
        $scope.players[2].keys[2].state = KeystateEnum.WON;

    });







}]);
