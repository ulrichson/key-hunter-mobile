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

    // Game parameter
    $scope.showPlayerWithin = 20; // in meter
    $scope.showMasterWithin = 0.5; // in meter
    $scope.masteKeyWinDistance = 0.5 // in meter
    $scope.downloadTime = 10000; // in ms
    $scope.penaltyTime = 5; // in s
    var gameLoopIntervalTime = 500;

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
        WON : "button-calm"
    };


    $scope.beaconsInRange;
    $scope.isBeacon = false;

    $scope.selectedPlayer = {};
    $scope.forceSimulationMode = true;

	$scope.attackTimeout ={
		_interval : 0,
		value : 0

	}

    $scope.beaconToPlayerName = {
        "1111111111": "Player 1",
        "1111122222": "Player 2",
        "1111133333": "Player 3"
    };
    $scope.beaconToPlayerId = {
        "1111111111": "player1",
        "1111122222": "player2",
        "1111133333": "player3",
        "5264247840": "master"
    };
    $scope.beaconToPlayerImage = {
        "1111111111": "assets/player1.jpg",
        "1111122222": "assets/player2.jpg",
        "1111133333": "assets/player3.jpg"
    };

    $scope.beaconToMasterName = {
        "5264247840": "Master"
    };
    $scope.beaconToMasterImage = {
        "5264247840": "assets/master.png"
    };


    var guid = (function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
        }
        return function() {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };
    })();

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
                $scope.download.value >= 100 ? $scope.download.won() : $scope.download.value++;
            }, $scope.downloadTime / 100);
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

            // if(downloaded == $scope.selectedPlayer.keys.length){
            //   $state.go("end");
            // }
        },
        won : function () {
            //$scope.keys[$scope.download.index].state = KeystateEnum.WON;
            // TODO hier muss der erste key des victims gestolen werden


            console.warn("you have won!!!");
            $scope.download.stop();
            $scope.attackTimeout.value = $scope.penaltyTime;
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
    $scope.forceSimulationModeChange = function() {
        $scope.forceSimulationMode = !$scope.forceSimulationMode; // no idea, why it needs to be set manually...
        // if (!$scope.forceSimulationMode && typeof window.EstimoteBeacons !== "undefined") {
        //     window.EstimoteBeacons.stopRangingBeaconsInRegion({
        //         console.log("Stopped to range for beacons in region");
        //     });
        // }
        $scope.$apply();
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
        console.log("forceSimulationMode: " + $scope.forceSimulationMode);
        if($scope.forceSimulationMode || typeof window.EstimoteBeacons === "undefined") {
            console.log("Starting Simulation mode");

            //simulation
            $scope.isBeacon = true;
            if($scope.selectedPlayer.name == "Player 1") {
                $scope.beaconsInRange = [{
                    major: 11111,
                    minor: 22222,
                    distance: 15
                }];
            }else if($scope.selectedPlayer.name == "Player 2") {
                $scope.beaconsInRange = [{
                    major: 11111,
                    minor: 11111,
                    distance: 15
                }];
            }else if($scope.selectedPlayer.name == "Player 3") {
                $scope.beaconsInRange = [{
                    major: 11111,
                    minor: 11111,
                    distance: 15
                }];
            }
        }else{
            console.log("Starting Virtual Beacon mode");
            window.EstimoteBeacons.startVirtualBeacon(player.major, player.minor, player.beacon_id, function () {
                console.log("Virtual Beacon started");
                $scope.isBeacon = true;
                $scope.$apply();
            });

            console.log("Starting to range for beacons in region");
            window.EstimoteBeacons.startRangingBeaconsInRegion(function () {
                console.log("Ranging for beacons in region");
                setInterval(function () {
                    window.EstimoteBeacons.getBeacons(function (data) {
                        $scope.beaconsInRange = data;

                        // [UNTESTED] check if attacker is still in range
                        if ($scope.selectedPlayer.underAttack) {
                            var isAttackerInRange = false;
                            for (var i = 0; i < data.length; i++) {
                                if ($scope.beaconToPlayerId[data.major+""+data.minor] == "$scope.selectedPlayer.underAttack" && data.distance < $scope.showPlayerWithin) {
                                    isAttackerInRange = true;
                                    break;
                                }
                            }

                            if (!isAttackerInRange) {
                                $scope.defend();
                            }
                        }

                        // [UNTESTED] Check if master key is in range
                        if (scope.hasAllKeys()) {
                            var isMasterKeyInRange = false;
                            for (var i = 0; i < data.length; i++) {
                                if ($scope.beaconToPlayerId[data.major+""+data.minor] == "master" && data.distance < $scope.masteKeyWinDistance) {
                                    isMasterKeyInRange = true;
                                    break;
                               }
                            }

                            if (isMasterKeyInRange) {
                                // [TODO] end game for other players
                                for (var i=0; i < $scope.players.length; i++) {
                                    $scope.players[i].gameEnded = true;
                                }
                            }
                        }

                        $scope.$apply();
                        // console.log(data);
                    });
                }, gameLoopIntervalTime);
            });
        }
    };

    $scope.hasAllKeys = function() {
        for(var i = 0 ; i < $scope.selectedPlayer.keys.length; i++) {
            if ($scope.selectedPlayer.keys[i].state != KeystateEnum.WON) {
                return false;
            }
        }
        return true;
    };

    $scope.filterPlayerBeacons = function(beacon) {
        return typeof $scope.beaconToPlayerName[beacon.major+""+beacon.minor] !== "undefined" && beacon.distance < $scope.showPlayerWithin;
    };

    $scope.filterMasterBeacons = function(beacon) {
        return typeof $scope.beaconToMasterName[beacon.major+""+beacon.minor] !== "undefined" && beacon.distance < $scope.showMasterWithin;
    };

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
            $interval(function() {
                $scope.attackTimeout.value <= 0 ?  $scope.selectedPlayer.attackTimeOut = false : $scope.attackTimeout.value--;
            }, 1000, $scope.penaltyTime + 1);
        }
        if(scope.selectedPlayer.gameEnded){
            $state.go("end");
        }
    });

    // Init
    document.addEventListener('deviceready', function() {
        $scope.forceSimulationMode = typeof window.EstimoteBeacons === "undefined";
        $scope.$apply();
    }, false);

    $scope.resetPlayer = function (id) {
        $scope.players = $scope.players || [];
        $scope.players[id].name = "Player "+(id+1);
        $scope.players[id].major = 11111;
        $scope.players[id].minor = Array(6).join(id+1);
        $scope.players[id].img = "assets/player"+(id+1)+".jpg";
        $scope.players[id].beacon_id = guid();
        $scope.players[id].keys = [
            new Key(), new Key(), new Key()
        ];
        $scope.players[id].underAttack = false;
        $scope.players[id].attackTimeOut = false;
        $scope.players[id].gameEnded = false;
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
