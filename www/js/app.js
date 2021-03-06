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

    var dbName = "keyhunter3";
    var mydb = new PouchDB(dbName);
    PouchDB.replicate(dbName, 'http://ulrichson.iriscouch.com/'+dbName, {continuous: true});
    PouchDB.replicate('http://ulrichson.iriscouch.com/'+dbName, dbName, {continuous: true});
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
                        console.warn("db get error:",err,res);
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
                        console.warn("db put error:",err);
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
                            if(doc._id.indexOf('player') == 0){
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
    //alert("wait for safari webdeveloper console - just hit ok once opened");

    // Game parameter
    $scope.showPlayerWithin = 15; // in meter
    $scope.attackerEscapeDistance = 5; // in meter
    $scope.showMasterWithin = 10; // in meter
    $scope.masterKeyWinDistance = 0.5; // in meter
    $scope.downloadTime = 15000; // in ms
    $scope.penaltyTime = 15; // in s
    var gameLoopIntervalTime = 500;

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

	};

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

    $scope.attack = function(beacon){
        var victim = $scope.beaconToPlayerId[beacon.major+""+beacon.minor];
        $scope.selectedPlayer.myVictim = victim;
        $scope.players[$scope.getPlayerArrayId(victim)].underAttack = $scope.selectedPlayer._id;
        $scope.download.start();
    };

    function Key() {
      this.state = KeystateEnum.MISSING
    }

    $scope.finalWin = false;
    $scope.download = {
        state : false,
        value : 0,
        start : function() {
        	$scope.attackTimeout.value = $scope.penaltyTime;
            $scope.download.state = true;
            $scope.selectedPlayer.attackfailed = false;
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
            $scope.stealFirstKey($scope.selectedPlayer.myVictim);
            console.info("you have won a key from ",$scope.selectedPlayer.myVictim);
            $scope.download.stop();
            $scope.players[$scope.getPlayerArrayId($scope.selectedPlayer.myVictim)].underAttack = false;
            $scope.selectedPlayer.attackTimeOut = true;
            $scope.checkGameEnd();
        },
        _interval : 0
    };

    $scope.stealFirstKey = function(playerId) {
       for(var i=0; i<3; i++){
           if($scope.players[$scope.getPlayerArrayId(playerId)].keys[i].state == KeystateEnum.WON){
               $scope.players[$scope.getPlayerArrayId(playerId)].keys[i].state = KeystateEnum.MISSING;
               // TODO: das victim muss noch mitkriegen dass es bestohlen wurde
               $scope.selectedPlayer.keys[i].state = KeystateEnum.WON;
               break;
           }
       }
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
                },
                {
                    major: 11111,
                    minor: 33333,
                    distance: 15
                },
                {
                    major: 52642,
                    minor: 47840,
                    distance: 15
                }];
            }else if($scope.selectedPlayer.name == "Player 2") {
                $scope.beaconsInRange = [{
                    major: 11111,
                    minor: 11111,
                    distance: 15
                },
                {
                    major: 11111,
                    minor: 33333,
                    distance: 15
                }];
            }else if($scope.selectedPlayer.name == "Player 3") {
                $scope.beaconsInRange = [{
                    major: 11111,
                    minor: 11111,
                    distance: 15
                },
                {
                    major: 11111,
                    minor: 22222,
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

                        if ($scope.selectedPlayer.underAttack) {
                            var isAttackerInRange = false;
                            for (var i = 0; i < data.length; i++) {
                                var beacon = data[i];
                                // console.log($scope.beaconToPlayerId[beacon.major+""+beacon.minor] + "  " + $scope.selectedPlayer.underAttack);
                                if ($scope.beaconToPlayerId[beacon.major+""+beacon.minor] == $scope.selectedPlayer.underAttack && beacon.distance < $scope.attackerEscapeDistance) {
                                    isAttackerInRange = true;
                                    break;
                                }
                            }

                            if (!isAttackerInRange) {
                                // alert("escaped");
                                $scope.defend();
                            }
                        }

                        $scope.checkGameEnd(data);

                        $scope.$apply();
                        // console.log(data);
                    });
                }, gameLoopIntervalTime);
            });
        }
    };

    $scope.checkGameEnd = function(data){
        if ($scope.hasAllKeys()) {
            if($scope.forceSimulationMode == false) {
                $scope.isMasterKeyInRange = false;
                for (var i = 0; i < data.length; i++) {
                    var beacon = data[i];
                    if ($scope.beaconToPlayerId[beacon.major + "" + beacon.minor] == "master" && beacon.distance < $scope.masterKeyWinDistance) {
                        $scope.isMasterKeyInRange = true;
                        break;
                    }
                }
            }else{
                $scope.isMasterKeyInRange = true;
            }

            console.log("isMasterKeyInRange",$scope.isMasterKeyInRange);
            if ($scope.isMasterKeyInRange) {
                for (var i=0; i < $scope.players.length; i++) {
                    $scope.players[i].gameEnded = true;
                }
            }
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

    $scope.defend = function(){ 
        $scope.players[$scope.getPlayerArrayId($scope.selectedPlayer.underAttack)].attackfailed = true;
        $scope.players[$scope.getPlayerArrayId($scope.selectedPlayer.underAttack)].attackTimeOut = true;
        $scope.selectedPlayer.underAttack = false;
    };

    $scope.$on('updatePlayer', function(event, doc) {
        var id = $scope.getPlayerArrayId(doc._id);
        $scope.players[id]=doc;
        if($scope.selectedPlayer._id == $scope.players[id]._id) $scope.selectedPlayer = $scope.players[id];


        if($scope.selectedPlayer.underAttack){
            console.log("I am under attack");
        }
        if($scope.selectedPlayer.attackTimeOut){
            $scope.download.stop();
            $interval(function() {
                $scope.attackTimeout.value <= 0 ?  $scope.selectedPlayer.attackTimeOut = false : $scope.attackTimeout.value--;
            }, 1000, $scope.penaltyTime + 1);
        }
        if($scope.selectedPlayer.gameEnded){
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

    $scope.resetPlayers = function() {
        //reset players
        $scope.resetPlayer(0);
        $scope.resetPlayer(1);
        $scope.resetPlayer(2);

        // set some presets
        $scope.players[0].keys[0].state = KeystateEnum.WON;
        $scope.players[1].keys[1].state = KeystateEnum.WON;
        $scope.players[2].keys[2].state = KeystateEnum.WON;
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
                $scope.$watch("[players["+i+"].name, players["+i+"].keys, players["+i+"].underAttack, players["+i+"].attackTimeOut, players["+i+"].gameEnded]", function(newValue, oldValue) {
                    pouchWrapper.put($scope.players[i],$scope.players[i]._id,$scope.players[i]._rev).then(function(res){
                        $scope.players[i]._rev = res.rev;
                    });
                },true);
            })(i);
        }

        $scope.resetPlayers();
    });
}]);
