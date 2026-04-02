/*
Platform.js
 
A Platform is a single axis-aligned rectangle in the world.
 
mechanic field (derived from type in constructor):
  "normal"    – Standard forum post. No special effect.
  "slippery"  – Glossy input field. Low friction, player slides.
  "slow"      – Loading/buffer bar. Heavy drag, player moves slowly.
  "falling"   – Deleted post / error. Shakes for ~60 frames then disappears.
 
Visual themes (forum UI aesthetic):
  normal     → white/grey forum message box
  slippery   → glossy XP-blue text input field
  slow       → green progress bar with animated stripes
  falling    → red "error / post removed" box that cracks and flickers
 
All platform types still support the original named types (bed, table, etc.)
for backwards compatibility with levels 1 & 2.
 
Falling platform lifecycle:
  falling = false  → normal
  falling = true   → shaking for SHAKE_FRAMES frames
  removed = true   → no longer drawn or collided with
 
Moving platform:
  Set moveRange and moveSpeed in JSON to make a platform slide horizontally.
  moveRange = how many pixels it travels left and right from its start x.
  moveSpeed = pixels per frame (1.5 is a comfortable speed to jump onto).
*/

// Map from JSON type strings to gameplay mechanic
const MECHANIC_MAP = {
  // Level 1 furniture → normal
  bed: "normal",
  table: "normal",
  piano: "normal",
  couch: "normal",
  chair: "normal",
  bathtub: "normal",
  beanbag: "normal",
  tv: "normal",

  // Level 2 train furniture → normal (override individual ones as desired)
  bench: "normal",
  seat: "normal",
  luggage_rack: "normal",
  dining_table: "normal",
  conductor_stand: "normal",

  // Explicit mechanic types
  normal: "normal",
  slippery: "slippery",
  slow: "slow",
  falling: "falling",
  moving: "moving",
  invisible: "invisible",

  // Special
  default: "normal",
  finish: "finish",
  checkpoint: "checkpoint",
};

const SHAKE_FRAMES = 60; // 1 second shake before falling
const RESPAWN_FRAMES = 180; // 3 seconds before platform comes back

class Platform {
  constructor({ x, y, w, h, type, moveRange, moveSpeed, detectRadius }) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type || "default";

    // Derive mechanic
    this.mechanic = MECHANIC_MAP[this.type] || "normal";

    // Falling platform state
    this.falling = false;
    this.fallTimer = 0;
    this.removed = false;

    // Slow platform stripe animation offset
    this.stripeOffset = 0;

    // Moving platform
    this.moveRange = moveRange || 0;
    this.moveSpeed = moveSpeed || 0;
    this._originX = x;
    this._moveDir = 1;

