/*
Copyright (c) 2025 [بازی سوزاندن حشرات]. All rights reserved.
This extension and all associated code, assets, and resources are the exclusive property of the copyright holder.
Without express written permission from the copyright holder, no individual or organization may:
1. Copy, distribute, or reproduce this extension in whole or in part.
2. Use this extension or any of its code for personal, commercial, or educational projects.
3. Modify, adapt, translate, or create derivative works based on this extension.
This extension is provided solely for personal use within the Chrome browser. Any unauthorized use, redistribution, or modification will be considered a violation of copyright law and may result in legal action.
For licensing inquiries or to obtain permission for use, contact:
Omidw20ipx@gmail.com
https://t.me/Anony_muos
*/

class SpatialGrid {
    constructor(width, height, cellSize = 250) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = Array(this.cols * this.rows).fill(null).map(() => []);
    }
    getCellIndex(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        return row * this.cols + col;
    }
    insert(beetle) {
        const idx = this.getCellIndex(beetle.x, beetle.y);
        if (idx >= 0 && idx < this.grid.length) {
            this.grid[idx].push(beetle);
        }
    }
    getNearby(x, y, range = 100) {
        const centerCell = this.getCellIndex(x, y);
        const nearby = [];
        const cellRange = Math.ceil(range / this.cellSize);
        const centerRow = Math.floor(centerCell / this.cols);
        const centerCol = centerCell % this.cols;
        for (let r = centerRow - cellRange; r <= centerRow + cellRange; r++) {
            for (let c = centerCol - cellRange; c <= centerCol + cellRange; c++) {
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
                    const idx = r * this.cols + c;
                    nearby.push(...this.grid[idx]);
                }
            }
        }
        return nearby;
    }
    clear() {
        this.grid.forEach(cell => cell.length = 0);
    }
}
function killAndScore(beetle) {
    if (typeof window.increaseScore === 'function') {
        window.increaseScore(beetle.points);
    }
}
function findBeetleUnderMagnifier() {
    const mx = lastX;
    const my = lastY;
    let closest = null;
    let closestDist = Infinity;
    const nearby = spatialGrid.getNearby(mx, my, 80);
    for (const beetle of nearby) {
        if (!beetle.alive) continue;
        const dist = Math.hypot(beetle.x - mx, beetle.y - my);
        if (dist < 40 && dist < closestDist) {
            closestDist = dist;
            closest = beetle;
        }
    }
    return closest;
}
const gameContainer = document.getElementById('game');
const magnifier = document.getElementById('magnifier');
const light = document.getElementById('light');
const tearHole = document.getElementById('tear-hole');
let isBurning = false;
let smokeInterval = null;
let lastX = 0, lastY = 0;
let lastMoveTime = 0;
let lastMoveX = 0;
let lastMoveY = 0;
const MAX_ALLOWED_MOUSE_SPEED = 2.0;
let isMouseInside = false;
let isMouseMovingTooFast = false;
let spatialGrid = null;
let gameCanStart = false;
const beetles = [];
const COUNT = 80;
let nextSpawnTime = performance.now() + 3000;
let lastEmptySpotsCache = [];
let lastEmptySpotsTime = 0;
const EMPTY_SPOTS_CACHE_DURATION = 2000;
function findEmptiestSpots() {
    const now = performance.now();
    if (now - lastEmptySpotsTime < EMPTY_SPOTS_CACHE_DURATION) {
        return lastEmptySpotsCache;
    }
    const spots = [];
    const samples = 8;
    const w = gameContainer.clientWidth;
    const h = gameContainer.clientHeight;
    const centerX = w / 2;
    const centerY = h / 2;
    for (let i = 0; i < samples; i++) {
        let x, y;
        if (Math.random() < 0.7) {
            const side = Math.floor(Math.random() * 4);
            if (side === 0) { x = Math.random() * 80; y = Math.random() * h; }
            else if (side === 1) { x = w - Math.random() * 80; y = Math.random() * h; }
            else if (side === 2) { x = Math.random() * w; y = Math.random() * 80; }
            else { x = Math.random() * w; y = h - Math.random() * 80; }
        } else {
            x = Math.random() * w;
            y = Math.random() * h;
        }
        x = Math.max(20, Math.min(w - 20, x));
        y = Math.max(20, Math.min(h - 20, y));
        const nearby = spatialGrid.getNearby(x, y, 120);
        let minDist = Infinity;
        for (const b of nearby) {
            if (!b.alive) continue;
            minDist = Math.min(minDist, Math.hypot(x - b.x, y - b.y));
        }
        const distFromCenter = Math.hypot(x - centerX, y - centerY);
        const score = minDist + distFromCenter * 0.3;
        spots.push({ x, y, score });
    }
    spots.sort((a, b) => b.score - a.score);
    lastEmptySpotsCache = spots.slice(0, 3);
    lastEmptySpotsTime = now;
    return lastEmptySpotsCache;
}
function clampToGameArea(b) {
    const w = gameContainer.clientWidth;
    const h = gameContainer.clientHeight;
    const minMargin = 18;
    let hitWall = false;
    if (b.x <= minMargin) { b.x = minMargin; b.angle = Math.abs(b.angle) > Math.PI / 2 ? -b.angle : b.angle; hitWall = true; }
    if (b.x >= w - minMargin) { b.x = w - minMargin; b.angle = Math.abs(b.angle) > Math.PI / 2 ? -b.angle : b.angle; hitWall = true; }
    if (b.y <= minMargin) { b.y = minMargin; b.angle = b.angle > 0 ? -b.angle : b.angle; hitWall = true; }
    if (b.y >= h - minMargin) { b.y = h - minMargin; b.angle = b.angle > 0 ? -b.angle : b.angle; hitWall = true; }
    if (hitWall) { b.wallBounceTimer = 120; b.justBounced = true; b.angle += (Math.random() - 0.5) * 0.5; }
}
const updatePosition = (x, y) => {
    lastX = x; lastY = y;
    magnifier.style.left = x + 'px';
    magnifier.style.top = y + 'px';
    light.style.left = x + 'px';
    light.style.top = y + 'px';
};
const showMagnifier = () => {
    if (!isMouseInside) {
        isMouseInside = true;
        magnifier.classList.remove('hidden');
    }
};
const hideMagnifier = () => {
    if (isMouseInside) {
        isMouseInside = false;
        isMouseMovingTooFast = false;
        stopBurning();
        magnifier.classList.add('hidden');
    }
};
const startBurningEffect = () => {
    if (isBurning || !isMouseInside) return;
    isBurning = true;
    magnifier.classList.add('active');
    light.classList.add('visible');
    smokeInterval = setInterval(() => createSmoke(lastX, lastY), 70);
};
const stopBurning = () => {
    if (!isBurning) return;
    isBurning = false;
    isMouseMovingTooFast = false;
    magnifier.classList.remove('active');
    light.classList.remove('visible');
    clearInterval(smokeInterval);
};
const createSmoke = (x, y) => {
    if (isMouseMovingTooFast) return;
    const s = document.createElement('div');
    s.className = 'smoke';
    const offsetX = (Math.random() - 0.5) * 10;
    const offsetY = (Math.random() - 0.5) * 10;
    s.style.left = (x - 0 + offsetX) + 'px';
    s.style.top = (y - 7 + offsetY) + 'px';
    const drift = (Math.random() - 0.5) * 40;
    s.style.setProperty('--drift', drift);
    gameContainer.appendChild(s);
    setTimeout(() => s.remove(), 2000);
};
const IMMUNITY_TIME = 2000;
const FRAME_TIME = 1000 / 60;
const BURN_PROGRESS_INCREMENT_PER_FRAME = FRAME_TIME;
const MAX_SPEED_ACCELERATION_FACTOR = 6;
class Insect {
    static idCounter = 0;
    constructor() {
        this.id = ++Insect.idCounter;
        const hole = getHolePosition();
        this.x = hole.x;
        this.y = hole.y;
        this.el = document.createElement('div');
        this.el.className = 'beetle appearing';
        this.el.style.zIndex = '25';
        gameContainer.appendChild(this.el);
        const rand = Math.random();
        if (rand < 0.1666) this.type = 'ant';
        else if (rand < 0.3333) this.type = 'fly';
        else if (rand < 0.5) this.type = 'spider';
        else if (rand < 0.6666) this.type = 'ladybug';
        else if (rand < 0.8333) this.type = 'hornetinvasion';
        else this.type = 'palomenaprasina';
        this.legFrame = 0;
        this.wingTimer = 0;
        this.el.style.backgroundImage = `url('insects/${this.type}/1.webp')`;
        this.finalScale = this.type === 'fly' ? 1.1 : this.type === 'ladybug' ? 1.0 : this.type === 'spider' ? 1.25 : this.type === 'hornetinvasion' ? 1.3 : this.type === 'palomenaprasina' ? 1.15 : 0.9;
        this.el.style.transform = `scale(0.3)`;
        this.el.style.transformOrigin = 'center';
        this.baseSpeed = this.type === 'fly' ? 0.18 + Math.random() * 0.09 :
                         this.type === 'hornetinvasion' ? 0.22 + Math.random() * 0.11 :
                         this.type === 'ladybug' ? 0.14 + Math.random() * 0.07 :
                         this.type === 'spider' ? 0.26 + Math.random() * 0.10 :
                         this.type === 'palomenaprasina' ? 0.20 + Math.random() * 0.08 : 0.22 + Math.random() * 0.10;
        this.speed = this.baseSpeed;
        this.angle = Math.random() * Math.PI * 2;
        this.wanderBias = this.type === 'fly' ? (Math.random() - 0.5) * 0.012 :
                          this.type === 'ladybug' ? (Math.random() - 0.5) * 0.006 :
                          this.type === 'spider' ? (Math.random() - 0.5) * 0.010 :
                          this.type === 'hornetinvasion' ? (Math.random() - 0.5) * 0.018 :
                          this.type === 'palomenaprasina' ? (Math.random() - 0.5) * 0.014 : (Math.random() - 0.5) * 0.008;
        this.wanderTimer = 600 + Math.random() * 1000;
        this.nervousness = 0.7 + Math.random() * 0.5;
        this.visionRange = 60 + Math.random() * 40;
        this.burnRequiredTime = this.type === 'ladybug' ? 8000 :
                                this.type === 'spider' ? 7000 :
                                this.type === 'hornetinvasion' ? 9000 :
                                this.type === 'palomenaprasina' ? 10000 :
                                this.type === 'fly' ? 5000 : 2000;
        this.points = this.type === 'ladybug' ? 8 :
                      this.type === 'spider' ? 5 :
                      this.type === 'hornetinvasion' ? 9 :
                      this.type === 'palomenaprasina' ? 10 :
                      this.type === 'fly' ? 5 : 2;
        this.burnProgress = 0;
        this.currentAcceleration = 0;
        this.accelerationRate = this.baseSpeed * 6 / 1000;
        this.isEmerging = true;
        this.emergeStartTime = performance.now();
        this.emergeDuration = 200 + Math.random() * 200;
        this.emergeEndTime = this.emergeStartTime + this.emergeDuration;
        this.alive = true;
        this.wallBounceTimer = 0;
        this.justBounced = false;
        this.crowdCheckTimer = 100 + Math.random() * 100;
        this.hasEscapeGoal = false;
        this.escapeGoalTimer = 0;
        this.resting = false;
        this.restTime = 0;
        this.movingSince = performance.now();
        this.nextRestCheck = 30000 + Math.random() * 30000;
        this.legDist = 0;
        this.isUnderMagnifier = false;
        this.escapeSpeedTimeout = null;
        this.isHornet = this.type === 'hornetinvasion';
        this.hornetMoveTime = this.isHornet ? (5000 + Math.random() * 15000) : 0;
        this.hornetRestTime = this.isHornet ? (2000 + Math.random() * 2000) : 0;
        this.hornetState = this.isHornet ? 'moving' : null;
        this.hornetTimer = this.isHornet ? performance.now() + this.hornetMoveTime : 0;
        this.isCricket = this.type === 'palomenaprasina';
        this.cricketState = this.isCricket ? 'walking' : null;
        this.cricketWalkTime = this.isCricket ? (1500 + Math.random() * 2000) : 0;
        this.cricketRestTime = this.isCricket ? (2000 + Math.random() * 2000) : 0;
        this.cricketJumpTime = this.isCricket ? (100 + Math.random() * 140) : 0;
        this.cricketTimer = this.isCricket ? performance.now() + this.cricketWalkTime : 0;
        this.cricketJumpVelocity = 0;
        this.cricketJumpAngle = 0;
        this.update();
    }
    updateEmergingAnimation() {
        if (!this.isEmerging) return;
        const now = performance.now();
        const progress = Math.min(1, (now - this.emergeStartTime) / this.emergeDuration);
        const emergeScale = 0.3 + (this.finalScale - 0.3) * progress;
        const grayscale = (1 - progress) * 100;
        let deg = this.angle * 180 / Math.PI;
        const flip = deg > 90 || deg < -90;
        if (flip) deg = (deg + 180) % 360;
        this.el.style.transform = `rotate(${deg}deg)${flip ? ' scaleX(-1)' : ''} scale(${emergeScale})`;
        this.el.style.filter = `grayscale(${grayscale}%)`;
        if (progress >= 1) {
            this.isEmerging = false;
            this.el.classList.remove('appearing');
            this.el.style.filter = '';
            this.movingSince = now;
        }
    }
    startResting() {
        if (this.resting || this.isEmerging || this.isHornet || this.isCricket) return;
        this.resting = true;
        this.speed = 0;
        this.restTime = 3000 + Math.random() * 6000;
        this.el.style.backgroundImage = `url('insects/${this.type}/1.webp')`;
    }
    applySeparationForce() {
        let fx = 0, fy = 0;
        let closestDist = Infinity;
        const separationRadius = 65;
        const nearby = spatialGrid.getNearby(this.x, this.y, separationRadius);
        const maxNearby = 6;
        let checked = 0;
        for (const other of nearby) {
            if (other === this || !other.alive) continue;
            if (checked >= maxNearby) break;
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const d = Math.hypot(dx, dy);
            if (d < separationRadius && d > 0.1) {
                const strength = 1 - (d / separationRadius);
                const force = strength * strength * strength * 0.12;
                fx += (dx / d) * force;
                fy += (dy / d) * force;
                if (d < closestDist) closestDist = d;
            }
            checked++;
        }
        if (closestDist < 40 && closestDist > 0) {
            const emergencyStrength = (40 - closestDist) / 40;
            fx *= (1 + emergencyStrength * 0.8);
            fy *= (1 + emergencyStrength * 0.8);
        }
        return { fx, fy, closestDist };
    }
    applySlidingMechanism(repulsion) {
        const totalForce = Math.hypot(repulsion.fx, repulsion.fy);
        if (totalForce > 0.05 && repulsion.closestDist < 45) {
            const movementAngle = this.angle;
            const separationAngle = Math.atan2(repulsion.fy, repulsion.fx);
            const angleDiff = Math.abs(separationAngle - movementAngle);
            if (angleDiff < Math.PI / 3 || angleDiff > (2 * Math.PI / 3)) {
                const rotationAmount = Math.sign(separationAngle - this.angle) * 0.08;
                this.angle += rotationAmount;
                this.speed = Math.min(this.speed * 1.15, this.baseSpeed * 2.0);
                return true;
            }
        }
        return false;
    }
    checkCrowdingAndDisperse() {
        this.crowdCheckTimer--;
        if (this.crowdCheckTimer > 0 || this.resting || this.isEmerging || this.isHornet || this.isCricket) return;
        this.crowdCheckTimer = 300;
        const nearby = spatialGrid.getNearby(this.x, this.y, 85);
        let count = 0;
        for (const other of nearby) {
            if (other !== this && other.alive) count++;
        }
        if (count >= 3 && Math.random() < 0.7) {
            const spots = findEmptiestSpots();
            const spot = spots[Math.floor(Math.random() * spots.length)];
            this.hasEscapeGoal = true;
            this.escapeGoalX = spot.x;
            this.escapeGoalY = spot.y;
            this.escapeGoalTimer = 600 + Math.random() * 500;
        }
    }
    steerToEscapeGoal() {
        if (!this.hasEscapeGoal || this.escapeGoalTimer <= 0) {
            this.hasEscapeGoal = false;
            return;
        }
        this.escapeGoalTimer--;
        const dx = this.escapeGoalX - this.x;
        const dy = this.escapeGoalY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 50) {
            this.hasEscapeGoal = false;
            return;
        }
        const desired = Math.atan2(dy, dx);
        const wiggle = Math.sin(performance.now() * 0.0025) * 0.25;
        const target = desired + wiggle;
        this.angle += (target - this.angle) * 0.015;
    }
    escapeFromMagnifier(mx, my) {
        if (this.resting || this.isEmerging) return;
        const d = Math.hypot(this.x - mx, this.y - my);
        if (d < this.visionRange * this.nervousness) {
            this.angle = Math.atan2(this.y - my, this.x - mx) + (Math.random() - 0.5) * 1.4;
            this.speed = this.baseSpeed * (this.type === 'fly' || this.type === 'spider' || this.type === 'hornetinvasion' || this.type === 'palomenaprasina' ? 4.0 : 3.2);
            this.isUnderMagnifier = true;
            if (this.escapeSpeedTimeout) clearTimeout(this.escapeSpeedTimeout);
            this.escapeSpeedTimeout = setTimeout(() => {
                if (this.alive && !this.resting && this.isUnderMagnifier) {
                    this.speed = this.baseSpeed + this.currentAcceleration;
                    this.isUnderMagnifier = false;
                }
            }, this.type === 'fly' || this.type === 'hornetinvasion' || this.type === 'palomenaprasina' ? 500 : 800);
        }
    }
    checkMagnifierProximity(mx, my) {
        if (this.resting || this.isEmerging) return;
        const d = Math.hypot(this.x - mx, this.y - my);
        const wasUnder = this.isUnderMagnifier;
        this.isUnderMagnifier = d < this.visionRange * this.nervousness;
        if (this.isUnderMagnifier && !wasUnder) {
            this.escapeFromMagnifier(mx, my);
        } else if (!this.isUnderMagnifier && wasUnder && this.escapeSpeedTimeout) {
            clearTimeout(this.escapeSpeedTimeout);
            this.escapeSpeedTimeout = null;
            this.speed = this.baseSpeed + this.currentAcceleration;
        }
    }
    applyNaturalWander() {
        this.wanderTimer--;
        if (this.wanderTimer <= 0) {
            this.wanderBias = this.type === 'fly' ? (Math.random() - 0.5) * 0.015 :
                              this.type === 'ladybug' ? (Math.random() - 0.5) * 0.006 :
                              this.type === 'spider' ? (Math.random() - 0.5) * 0.010 :
                              this.type === 'hornetinvasion' ? (Math.random() - 0.5) * 0.018 :
                              this.type === 'palomenaprasina' ? (Math.random() - 0.5) * 0.016 : (Math.random() - 0.5) * 0.009;
            this.wanderTimer = 600 + Math.random() * 1000;
        }
        const noise = (Math.random() - 0.5) * (this.type === 'fly' || this.type === 'hornetinvasion' || this.type === 'palomenaprasina' ? 0.006 : 0.0035);
        this.angle += this.wanderBias + noise;
    }
    continueWallEscape() {
        if (this.wallBounceTimer > 0) {
            this.wallBounceTimer--;
            const cx = gameContainer.clientWidth / 2;
            const cy = gameContainer.clientHeight / 2;
            const toCenter = Math.atan2(cy - this.y, cx - this.x);
            this.angle += (toCenter - this.angle) * 0.025;
        }
    }
    updateHornetBehavior() {
        if (!this.isHornet) return;
        const now = performance.now();
        if (this.hornetState === 'moving' && now > this.hornetTimer) {
            this.hornetState = 'resting';
            this.speed = 0;
            this.hornetTimer = now + this.hornetRestTime;
            this.el.style.backgroundImage = `url('insects/hornetinvasion/1.webp')`;
        } else if (this.hornetState === 'resting' && now > this.hornetTimer) {
            this.hornetState = 'moving';
            this.speed = this.baseSpeed + this.currentAcceleration;
            this.hornetMoveTime = 5000 + Math.random() * 15000;
            this.hornetTimer = now + this.hornetMoveTime;
        }
    }
    updateCricketBehavior() {
        if (!this.isCricket) return;
        const now = performance.now();
        if (this.cricketState === 'walking' && now > this.cricketTimer) {
            this.cricketState = 'resting';
            this.speed = 0;
            this.cricketTimer = now + this.cricketRestTime;
            this.el.style.backgroundImage = `url('insects/palomenaprasina/1.webp')`;
        } else if (this.cricketState === 'resting' && now > this.cricketTimer) {
            this.cricketState = 'jumping';
            this.cricketJumpAngle = this.angle + (Math.random() - 0.5) * 0.8;
            this.cricketJumpVelocity = 1.6 + Math.random() * 1.4;
            this.speed = this.cricketJumpVelocity;
            this.cricketTimer = now + this.cricketJumpTime;
        } else if (this.cricketState === 'jumping' && now > this.cricketTimer) {
            this.cricketState = 'walking';
            this.speed = this.baseSpeed * 0.6;
            this.cricketWalkTime = 1500 + Math.random() * 2000;
            this.cricketTimer = now + this.cricketWalkTime;
        }
    }
    updateRotation() {
        if (this.isEmerging) return;
        let deg = this.angle * 180 / Math.PI;
        const flip = deg > 90 || deg < -90;
        if (flip) deg = (deg + 180) % 360;
        this.el.style.transform = `rotate(${deg}deg) ${flip ? 'scaleX(-1)' : ''} scale(${this.finalScale})`;
    }
    updateLegs() {
        if (!this.alive || this.isEmerging) return;
        if (this.type === 'fly' || this.type === 'hornetinvasion') {
            if (this.speed > 0.05 && (this.type !== 'hornetinvasion' || this.hornetState === 'moving')) {
                this.wingTimer += FRAME_TIME;
                if (this.wingTimer >= 160) this.wingTimer = 0;
                const frame = this.wingTimer < 55 ? 2 : 1;
                this.el.style.backgroundImage = `url('insects/${this.type}/${frame}.webp')`;
            } else {
                this.el.style.backgroundImage = `url('insects/${this.type}/1.webp')`;
            }
        } else {
            if (this.speed <= 0.05 || this.resting || (this.isCricket && this.cricketState !== 'walking')) return;
            this.legDist += this.speed;
            if (this.legDist > 4.3) {
                this.legDist = 0;
                this.legFrame = 1 - this.legFrame;
                const frame = this.legFrame ? 2 : 1;
                this.el.style.backgroundImage = `url('insects/${this.type}/${frame}.webp')`;
            }
        }
    }
    updatePosition() {
        this.el.style.left = (this.x - 14) + 'px';
        this.el.style.top = (this.y - 14) + 'px';
    }
    update() {
        this.updateEmergingAnimation();
        if (!this.isEmerging) this.updateRotation();
        this.updatePosition();
        this.updateLegs();
    }
    gameLoopLogic() {
        if (!this.alive) return;
        const now = performance.now();
        const underMagnifier = Math.hypot(this.x - lastX, this.y - lastY) < 40;
        const isImmune = (now - this.emergeEndTime) < IMMUNITY_TIME;
        if (isBurning && underMagnifier && !isImmune) {
            this.burnProgress += BURN_PROGRESS_INCREMENT_PER_FRAME;
            this.currentAcceleration = Math.min(this.currentAcceleration + this.accelerationRate * FRAME_TIME, this.baseSpeed * MAX_SPEED_ACCELERATION_FACTOR);
            if (this.burnProgress >= this.burnRequiredTime) {
                burnBeetle(this);
                return;
            }
            const progress = this.burnProgress / this.burnRequiredTime;
            this.el.style.filter = `grayscale(${progress * 100}%) brightness(${1 - (progress * 0.75)}) drop-shadow(0 1px 1.5px rgba(0,0,0,0.573))`;
        } else {
            this.burnProgress = Math.max(0, this.burnProgress - (BURN_PROGRESS_INCREMENT_PER_FRAME * 2));
            this.currentAcceleration = Math.max(0, this.currentAcceleration - this.accelerationRate * FRAME_TIME * 2);
            if (!this.isEmerging) {
                const progress = this.burnProgress / this.burnRequiredTime;
                this.el.style.filter = `grayscale(${progress * 100}%) brightness(${1 - (progress * 0.75)}) drop-shadow(0 1px 1.5px rgba(0,0,0,0.573))`;
            }
        }
        if (this.isHornet) {
            this.updateHornetBehavior();
        } else if (this.isCricket) {
            this.updateCricketBehavior();
        } else {
            this.speed = this.baseSpeed + this.currentAcceleration;
        }
        const escapeSpeedThreshold = this.baseSpeed * (this.type === 'fly' || this.type === 'spider' || this.type === 'hornetinvasion' || this.type === 'palomenaprasina' ? 4.0 : 3.2);
        if (this.speed > escapeSpeedThreshold + 0.01 && this.currentAcceleration > 0.01) {
            this.speed = Math.min(this.speed, escapeSpeedThreshold + 0.01);
        }
        if (this.isEmerging) {
        } else {
            if (!this.isHornet && !this.isCricket) {
                if (!this.resting) {
                    if (now - this.movingSince >= this.nextRestCheck) {
                        this.startResting();
                        this.nextRestCheck = 30000 + Math.random() * 30000;
                        this.movingSince = now;
                    }
                }
                if (this.resting) {
                    this.restTime -= FRAME_TIME;
                    if (this.restTime <= 0) {
                        this.resting = false;
                        this.speed = this.baseSpeed;
                        this.movingSince = now;
                    }
                }
            }
            if (!this.resting && (!this.isHornet || this.hornetState === 'moving') && (!this.isCricket || this.cricketState === 'walking' || this.cricketState === 'jumping')) {
                this.checkCrowdingAndDisperse();
                this.steerToEscapeGoal();
                this.continueWallEscape();
                this.applyNaturalWander();
            }
        }
        if (this.justBounced) this.justBounced = false;
        if (!this.resting && (!this.isHornet || this.hornetState === 'moving') && (!this.isCricket || this.cricketState !== 'resting')) {
            if (this.isCricket && this.cricketState === 'jumping') {
                this.x += Math.cos(this.cricketJumpAngle) * this.speed;
                this.y += Math.sin(this.cricketJumpAngle) * this.speed;
            } else {
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed;
            }
        }
        this.update();
    }
}
function getHolePosition() {
    const rect = tearHole.getBoundingClientRect();
    const gameRect = gameContainer.getBoundingClientRect();
    const x = rect.left - gameRect.left + rect.width / 2;
    const y = rect.top - gameRect.top + rect.height / 2;
    return { x, y };
}
function burnBeetle(beetle) {
    if (!beetle.alive) return;
    beetle.alive = false;
    beetle.currentAcceleration = 0;
    beetle.el.classList.add('burned');
    beetle.el.style.filter = '';
    if (beetle.escapeSpeedTimeout) clearTimeout(beetle.escapeSpeedTimeout);
    setTimeout(() => {
        beetle.el.classList.add('dying');
        setTimeout(() => {
            beetle.el.remove();
            const idx = beetles.indexOf(beetle);
            if (idx > -1) beetles.splice(idx, 1);
        }, 5000);
    }, 400);
    killAndScore(beetle);
}
function spawnNextBeetle() {
    if (beetles.length < COUNT && gameCanStart) {
        const now = performance.now();
        if (now >= nextSpawnTime) {
            beetles.push(new Insect());
            nextSpawnTime = now + 2000 + Math.random() * 5000;
        }
    }
}
function playTearAnimation() {
    const totalDuration = 1000;
    for (let i = 1; i <= 8; i++) {
        const img = new Image();
        img.src = `tear/level1/${i}.webp`;
    }
    let startTime = null;
    const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / totalDuration, 1);
        const frame = Math.min(Math.floor(progress * 8) + 1, 8);
        tearHole.style.backgroundImage = `url('tear/level1/${frame}.webp')`;
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            tearHole.style.backgroundImage = `url('tear/level1/8.webp')`;
            gameCanStart = true;
            requestAnimationFrame(gameLoop);
        }
    };
    tearHole.style.opacity = '1';
    requestAnimationFrame(animate);
}
const gameLoop = () => {
    updateBeetlesLoop();
    requestAnimationFrame(gameLoop);
};
function updateBeetlesLoop() {
    if (!gameCanStart) return;
    spawnNextBeetle();
    spatialGrid.clear();
    for (const beetle of beetles) {
        if (beetle.alive) spatialGrid.insert(beetle);
    }
    for (const beetle of beetles) {
        if (!beetle.alive) continue;
        beetle.gameLoopLogic();
        beetle.checkMagnifierProximity(lastX, lastY);
    }
    for (const beetle of beetles) {
        if (!beetle.alive) continue;
        const nearby = spatialGrid.getNearby(beetle.x, beetle.y, 60);
        for (const other of nearby) {
            if (!other.alive || other.id <= beetle.id) continue;
            const dx = other.x - beetle.x;
            const dy = other.y - beetle.y;
            const d = Math.hypot(dx, dy);
            if (d < 25 && d > 0.5) {
                const overlap = 25 - d;
                const pushDistance = (overlap / 2) + 1.2;
                const angle = Math.atan2(dy, dx);
                beetle.x -= Math.cos(angle) * pushDistance;
                beetle.y -= Math.sin(angle) * pushDistance;
                other.x += Math.cos(angle) * pushDistance;
                other.y += Math.sin(angle) * pushDistance;
                const perpAngle = angle + Math.PI / 2;
                beetle.angle += Math.sin(perpAngle) * 0.25;
                other.angle -= Math.sin(perpAngle) * 0.25;
                beetle.speed = Math.min(beetle.speed * 1.15, beetle.baseSpeed * 2.0);
                other.speed = Math.min(other.speed * 1.15, other.baseSpeed * 2.0);
            }
        }
    }
    for (const beetle of beetles) {
        clampToGameArea(beetle);
    }
}
function initGame() {
    tearHole.style.opacity = '0';
    tearHole.style.backgroundImage = 'none';
    spatialGrid = new SpatialGrid(gameContainer.clientWidth, gameContainer.clientHeight, 250);
    setTimeout(playTearAnimation, 300);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
document.body.dataset.level = "1";
gameContainer.addEventListener('mousemove', e => {
    const rect = gameContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    showMagnifier();
    updatePosition(x, y);
    const now = performance.now();
    const dx = x - lastMoveX;
    const dy = y - lastMoveY;
    const dist = Math.hypot(dx, dy);
    const dt = now - lastMoveTime;
    if (dt > 0) {
        const speed = dist / dt;
        isMouseMovingTooFast = (speed > 0.1);
    }
    lastMoveX = x;
    lastMoveY = y;
    lastMoveTime = now;
});
gameContainer.addEventListener('click', e => {
    const rect = gameContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    updatePosition(x, y);
    if (isBurning) {
        stopBurning();
    } else {
        startBurningEffect();
        const target = findBeetleUnderMagnifier();
        if (target && target.alive && !target.resting && (!target.isHornet || target.hornetState === 'moving') && (!target.isCricket || target.cricketState !== 'resting')) {
            target.escapeFromMagnifier(x, y);
        }
    }
});
gameContainer.addEventListener('touchstart', e => {
    e.preventDefault();
    const rect = gameContainer.getBoundingClientRect();
    const t = e.touches[0];
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    updatePosition(x, y);
    if (isBurning) {
        stopBurning();
    } else {
        startBurningEffect();
        const target = findBeetleUnderMagnifier();
        if (target && target.alive && !target.resting && (!target.isHornet || target.hornetState === 'moving') && (!target.isCricket || target.cricketState !== 'resting')) {
            target.escapeFromMagnifier(x, y);
        }
    }
}, { passive: false });
gameContainer.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = gameContainer.getBoundingClientRect();
    const t = e.touches[0];
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    const now = performance.now();
    const dx = x - lastMoveX;
    const dy = y - lastMoveY;
    const dist = Math.hypot(dx, dy);
    const dt = now - lastMoveTime;
    updatePosition(x, y);
    if (dt > 0) {
        const speed = dist / dt;
        if (isBurning && speed > MAX_ALLOWED_MOUSE_SPEED) stopBurning();
    }
    lastMoveX = x;
    lastMoveY = y;
    lastMoveTime = now;
}, { passive: false });
gameContainer.addEventListener('mouseenter', showMagnifier);
gameContainer.addEventListener('mouseleave', hideMagnifier);