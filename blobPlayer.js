/*
BlobPlayer.js

BlobPlayer owns all "dynamic" player state.

Sprite states:
  cursor_normal.png  -> standing still or moving on ground
  cursor_fall.png    -> falling (vy > 0 and not on ground)
  cursor_jumpl.png   -> jumping leftward
  cursor_jumpr.png   -> jumping rightward
*/

class BlobPlayer {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.r = 26;

    this.vx = 0;
    this.vy = 0;

    this.accel = 0.8;
    this.maxRun = 7.0;

    this.gravity = 0.45;
    this.jumpV = -14.0;

    this.onGround = false;

    this.frictionAir = 0.995;
    this.frictionGround = 0.88;

    // Per-platform friction override (set during collision each frame)
    this.platformFriction = null;

    // "normal" | "fall" | "jumpl" | "jumpr"
    this.spriteState = "normal";

    // Blob fallback animation
    this.t = 0;
    this.tSpeed = 0.01;
    this.wobble = 7;
    this.points = 48;
    this.wobbleFreq = 0.9;
  }

  spawnFromLevel(level) {
    this.gravity = level.gravity;
    this.jumpV = level.jumpV;

    this.x = level.start.x;
    this.y = level.start.y;
    this.r = level.start.r;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.spriteState = "normal";
    this.platformFriction = null;
  }

  update(platforms) {
    let move = 0;
    if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) move -= 1;
    if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) move += 1;

    this.vx += this.accel * move;

    let groundFric =
      this.platformFriction !== null
        ? this.platformFriction
        : this.frictionGround;

    this.vx *= this.onGround ? groundFric : this.frictionAir;
    this.vx = constrain(this.vx, -this.maxRun, this.maxRun);

    this.vy += this.gravity;

    let box = {
      x: this.x - this.r,
      y: this.y - this.r,
      w: this.r * 2,
      h: this.r * 2,
    };

    // Move X
    box.x += this.vx;
    for (const s of platforms) {
      if (s.removed) continue;
      if (overlapAABB(box, s)) {
        if (this.vx > 0) box.x = s.x - box.w;
        else if (this.vx < 0) box.x = s.x + s.w;
        this.vx = 0;
      }
    }

    // Move Y
    box.y += this.vy;
    this.onGround = false;
    this.platformFriction = null;

    for (const s of platforms) {
      if (s.removed) continue;
      if (overlapAABB(box, s)) {
        if (this.vy > 0) {
          box.y = s.y - box.h;
          this.vy = 0;
          this.onGround = true;

          if (s.mechanic === "slippery") {
            this.platformFriction = 0.99;
          } else if (s.mechanic === "slow") {
            this.platformFriction = 0.78;
            this.vx *= 0.9;
          } else {
            this.platformFriction = null;
          }

          if (s.mechanic === "falling" && !s.falling) {
            s.startFall();
          }
        } else if (this.vy < 0) {
          box.y = s.y + s.h;
          this.vy = 0;
        }
      }
    }

    this.x = box.x + box.w / 2;
    this.y = box.y + box.h / 2;
    this.x = constrain(this.x, this.r, width - this.r);

    this.t += this.tSpeed;
    this._updateSpriteState();
  }

  _updateSpriteState() {
    if (!this.onGround && this.vy > 0) {
      this.spriteState = "fall";
    } else if (!this.onGround && this.vy < 0) {
      this.spriteState = this.vx <= 0 ? "jumpl" : "jumpr";
    } else {
      this.spriteState = "normal";
    }
  }

  jump() {
    if (!this.onGround) return;
    this.vy = this.jumpV;
    this.onGround = false;
    this.spriteState = this.vx < 0 ? "jumpl" : "jumpr";
  }

  // sprites: { normal, fall, jumpl, jumpr } — p5 image objects (may be null)
  draw(colourHex, sprites) {
    let img = null;
    if (sprites) {
      if (this.spriteState === "fall") img = sprites.fall;
      else if (this.spriteState === "jumpl") img = sprites.jumpl;
      else if (this.spriteState === "jumpr") img = sprites.jumpr;
      else img = sprites.normal;
    }

    const size = this.r * 2.5;

    if (img) {
      imageMode(CENTER);
      noTint();
      image(img, this.x, this.y, size, size);
      imageMode(CORNER);
    } else {
      // Fallback: original blob wobble
      fill(color(colourHex));
      noStroke();
      beginShape();
      for (let i = 0; i < this.points; i++) {
        const a = (i / this.points) * TAU;
        const n = noise(
          cos(a) * this.wobbleFreq + 100,
          sin(a) * this.wobbleFreq + 100,
          this.t,
        );
        const rr = this.r + map(n, 0, 1, -this.wobble, this.wobble);
        vertex(this.x + cos(a) * rr, this.y + sin(a) * rr);
      }
      endShape(CLOSE);
    }
  }
}

function overlapAABB(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
