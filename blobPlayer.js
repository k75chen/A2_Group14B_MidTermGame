/*
BlobPlayer.js
Handles player physics, collision, and cursor sprite rendering.
Sprite states: normal, fall, jumpl, jumpr
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

  update(platforms, dt = 1) {
    // Apply moving platform carry FIRST — before any physics
    // so the player's starting position this frame already accounts for where the platform went
    if (this.onGround) {
      for (const s of platforms) {
        if (s.removed || !s.moveRange) continue;
        // Check if player was standing on this platform last frame
        let feet = {
          x: this.x - this.r,
          y: this.y - this.r,
          w: this.r * 2,
          h: this.r * 2,
        };
        let onTop =
          this.x > s.x &&
          this.x < s.x + s.w &&
          Math.abs(this.y + this.r - s.y) < 6;
        if (onTop) {
          this.x += s._lastDx;
          break;
        }
      }
    }

    // Horizontal input
    let move = 0;
    if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) move -= 1;
    if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) move += 1;

    this.vx += this.accel * move * dt;

    let groundFric =
      this.platformFriction !== null
        ? this.platformFriction
        : this.frictionGround;

    this.vx *= Math.pow(this.onGround ? groundFric : this.frictionAir, dt);
    this.vx = constrain(this.vx, -this.maxRun, this.maxRun);

    this.vy += this.gravity * dt;

    let box = {
      x: this.x - this.r,
      y: this.y - this.r,
      w: this.r * 2,
      h: this.r * 2,
    };

    // Move X
    box.x += this.vx * dt;
    for (const s of platforms) {
      if (s.removed) continue;
      if (overlapAABB(box, s)) {
        if (this.vx > 0) box.x = s.x - box.w;
        else if (this.vx < 0) box.x = s.x + s.w;
        this.vx = 0;
      }
    }

    // Move Y
    box.y += this.vy * dt;
    this.onGround = false;
    this.platformFriction = null;
    let groundPlatform = null; // track which platform player is standing on

    for (const s of platforms) {
      if (s.removed) continue;
      if (overlapAABB(box, s)) {
        if (this.vy > 0) {
          box.y = s.y - box.h;
          this.vy = 0;
          this.onGround = true;
          groundPlatform = s;

          if (s.mechanic === "slippery") this.platformFriction = 0.99;
          else if (s.mechanic === "slow") {
            this.platformFriction = 0.78;
            this.vx *= 0.9;
          } else this.platformFriction = null;

          if (s.mechanic === "falling" && !s.falling) s.startFall();
        } else if (this.vy < 0) {
          box.y = s.y + s.h;
          this.vy = 0;
        }
      }
    }

    this.x = box.x + box.w / 2;
    this.y = box.y + box.h / 2;
    this.x = constrain(this.x, this.r, width - this.r);

    this._updateSpriteState();
  }

  _updateSpriteState() {
    if (!this.onGround && this.vy > 0) this.spriteState = "fall";
    else if (!this.onGround && this.vy < 0)
      this.spriteState = this.vx <= 0 ? "jumpl" : "jumpr";
    else this.spriteState = "normal";
  }

  jump() {
    if (!this.onGround) return;
    this.vy = this.jumpV;
    this.onGround = false;
    this.spriteState = this.vx < 0 ? "jumpl" : "jumpr";
  }

  // sprites: { normal, fall, jumpl, jumpr } — p5 image objects (may be null)
  // Falls back to a simple circle so the player is always visible
  draw(colourHex, sprites, spriteScale = 1) {
    let img = null;
    if (sprites) {
      if (this.spriteState === "fall") img = sprites.fall;
      else if (this.spriteState === "jumpl") img = sprites.jumpl;
      else if (this.spriteState === "jumpr") img = sprites.jumpr;
      else img = sprites.normal;
    }

    const size = this.r * 2.5 * spriteScale;

    if (img) {
      imageMode(CENTER);
      noTint();
      image(img, this.x, this.y + this.r - size / 2 + this.r * 0.5, size, size);
      imageMode(CORNER);
    } else {
      // Fallback: plain circle so player is always visible if sprites fail
      noStroke();
      fill(color(colourHex));
      circle(this.x, this.y, this.r * 2);
    }
  }
}

function overlapAABB(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
