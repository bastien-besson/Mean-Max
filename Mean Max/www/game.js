/*********************************** VECTOR ************************************************/
function Vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

Vector.prototype = {
    length: function () {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },
    length2: function () {
        return this.x * this.x + this.y * this.y;
    },
    distance: function (v) {
        var x = this.x - v.x;
        var y = this.y - v.y;
        return Math.sqrt(x * x + y * y);
    },
    radiansTo: function (v) {
        var dx = this.x - v.x;
        var dy = this.y - v.y;
        var radians = Math.atan2(dy, dx);
        return radians;
    },
    degreesTo: function (v) {
        var radians = this.radiansTo(v);
        var degrees = radians * 180 / Math.PI;
        degrees = degrees < 0 ? degrees + 360 : degrees;
        return degrees;
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
        "Doof": 2, //Destroyer
        "Tanker": 3, //Tanker
        "Wreck": 4, // Wreck
    }
};

GAME.Collision = function (t, a, b) {
    this.time = parseFloat(t),
    this.unitA = a;
    this.unitB = b;
};

GAME.Collision.prototype = {
    die: function () {
        if (this.unitB.typeId == GAME.UnitType.Destroyer
         && this.unitA.typeId == GAME.UnitType.Tanker) {
            return this.unitA;
        }

        if (this.unitA.typeId == GAME.UnitType.Destroyer
         && this.unitB.typeId == GAME.UnitType.Tanker) {
            return this.unitB;
        }

        return null;
    }
}

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
    this.destination = new Vector(parseFloat(inputs[5]), parseFloat(inputs[6]));
    this.target = new Vector();
    this.collision = [];
    this.throttle = 300;
    this.angle = 0;
    this.water = 0;

    switch (this.typeId) {
        case GAME.UnitType.Reaper:
            this.friction = 0.2;
            break;
        case GAME.UnitType.Destroyer:
            this.friction = 0.3;
            break;
        case GAME.UnitType.Doof:
            this.friction = 0.25;
            break;
        case GAME.UnitType.Tanker:
            this.friction = 0.4;
            this.throttle = 500;
            break;
        case GAME.UnitType.Wreck:
            this.throttle = 0;
            break;
    }
};

