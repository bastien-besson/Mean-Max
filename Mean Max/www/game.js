/*********************************** VECTOR ************************************************/
function Vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Vector.prototype = {
    length: function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },
    distance: function (v) {
        var x = this.x - v.x;
        var y = this.y - v.y;
        return Math.sqrt(x * x + y * y);
    },
    toString: function () {
        return this.x + ' ' + this.y;
    }
}

/********************************** GAME **************************************************/
var GAME = {
    mapRadius: 6000,
    UnitType: {
        "Reaper": 0, //Reaper
        "Destroyer": 1, //Destroyer
        "Tanker": 3, //Tanker
        "Wreck": 4, // Wreck
    }
};

GAME.Unit = function (inputs) {
    this.unitId = parseInt(inputs[0]);
    this.typeId = parseInt(inputs[1]);
    this.playerId = parseInt(inputs[2]);
    this.mass = parseFloat(inputs[3]);
    this.radius = parseFloat(inputs[4]);
    this.position = new Vector(parseFloat(inputs[5]), parseFloat(inputs[6]));
    this.speed = new Vector(parseFloat(inputs[7]), parseFloat(inputs[8]));
    this.extra = parseInt(inputs[9]);
    this.extra2 = parseInt(inputs[10]);
    this.target = null;
    this.water = 0;
};

GAME.Unit.prototype = {
    findTarget: function (destroyer) {
        switch (this.typeId) {
            case 0: // Reaper
                var wreck = this.findClosest(GAME.UnitType.Wreck);
                var tanker = this.findClosest(GAME.UnitType.Tanker, destroyer);
                var distanceRD = this.position.distance(destroyer.position);
                var distanceDT = tanker ? destroyer.position.distance(tanker.position) : Infinity;
                var distanceRW = wreck ? this.position.distance(wreck.position) : Infinity;
                var distanceRDT = distanceRD + distanceDT;
                
                this.target = !wreck || distanceRDT < distanceRW ? destroyer : wreck;
                break;
            case 1: // Destroyer
                this.target = this.findClosest(GAME.UnitType.Tanker);
                break;
        }
    },
    
    findClosest: function (typeId, source) {
        var source = (source || this);
        var units = GAME.main.units
                    .filter(unit => 
                            unit.typeId == typeId  
                            //&& (GAME.UnitType.Tanker != typeId || unit.position.length() < GAME.mapRadius)
                        )
                    .sort((a, b) => source.position.distance(a.position) - source.position.distance(b.position));

        return units[0];
    },

    toString: function () {
        var name = Object.keys(GAME.UnitType).find(k => GAME.UnitType[k] == this.typeId);

        switch (this.typeId) {
            case GAME.UnitType.Reaper:
            case GAME.UnitType.Destroyer:
                return name + this.playerId + ' :' + this.position + ' ' + this.speed + ' ' + this.target;
                break;
            case GAME.UnitType.Tanker:
            case GAME.UnitType.Wreck:
                return name + this.playerId + ' :' + this.position + ' ' + this.extra + ' ' + this.extra2;
                break;
        };
    },
}

GAME.Player = function () {
    this.score = 0;
    this.rage = 0;
};

GAME.main = (function () {
    var that = {
        units: [],
        players: new Array(3).fill().map(player => new GAME.Player())
    };

    that.log = function () {
        that.units.sort((unitA, unitB) => unitA.playerId - unitB.playerId);

        // Log unit infos
        that.units.filter(u => u.typeId == 0).forEach(reaper => printErr(reaper));
        that.units.filter(u => u.typeId == 1).forEach(destroyer => printErr(destroyer));
        that.units.filter(u => u.typeId == 3).forEach(tanker => printErr(tanker));
        that.units.filter(u => u.typeId == 4).forEach(wreck => printErr(wreck));
    };

    that.run = function () {
        // game loop
        while (true) {
            that.players.forEach(player => { player.score = parseInt(readline()) });
            that.players.forEach(player => { player.rage = parseInt(readline()) });

            // Update all units
            that.units = [];
            for (var i = 0, unitCount = parseInt(readline()); i < unitCount; i++) {
                that.units.push(new GAME.Unit(readline().split(' ')));
            }

            var reaper = that.units.find(u => u.playerId == 0 && u.typeId == GAME.UnitType.Reaper);
            var destroyer = that.units.find(u => u.playerId == 0 && u.typeId == GAME.UnitType.Destroyer);

            // findTarget user units
            reaper.findTarget(destroyer);
            destroyer.findTarget();

            // print user units accelerations
            print(reaper.target ? reaper.target.position + ' 300' : 'WAIT');
            print(destroyer.target ? destroyer.target.position + ' 300' : 'WAIT');
            print('WAIT'); // Placeholder for the next leagues

            // Log infos
            that.log();
        }
    };

    return that;
})();

GAME.main.run();