    // Invisible platform
    this.detectRadius = detectRadius || 150;
    this.visAlpha = 0;       // 0 = fully invisible, 255 = fully visible
    this._hintParticles = []; // subtle sparkles shown when player is nearby
  }

  // Called each frame from worldLevel with the player's position
  updateVisibility(playerX, playerY) {
    let cx = this.x + this.w / 2;
    let cy = this.y + this.h / 2;
    let d = dist(playerX, playerY, cx, cy);

    // Fade in when inside detectRadius, fade out when outside
    let targetAlpha = d < this.detectRadius ? 255 : 0;
    this.visAlpha = lerp(this.visAlpha, targetAlpha, 0.14);

    // Spawn hint sparkles when player is close but platform is still hidden
    let hintZone = this.detectRadius * 2.5;
    if (d < hintZone && d > this.detectRadius) {
      // More particles, spawning faster, the closer the player gets
      let spawnRate = floor(map(d, hintZone, this.detectRadius, 12, 3));
      if (frameCount % spawnRate === 0) {
        for (let i = 0; i < 2; i++) {
          this._hintParticles.push({
            x: this.x + random(this.w),
            y: this.y + random(-6, this.h + 6),
            life: 1.0,
            size: random(6, 14),
            vx: random(-0.5, 0.5),
            vy: random(-1.2, -0.4),
          });
        }
      }
    }

    // Tick down hint particles
    for (let i = this._hintParticles.length - 1; i >= 0; i--) {
      let p = this._hintParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      if (p.life <= 0) this._hintParticles.splice(i, 1);
    }
  }

  // Called when a player lands on a falling platform
  startFall() {
    if (this.mechanic !== "falling") return;
    this.falling = true;
    this.fallTimer = 0;
  }

  update() {
    // Horizontal movement
    if (this.moveRange > 0) {
      this.x += this.moveSpeed * this._moveDir;
      if (this.x >= this._originX + this.moveRange) {
        this.x = this._originX + this.moveRange;
        this._moveDir = -1;
      } else if (this.x <= this._originX) {
        this.x = this._originX;
        this._moveDir = 1;
      }
    }

    if (this.mechanic === "slow") {
      this.stripeOffset = (this.stripeOffset + 0.4) % 20;
    }

    if (this.falling) {
      this.fallTimer++;
      if (this.fallTimer >= SHAKE_FRAMES) {
        this.removed = true;
      }
    }

    // Respawn: count up while removed, reset after 3 seconds
    if (this.removed) {
      this.fallTimer++;
      if (this.fallTimer >= SHAKE_FRAMES + RESPAWN_FRAMES) {
        this.falling = false;
        this.fallTimer = 0;
        this.removed = false;
      }
    }
  }

  draw(fillColor) {
    if (this.type === "checkpoint") return;
    if (this.removed) return;
    if (this.w >= 4000) return; // spawn floor is invisible

    noStroke();

    // Apply shake offset for falling platforms in shake phase
    let shakeX = 0;
    if (this.falling && this.fallTimer < SHAKE_FRAMES) {
      let intensity = map(this.fallTimer, 0, SHAKE_FRAMES, 1, 5);
      shakeX = random(-intensity, intensity);
    }

    push();
    translate(shakeX, 0);

    switch (this.mechanic) {
      // ── Slippery – glossy XP-blue input field ──────────────────────────────
      case "slippery":
        this._drawSlippery();
        break;

      // ── Slow – green progress bar with animated stripes ────────────────────
      case "slow":
        this._drawSlow();
        break;

      // ── Falling – red "error post" with flicker + cracks ──────────────────
      case "falling":
        this._drawFalling();
        break;

      // ── Finish – gold pulsing platform ────────────────────────────────────
      case "finish":
        let pulse = sin(frameCount * 0.05) * 4;
        fill("#FFD700");
        rect(
          this.x - pulse / 2,
          this.y - pulse / 2,
          this.w + pulse,
          this.h + pulse,
        );
        break;

      // ── Moving – scrolling marquee banner ─────────────────────────────────
      case "moving":
        this._drawMoving();
        break;

      // ── Invisible – hidden until player is nearby ──────────────────────────
      case "invisible":
        this._drawInvisible();
        break;

      // ── Normal / all legacy furniture types ────────────────────────────────
      default:
        this._drawNormal(fillColor);
        break;
    }

    pop();
  }

  // ── NORMAL – white forum post box ──────────────────────────────────────────
  _drawNormal(fillColor) {
    // Panel shadow
    fill(0, 0, 0, 25);
    rect(this.x + 2, this.y + 3, this.w, this.h, 3);

    // Main panel body
    fill("#FFFFFF");
    stroke("#C8C4BE");
    strokeWeight(1);
    rect(this.x, this.y, this.w, this.h, 3);

    // Username header strip
    noStroke();
    fill("#E8E4DE");
    rect(this.x, this.y, this.w, min(8, this.h * 0.45), 3, 3, 0, 0);

    // Tiny avatar dot
    fill("#A09880");
    ellipse(this.x + 7, this.y + 4, 5, 5);

    // Small text lines to suggest a post
    fill("#C0BAB0");
    rect(this.x + 14, this.y + 2, this.w * 0.35, 2, 1);
    if (this.h > 10) {
      rect(this.x + 4, this.y + this.h * 0.6, this.w * 0.7, 2, 1);
      rect(this.x + 4, this.y + this.h * 0.8, this.w * 0.45, 2, 1);
    }

    noStroke();
  }

  // ── SLIPPERY – glossy XP-blue active input field ───────────────────────────
  _drawSlippery() {
    // Shadow
    fill(0, 0, 0, 20);
    rect(this.x + 2, this.y + 3, this.w, this.h, 3);

    // Base blue fill
    fill("#D0E8FF");
    stroke("#4A90D9");
    strokeWeight(1.5);
    rect(this.x, this.y, this.w, this.h, 3);

    // XP blue inner highlight
    noStroke();
    fill("#AACCFF");
    rect(this.x + 2, this.y + 2, this.w - 4, this.h * 0.4, 2);

    // Glossy top sheen
    fill(255, 255, 255, 110);
    rect(this.x + 3, this.y + 1, this.w - 6, this.h * 0.3, 2);

    // Blinking cursor caret
    if (frameCount % 60 < 35) {
      fill("#1A5FAA");
      rect(this.x + this.w - 10, this.y + 3, 2, this.h - 6);
    }

    // Tiny "placeholder text" lines
    fill("#8AAED0");
    rect(this.x + 6, this.y + this.h * 0.45, this.w * 0.55, 2, 1);

    noStroke();
  }

  // ── SLOW – progress bar with moving stripes ────────────────────────────────
  _drawSlow() {
    // Shadow
    fill(0, 0, 0, 20);
    rect(this.x + 2, this.y + 3, this.w, this.h, 3);

    // Trough (unfilled part)
    fill("#D8D0C4");
    stroke("#B0A898");
    strokeWeight(1);
    rect(this.x, this.y, this.w, this.h, 3);

    // Filled progress (about 60% full – looks mid-load)
    let fillW = this.w * 0.62;
    noStroke();
    fill("#48A848");
    rect(this.x + 1, this.y + 1, fillW - 2, this.h - 2, 2);

    // Animated diagonal stripes — clipped to filled area
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(this.x + 1, this.y + 1, fillW - 2, this.h - 2);
    drawingContext.clip();
    fill(255, 255, 255, 50);
    noStroke();
    let stripeW = 10;
    let step = 20;
    for (
      let sx = this.x - step + this.stripeOffset;
      sx < this.x + fillW;
      sx += step
    ) {
      beginShape();
      vertex(sx, this.y + 1);
      vertex(sx + stripeW, this.y + 1);
      vertex(sx + stripeW - this.h + 2, this.y + this.h - 1);
      vertex(sx - this.h + 2, this.y + this.h - 1);
      endShape(CLOSE);
    }
    drawingContext.restore();

    // "Loading…" label
    fill("#1A4A1A");
    textSize(8);
    textAlign(LEFT, CENTER);
    textStyle(BOLD);
    text("Loading…", this.x + 5, this.y + this.h / 2);
    textStyle(NORMAL);
    textAlign(LEFT);

    noStroke();
  }

  // ── FALLING – red "deleted post / error" ──────────────────────────────────
  _drawFalling() {
    // Flicker: skip drawing some frames when near collapse
    let flickerOk = true;
    if (this.falling) {
      let prog = this.fallTimer / SHAKE_FRAMES;
      // above 60% progress start flickering randomly
      if (prog > 0.6 && random() < map(prog, 0.6, 1.0, 0.05, 0.7)) {
        flickerOk = false;
      }
    }
    if (!flickerOk) return;

    // Shadow
    fill(0, 0, 0, 20);
    rect(this.x + 2, this.y + 3, this.w, this.h, 3);

    // Body
    fill(this.falling ? "#FFDDDD" : "#FFF0F0");
    stroke("#CC3333");
    strokeWeight(1.5);
    rect(this.x, this.y, this.w, this.h, 3);

    noStroke();

    // Red header bar
    fill("#CC3333");
    rect(this.x, this.y, this.w, min(8, this.h * 0.45), 3, 3, 0, 0);

    // "⚠ Post removed" text
    fill(this.falling ? "#AA0000" : "#CC3333");
    textSize(7);
    textAlign(LEFT, CENTER);
    textStyle(BOLD);
    text(
      this.falling ? "ERROR: Post removed" : "⚠ Post removed",
      this.x + 5,
      this.y + this.h / 2 + 2,
    );
    textStyle(NORMAL);
    textAlign(LEFT);

    // Crack lines (appear once falling starts)
    if (this.falling) {
      stroke("#AA2222");
      strokeWeight(1);
      let prog = this.fallTimer / SHAKE_FRAMES;
      // crack 1
      line(
        this.x + this.w * 0.3,
        this.y,
        this.x + this.w * 0.3 + prog * 10,
        this.y + this.h * prog * 0.8,
      );
      // crack 2
      line(
        this.x + this.w * 0.65,
        this.y + this.h * 0.3,
        this.x + this.w * 0.65 - prog * 8,
        this.y + this.h,
      );
      noStroke();
    }

    noStroke();
  }
  // ── INVISIBLE – hidden platform that fades in when player is nearby ────────
  _drawInvisible() {
    let pulse = sin(frameCount * 0.1) * 0.5 + 0.5; // 0-1

    // Always draw hint sparkles — bright and large so players notice them
    for (let p of this._hintParticles) {
      noStroke();
      // Bright white-cyan core
      fill(200, 245, 255, p.life * 220);
      ellipse(p.x, p.y, p.size * p.life, p.size * p.life);
      // Soft glow ring around each sparkle
      fill(100, 210, 255, p.life * 80);
      ellipse(p.x, p.y, p.size * p.life * 2.2, p.size * p.life * 2.2);
    }

    // Even when invisible, draw a faint ghost outline so players can sense the shape
    noFill();
    stroke(180, 230, 255, 40 + pulse * 30);
    strokeWeight(1.5);
    rect(this.x, this.y, this.w, this.h, 3);
    noStroke();

    if (this.visAlpha < 4) return;

    let a = this.visAlpha;

    // Wide outer glow — very visible bloom
    noStroke();
    fill(60, 190, 255, a * 0.45);
    rect(this.x - 10, this.y - 10, this.w + 20, this.h + 20, 12);

    // Mid glow ring, pulsing
    fill(100, 215, 255, a * 0.55 * (0.6 + pulse * 0.4));
    rect(this.x - 5, this.y - 5, this.w + 10, this.h + 10, 8);

    // Main body — bright electric teal, nearly opaque
    fill(0, 220, 255, a * 0.92);
    stroke(180, 245, 255, a);
    strokeWeight(2);
    rect(this.x, this.y, this.w, this.h, 3);

    // Bold white top highlight
    noStroke();
    fill(255, 255, 255, a * 0.65);
    rect(this.x + 2, this.y + 2, this.w - 4, this.h * 0.45, 2);

    // Fast scan-line sweep
    let scanPos = ((frameCount * 2.5) % (this.w + 30)) - 15;
    fill(255, 255, 255, a * 0.8);
    rect(this.x + scanPos, this.y + 1, 8, this.h - 2, 2);

    // Pulsing edge sparkle dots along top edge
    fill(255, 255, 255, a * 0.9 * pulse);
    let dotSpacing = this.w / 5;
    for (let i = 0; i <= 5; i++) {
      let dotSize = 3 + pulse * 3;
      ellipse(this.x + i * dotSpacing, this.y + 2, dotSize, dotSize);
    }

    noStroke();
  }

  // ── MOVING – scrolling marquee banner ─────────────────────────────────────
  _drawMoving() {
    // Shadow
    fill(0, 0, 0, 20);
    rect(this.x + 2, this.y + 3, this.w, this.h, 3);

    // Body — classic marquee purple/teal gradient look
    fill("#660099");
    stroke("#FF00FF");
    strokeWeight(1.5);
    rect(this.x, this.y, this.w, this.h, 3);

    // Inner lighter strip
    noStroke();
    fill("#9900CC");
    rect(this.x + 2, this.y + 2, this.w - 4, this.h * 0.45, 2);

    // Scrolling "marquee" text — offset by frameCount so it crawls left
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(this.x + 2, this.y, this.w - 4, this.h);
    drawingContext.clip();
    fill("#FFFF00");
    textSize(8);
    textAlign(LEFT, CENTER);
    textStyle(BOLD);
    let marqueeX = this.x + this.w - ((frameCount * 1.2) % (this.w + 120));
    text(
      "★ CLICK HERE ★ YOU WON ★ A FREE GIFTCARD ★",
      marqueeX,
      this.y + this.h / 2 + 1,
    );
    textStyle(NORMAL);
    drawingContext.restore();

    noStroke();
  }
}