GAME.Unit.prototype = {
    thrust: function () {
        if (!this.target) {
            printErr('no thrust for : ' + this.name());
            return;
        }

        // Calculate angle to target
        this.angle = this.target.degreesTo(this.position);

        // Calculate new speed
        this.speed.x += Math.cos(this.angle * Math.PI / 180) * this.throttle / this.mass;
        this.speed.y += Math.sin(this.angle * Math.PI / 180) * this.throttle / this.mass;
    },

    moveTo: function (position, distance) {
        printErr('moveTo');
        var d = this.position.distance(position);

        if (d < 0.0001) {
            return;
        }

        var dx = position.x - this.position.x;
        var dy = position.y - this.position.y;
        var coef = distance / d;

        this.position.x += dx * coef;
        this.position.y += dy * coef;
    },

    move: function (time) {
        // Calculate new position
        this.position.x = Math.round(this.position.x + this.speed.x * time);
        this.position.y = Math.round(this.position.y + this.speed.y * time);
    },

    adjust: function () {
        // Update speed for next turn
        this.speed.x = Math.round(this.speed.x * (1 - this.friction));
        this.speed.y = Math.round(this.speed.y * (1 - this.friction));
    },

    findTarget: function (destroyer) {
        switch (this.typeId) {
            case 0: // Reaper
                var wreck = this.findClosest(GAME.UnitType.Wreck);
                var tanker = this.findClosest(GAME.UnitType.Tanker, destroyer);
                var distanceRD = this.position.distance(destroyer.position);
                var distanceDT = tanker ? destroyer.position.distance(tanker.position) : Infinity;
                var distanceRW = wreck ? this.position.distance(wreck.position) : Infinity;
                var distanceRDT = distanceRD + distanceDT;

                this.target.x = !wreck || distanceRDT < distanceRW ?
                    destroyer.position.x : wreck.position.x;
                this.target.y = !wreck || distanceRDT < distanceRW ?
                    destroyer.position.y : wreck.position.y;
                break;
            case 1: // Destroyer
                this.target.x = this.findClosest(GAME.UnitType.Tanker).position.x;
                this.target.y = this.findClosest(GAME.UnitType.Tanker).position.y;
                break;
        }
    },

    findClosest: function (typeId, source) {
        var source = (source || this);
        var units = GAME.main.units
                    .filter(unit => unit.typeId == typeId)
                    .sort((a, b) => source.position.distance(a.position) - source.position.distance(b.position));

        return units[0];
    },

    bounce: function (unit) {
        printErr('bounce');
        var impulseCoeff = 0.5;
        var mcoeff = unit ?
            (this.mass + unit.mass) / (this.mass * unit.mass) : 1 / this.mass;
        var n = new Vector(
            this.position.x - (unit ? unit.position.x : 0),
            this.position.y - (unit ? unit.position.y : 0)
            );
        var nLength2 = n.length2();
        var dv = new Vector(
            this.speed.x - (unit ? unit.speed.x : 0),
            this.speed.y - (unit ? unit.speed.y : 0)
            );
        var product = (n.x * dv.x + n.y * dv.y) / (nLength2 * mcoeff);
        var f = new Vector(n.x * product, n.y * product);

        var m1c = 1 / this.mass;
        this.speed.x -= f.x * m1c;
        this.speed.y -= f.y * m1c;


        if (unit) {
            var m2c = 1 / unit.mass;
            unit.speed.x += f.x * m2c;
            unit.speed.y += f.y * m2c;
        }

        f.x *= impulseCoeff;
        f.y *= impulseCoeff;

        // Normalize vector at min or max impulse
        var impulse = f.length();
        var minImpulse = 30;
        var coeff = 1;

        if (impulse > 0 && impulse < minImpulse) {
            coeff = minImpulse / impulse;
        }

        f.x *= coeff;
        f.y *= coeff;

        this.speed.x -= f.x * m1c;
        this.speed.y -= f.y * m1c;

        if (unit) {
            unit.speed.x += f.x * m2c;
            unit.speed.y += f.y * m2c;
        }

        var diff = (this.position.distance(unit ? unit.position : new Vector(0, 0)) - this.radius - (unit ? unit.radius : GAME.mapRadius)) / 2;

        if (unit && diff <= 0) {
            // Unit overlapping. Fix positions.
            this.moveTo(unit.position, diff - 0.001);
            unit.moveTo(this.position, diff - 0.001);
        }
        else if (!unit && diff >= 0) {
            this.moveTo(new Vector(), diff + 0.001);
        }
    },

    getCollision: function () {
        var collisions = [];

        // Test collision with map border first
        collisions.push(this.getMapCollision());

        // Test collision with all other units
        GAME.main.units
            .filter(u => u.unitId != this.unitId)
            .forEach(u => collisions.push(this.getUnitCollision(u)));

        collisions = collisions // order collision by time when it will happen
            .filter(u => u)
            .sort((a, b) => a.time - b.time);

        return collisions.length ? collisions[0] : null;
    },

    getMapCollision: function () {

        // Tankers don't collide with the map
        if (this.typeId == GAME.UnitType.Tanker) {
            return new GAME.Collision(Infinity, this);
        }

        // Check instant collision
        if (this.position.length() + this.radius >= GAME.mapRadius) {
            //printErr('INSTANT MAP COLLISION :' + this.position.length());
            return new GAME.Collision(0, this);
        }

        // Both units are motionless
        if (this.speed.length() == 0) {
            return new GAME.Collision(Infinity, this);
        }

        // Search collision with map border
        // Resolving: sqrt((x + t*vx)^2 + (y + t*vy)^2) = radius 
        //        <=> t^2*(vx^2 + vy^2) + t*2*(x*vx + y*vy) + x^2 + y^2 - radius^2 = 0
        // at^2 + bt + c = 0;
        // a = vx^2 + vy^2
        // b = 2*(x*vx + y*vy)
        // c = x^2 + y^2 - radius^2

        var a = this.speed.length2();

        // No collision : units are going in separate ways
        if (a <= 0) {
            return new GAME.Collision(Infinity, this);
        }

        var b = 2 * (this.position.x * this.speed.x + this.position.y * this.speed.y);
        var c = this.position.length2() - (GAME.mapRadius - this.radius) * (GAME.mapRadius - this.radius);
        var delta = b * b - 4 * a * c;

        if (delta <= 0) {
            return new GAME.Collision(Infinity, this);
        }

        var t = (-b + Math.sqrt(delta)) / (2 * a);

        if (t < 0) {
            return new GAME.Collision(Infinity, this);
        }

        //printErr('MAP COLLISION IN :' + t);
        return new GAME.Collision(t, this);
    },

    getUnitCollision: function (unit) {
        // Check instant collision
        if (this.position.distance(unit.position) <= this.radius + unit.radius) {
            return new GAME.Collision(0, this, unit);
        }

        // Both units are motionless
        if (this.speed.length() + unit.speed.length() == 0) {
            return null;
        }

        // Change referential to current unit
        // Unit u is not at point (0, 0) with a speed vector of (0, 0)
        var unitPosition = new Vector(
            this.position.x - unit.position.x,
            this.position.y - unit.position.y);

        var unitSpeed = new Vector(
            this.speed.x - unit.speed.x,
            this.speed.y - unit.speed.y);

        // Resolving: sqrt((x + t*vx)^2 + (y + t*vy)^2) = radius 
        //        <=> t^2*(vx^2 + vy^2) + t*2*(x*vx + y*vy) + x^2 + y^2 - radius^2 = 0
        // at^2 + bt + c = 0;
        // a = vx^2 + vy^2
        // b = 2*(x*vx + y*vy)
        // c = x^2 + y^2 - radius^2

        var a = unitSpeed.length2();

        // No collision : units are going in separate ways
        if (a <= 0) {
            return null;
        }

        var b = 2 * (unitPosition.x * unitSpeed.x + unitPosition.y * unitSpeed.y);
        var c = unitPosition.length2() - (this.radius + unit.radius) * (this.radius + unit.radius);
        var delta = b * b - 4 * a * c;

        if (delta <= 0) {
            return null;
        }

        var t = (-b - Math.sqrt(delta)) / (2 * a);

        if (t <= 0.01) {
            return null;
        }

        return new GAME.Collision(t, this, unit);
    },

    name: function () {
        var name = Object.keys(GAME.UnitType).find(k => GAME.UnitType[k] == this.typeId) + '[' + this.unitId + ',' + this.playerId + ']';
        return name;
    },

    toString: function () {
        var value = this.name() + ' \n    p:' + this.position + ' \n    d:' + this.destination + ' \n    s:' + this.speed + '\n';
        //if (this.collision) {p
        //    value += 'Time: ' + this.collision.time + ' ';
        //    value += this.collision.unitB ?
        //        this.collision.unitB.name() + ' { pos:' + this.collision.unitB.position + ' }\n' : 'Map\n';
        //}

        return value;
    },
}

