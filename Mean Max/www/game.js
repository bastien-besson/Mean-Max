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
    this.time = Number(t).toFixed(2),
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
    this.destination = new Vector();
    this.target = null;
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
    move: function (time) {
        // Calculate angle to target
        this.angle = this.target ? this.target.degreesTo(this.position) : this.speed.degreesTo(new  Vector());

        // Calculate new speed
        this.speed.x += Math.cos(this.angle * Math.PI / 180) * this.throttle / this.mass * time;
        this.speed.y += Math.sin(this.angle * Math.PI / 180) * this.throttle / this.mass * time;

        // Calculate new position
        this.destination.x += Math.round(this.position.x + this.speed.x) * time;
        this.destination.y += Math.round(this.position.y + this.speed.y) * time;
    },

    adjust: function () {
        // Update speed for next turn
        this.speed.x = Math.round(this.speed.x * (1 - this.friction));
        this.speed.y = Math.round(this.speed.y * (1 - this.friction));

        this.angle = Math.round(this.angle);
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

                this.target = !wreck || distanceRDT < distanceRW ?
                    destroyer.position : wreck.position;
                break;
            case 1: // Destroyer
                this.target = this.findClosest(GAME.UnitType.Tanker).position;
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
        var impulseCoeff = 0.5;
        var mcoeff = unit ? (this.mass + unit.mass) / (this.mass * unit.mass) : 1 / this.mass;
        var n = new Vector(
            this.position.x - unit ? unit.position.x : 0,
            this.position.y - unit ? unit.position.y : 0
            );
        var nLength2 = n.length2();
        var dv = new Vector(
            this.speed.x - unit ? unit.speed.x : 0,
            this.speed.y - unit ? unit.speed.y : 0
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

        var diff = (this.position.distance(unit ? unit : new Vector(0, 0)) - this.radius - unit ? unit.radius : GAME.mapRadius) / 2;

        if ((unit && diff <= 0) || (!unit && diff >= 0)) {
            // Unit overlapping. Fix positions.
            // TODO
            printErr('unit overlapping\n');
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
        // Check instant collision
        if (this.position.length() + this.radius >= GAME.mapRadius) {
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

        return new GAME.Collision(t, this);
    },

    getUnitCollision: function (unit) {
        // Check instant collision
        if (this.position.distance(unit.position) <= this.radius + unit.radius) {
            return new GAME.Collision(0, this, unit);
        }

        // Both units are motionless
        if (this.speed.length() + unit.speed.length() == 0) {
            return null; //new GAME.Collision(Infinity, this, unit);
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
            return null; //new GAME.Collision(Infinity, this, unit);
        }

        var b = 2 * (unitPosition.x * unitSpeed.x + unitPosition.y * unitSpeed.y);
        var c = unitPosition.length2() - (this.radius + unit.radius) * (this.radius + unit.radius);
        var delta = b * b - 4 * a * c;

        if (delta <= 0) {
            return null; //new GAME.Collision(Infinity, this, unit);
        }

        var t = (-b - Math.sqrt(delta)) / (2 * a);

        if (t < 0) {
            return null; //new GAME.Collision(Infinity, this, unit);
        }

        return new GAME.Collision(t, this, unit);
    },

    name: function () {
        var name = Object.keys(GAME.UnitType).find(k => GAME.UnitType[k] == this.typeId) + this.playerId;
        return name;
    },

    toString: function () {
        var value = this.name() + ' :' + this.position + ' ' + this.destination + '\n';
        //if (this.collision) {
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
        var reaper = that.units.find(u => u.typeId == GAME.UnitType.Reaper && u.playerId == 0);
        printErr(reaper);

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

            // Find user targets
            var reaper = that.units.find(u => u.playerId == 0 && u.typeId == GAME.UnitType.Reaper);
            var destroyer = that.units.find(u => u.playerId == 0 && u.typeId == GAME.UnitType.Destroyer);

            reaper.findTarget(destroyer);
            destroyer.findTarget();

            // Update collisions
            var collision = that.getNextCollision();
            while (collision.time + time <= 1.0001) {
                that.units.forEach(u => u.move(collision.time));
                time += collision.time;

                that.playCollision(collision);
                collision = that.getNextCollision();
            }

            // No more collision. Move units until the end of the round
            that.units.forEach(u => u.move(1 - time));

            // Log infos
            that.log();

            // print user units accelerations
            print(reaper.target + ' ' + reaper.throttle);
            print(destroyer.target ? destroyer.target + ' ' + destroyer.throttle : 'WAIT');
            print('WAIT'); // Placeholder for the next leagues

            // adjust units for next turn
            that.units.forEach(u => u.adjust());

            // Increment loop index 
            that.loopIndex++;
        }
    };

    that.getNextCollision = function () {
        var result = new GAME.Collision(1);

        that.units.forEach(unit => {
            var collision = unit.getMapCollision();

            if (collision.time < result.time) {
                result = collision;
            }

            that.units
                .filter(other => other.unitId)
                .forEach(other => {
                    var collision = unit.getUnitCollision(other);

                    if (collision && collision.time < result.time) {
                        result = collision;
                    }
                });
        });

        return result;
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