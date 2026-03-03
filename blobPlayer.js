/*
BlobPlayer.js (Example 5)

BlobPlayer owns all "dynamic" player state:
- position (x,y), radius (r)
- velocity (vx,vy)
- movement tuning (accel, friction, max run)
- jump state (onGround)
- blob rendering animation parameters (noise wobble)

It also implements:
- update() for physics + collision against platforms
- jump() for input
- draw() for the "breathing blob" look

The algorithm is the same as the original blob world example from Week 2: 
- Apply input acceleration
- Apply friction
- Apply gravity
- Compute an AABB (box) around the blob
- Move box in X and resolve collisions
- Move box in Y and resolve collisions
- Write back box center to blob position
*/

class BlobPlayer {
  constructor() {
    // ----- Transform -----
    this.x = 0;
    this.y = 0;
    this.r = 26;

    // ----- Velocity -----
    this.vx = 0;
    this.vy = 0;

    // ----- Movement tuning (matches your original values) -----
    this.accel = 0.55;
    this.maxRun = 4.0;

    // Physics values that are typically overridden per level.
    this.gravity = 0.65;
    this.jumpV = -11.0;

    // State used by jumping + friction choice.
    this.onGround = false;

    // Friction:
    // - in air: almost no friction (keeps momentum)
    // - on ground: more friction (stops more quickly)
    this.frictionAir = 0.995;
    this.frictionGround = 0.88;

    // ----- Blob rendering / animation -----
    this.t = 0;
    this.tSpeed = 0.01;
    this.wobble = 7;
    this.points = 48;
    this.wobbleFreq = 0.9;
  }

  /*
  Apply level settings + spawn the player.
  We reset velocities so each level starts consistently. 
  */
  spawnFromLevel(level) {
    this.gravity = level.gravity;
    this.jumpV = level.jumpV;

    this.x = level.start.x;
    this.y = level.start.y;
    this.r = level.start.r;

    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  /*
  Update movement + resolve collisions against all platforms.

  Input is polled with keyIsDown to get smooth movement (held keys).
  This keeps the behavior aligned with your original blob example. 
  */
  update(platforms) {
    // 1) Horizontal input (A/D or arrows)
    let move = 0;
    if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) move -= 1;
    if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) move += 1;

    // 2) Apply horizontal acceleration based on input
    this.vx += this.accel * move;

    // 3) Apply friction (ground vs air)
    this.vx *= this.onGround ? this.frictionGround : this.frictionAir;

    // 4) Clamp max run speed
    this.vx = constrain(this.vx, -this.maxRun, this.maxRun);

    // 5) Apply gravity every frame
    this.vy += this.gravity;

    // 6) Build an AABB around the blob (center/radius -> box)
    let box = {
      x: this.x - this.r,
      y: this.y - this.r,
      w: this.r * 2,
      h: this.r * 2,
    };

    // 7) Move in X and resolve collisions
    box.x += this.vx;

    for (const s of platforms) {
      if (overlapAABB(box, s)) {
        // If moving right, snap to the left side of the platform.
        if (this.vx > 0) box.x = s.x - box.w;
        // If moving left, snap to the right side of the platform.
        else if (this.vx < 0) box.x = s.x + s.w;

        // Cancel horizontal velocity after collision.
        this.vx = 0;
      }
    }

    // 8) Move in Y and resolve collisions
    box.y += this.vy;

    // Reset and recompute onGround each frame during Y resolution.
    this.onGround = false;

    for (const s of platforms) {
      if (overlapAABB(box, s)) {
        if (this.vy > 0) {
          // Falling: snap to platform top
          box.y = s.y - box.h;
          this.vy = 0;
          this.onGround = true;
        } else if (this.vy < 0) {
          // Rising: snap to platform bottom (head bump)
          box.y = s.y + s.h;
          this.vy = 0;
        }
      }
    }

    // 9) Write back blob center from box position
    this.x = box.x + box.w / 2;
    this.y = box.y + box.h / 2;

    // 10) Keep player within horizontal canvas bounds.  Vertical movement is
    // entirely in world space; we don't clamp y here (the camera handles
    // what is visible).
    this.x = constrain(this.x, this.r, width - this.r);

    // 11) Advance blob animation time
    this.t += this.tSpeed;
  }

  //Jump: only possible when on ground.
  jump() {
    if (!this.onGround) return;
    this.vy = this.jumpV;
    this.onGround = false;
  }

  /*
  Draw the blob with a wobbly outline:
  - we sample a noise value around the circle
  - perturb the radius slightly per vertex
  - this creates an organic “breathing” look

  This is the same technique as the original drawBlob() function. 
  */
  draw(colourHex) {
    fill(color(colourHex));
    beginShape();

    for (let i = 0; i < this.points; i++) {
      const a = (i / this.points) * TAU;

      // Noise input: circle coordinates + time.
      const n = noise(
        cos(a) * this.wobbleFreq + 100,
        sin(a) * this.wobbleFreq + 100,
        this.t,
      );

      // Map noise to a small radius offset.
      const rr = this.r + map(n, 0, 1, -this.wobble, this.wobble);

      // Place the vertex around the center.
      vertex(this.x + cos(a) * rr, this.y + sin(a) * rr);
    }

    endShape(CLOSE);
  }
}

/*
Collision function: AABB overlap test.
- a is the moving player "box"
- b is a platform rectangle

We accept b as either:
- a Platform instance (with x,y,w,h)
- or a plain object with x,y,w,h
This keeps it flexible. 
*/
function overlapAABB(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