GAME.Player = function () {
    this.score = 0;
    this.rage = 0;
};

GAME.main = (function () {
    var that = {
        loopIndex: 1,
        units: [],
        players: new Array(3).fill().map(player => new GAME.Player())
    };

    var startTimer;
    var time;

    that.log = function () {
        that.units.sort((unitA, unitB) => unitA.playerId - unitB.playerId);

        // Log unit infos
        //var reaper = that.units.find(u => u.typeId == GAME.UnitType.Reaper && u.playerId == 0);
        //printErr(reaper);
        //that.units.filter(u => u.typeId == 1).forEach(destroyer => printErr(destroyer));
        //that.units.filter(u => u.typeId == 3).forEach(tanker => printErr(tanker));
        //that.units.filter(u => u.typeId == 4).forEach(wreck => printErr(wreck));
        printErr("execution time : " + (new Date().getTime() - startTimer));
    };

    that.run = function () {
        // game loop
        while (true) {
            time = 0;
            startTimer = new Date().getTime();
            that.players.forEach(player => { player.score = parseInt(readline()) });
            that.players.forEach(player => { player.rage = parseInt(readline()) });

            // Update all units
            that.units = [];
            for (var i = 0, unitCount = parseInt(readline()) ; i < unitCount; i++) {
                that.units.push(new GAME.Unit(readline().split(' ')));
            }

            // Declare our units
            var reaper = that.units.find(u => u.playerId == 0 && u.typeId == GAME.UnitType.Reaper);
            var destroyer = that.units.find(u => u.playerId == 0 && u.typeId == GAME.UnitType.Destroyer);

            // Print reaper current position
            printErr('REAPER : ' + reaper.position);

            // Find user targets
            reaper.findTarget(destroyer);
            destroyer.findTarget();

            // Update speed
            reaper.thrust();
            destroyer.thrust();

            // Update collisions
            var collision = that.getNextCollision();

            while (collision.time + time < 1) {

                printErr('NEXT COLLISION :' + collision.time + ' ' +
                    (collision.unitA ? collision.unitA.name() : 'None') + ' ' +
                    (collision.unitB ? collision.unitB.name() : 'Map'));

                printErr('Before Movement =>');
                printErr('UNIT A: ' + collision.unitA.position + ' ' + collision.unitA.speed);
                if (collision.unitB) {
                    printErr('UNIT B: ' + collision.unitB.position + ' ' + collision.unitB.speed);
                    printErr('distance entre A et B : ' + collision.unitA.position.distance(collision.unitB.position));
                }

                that.units.forEach(u => u.move(collision.time));
                time += collision.time;

                //if (collision.unitA && collision.unitB) {
                printErr('After Movement && Before Collision =>');
                printErr('UNIT A: ' + collision.unitA.position + ' ' + collision.unitA.speed);
                if (collision.unitB) {
                    printErr('UNIT B: ' + collision.unitB.position + ' ' + collision.unitB.speed);
                    printErr('distance entre A et B : ' + collision.unitA.position.distance(collision.unitB.position));
                }

                that.playCollision(collision);

                //if (collision.unitA && collision.unitB) {
                printErr('After collision =>');
                printErr('UNIT A: ' + collision.unitA.position + ' ' + collision.unitA.speed);
                if (collision.unitB) {
                    printErr('UNIT B: ' + collision.unitB.position + ' ' + collision.unitB.speed);
                    printErr('distance entre A et B : ' + collision.unitA.position.distance(collision.unitB.position));
                }

                collision = that.getNextCollision();
            }

            // No more collision. Move units until the end of the round
            that.units.forEach(u => u.move(1 - time));

            printErr('REAPER : ' + reaper.position);

            // Log infos
            that.log();

            // adjust units for next turn
            that.units.forEach(u => u.adjust());

            // Print user units accelerations
            print(reaper.target + ' ' + reaper.throttle);
            print(destroyer.target ? destroyer.target + ' ' + destroyer.throttle : 'WAIT');
            print('WAIT'); // Placeholder for the next leagues

            // Increment loop index 
            that.loopIndex++;
        }
    };

    that.getNextCollision = function () {
        var result = [];
        result.push(new GAME.Collision(1));

        that.units
            .filter(unit => unit.typeId != GAME.UnitType.Tanker && unit.typeId != GAME.UnitType.Wreck)
            .forEach(unit => {
                var collision = unit.getMapCollision();
                result.push(collision);

                that.units
                    .filter(other =>
                        other.unitId != unit.unitId &&
                        other.typeId != GAME.UnitType.Tanker &&
                        other.typeId != GAME.UnitType.Wreck)
                    .forEach(other => {
                        var collision = unit.getUnitCollision(other);

                        if (collision && !result.find(c => c.time == collision.time)) {
                            result.push(collision);
                        }
                    });
            });

        result = result
            .filter(c => c)
            .sort((a, b) => a.time - b.time);

        return result[0];
    };

    that.playCollision = function (collision) {
        if (!collision.unitB) {
            // Bounce with border
            collision.unitA.bounce();
        } else {
            // Check if a destroyer kill a tanker
            var tanker = collision.die();

            if (tanker) {
                // Tanker becomes a wreck
                tanker.typeId = GAME.UnitType.Wreck;
            } else {
                collision.unitA.bounce(collision.unitB);
            }
        }
    };

    return that;
})();

GAME.main.run();