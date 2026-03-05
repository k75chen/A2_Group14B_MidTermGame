/*
Week 4 — Example 5: Example 5: Blob Platformer (JSON + Classes)
Course: GBDA302
Instructors: Dr. Karen Cochrane and David Han
Date: Feb. 5, 2026

This file orchestrates everything:
- load JSON in preload()
- create WorldLevel from JSON
- create BlobPlayer
- update + draw each frame
- handle input events (jump, optional next level)

This matches the structure of the original blob sketch from Week 2 but moves
details into classes.
*/

let levelData = []; // array of level definitions
let levelIndex = 0;
let totalLevels = 3; // number of levels loaded

let world; // WorldLevel instance (current level)
let player; // BlobPlayer instance

// cameraY tracks the vertical offset applied to the world so that the player
// stays in the lower third of the screen as they climb upward.  We will
// lerp it smoothly toward the target each frame.
let cameraY = 0;

// Health/lives count.  Cascade starts with four hearts.
let hearts = 4;

// helper used to block win/complete logic until the player has been
// physically below the finish platform at least once.  This prevents the
// player from triggering a win immediately on level load (e.g. if the
// spawn point overlaps the finish).  It also protects against rapid
// level transitions carrying the previous level’s state forward.
let hasBeenBelowFinish = false;

// Additional guard: require the player to move upward at least a little
// from the starting Y position before any win/complete logic can fire.
// This catches cases where the spawn occurs on or above the finish line.
let levelStarted = false;

// checkpoint / respawn tracking
let activeCheckpointY = 0; // world Y of the current respawn point (0 = not yet set)
let gameState = "playing"; // "playing", "gameover", "win", "complete", "dialogue"

// fall tracking
let lastGroundY = 5800;
let fallThreshold = 600;

// stress & popups
let stress = 0; // 0-100, hidden from player

const level1Popups = [
  "I hope I don't draw attention on the train",
  "Act normal",
  "Did I lock the door?",
  "Don't forget to breathe normally",
  "Keep it together",
  "Why is this so hard?",
  "Stop. Just stop.",
  "Everyone can tell.",
  "Breathe. Just breathe.",
  "Not now. Please not now.",
];

// Each popup in this array is an object:
// { text, x, y, size, alpha }
let activePopups = [];

// How many frames between attempting to spawn a new popup.
// Gets shorter as stress increases.
let popupSpawnCooldown = 0;

// NPC images — teammates: replace filenames with your actual image files.
// If the file is missing the game falls back to a coloured circle placeholder.
let npcGoodImg, npcBadImg;

// The NPC whose dialogue is currently on screen (null when not in dialogue).
let activeDialogue = null;

function preload() {
  levelData = [];
  levelData[0] = loadJSON("level1.json");
  levelData[1] = loadJSON("level2.json");
  levelData[2] = loadJSON("level3.json");

  // NPC images — error callback sets to null so the fallback shape is used
  // if the file doesn't exist yet.
  // Teammates: replace "npc_good.jpg" / "npc_bad.jpg" with your actual filenames.
  npcGoodImg = loadImage("npc_good.jpg", null, () => {
    npcGoodImg = null;
  });
  npcBadImg = loadImage("npc_bad.jpg", null, () => {
    npcBadImg = null;
  });
}

function setup() {
  // Create a full-window canvas.  We'll keep this size throughout the
  // session and adjust on resize events.
  createCanvas(windowWidth, windowHeight);

  // Create the player once (it will be respawned per level).
  player = new BlobPlayer();

  // Load the first level.
  loadLevel(0);

  // Simple shared style setup.
  noStroke();
  textFont("sans-serif");
  textSize(14);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Draw the top-left lives display.  `hearts` is the number of remaining
// lives; total capacity is 4.  Filled hearts use #E8445A, empty use #D4C5B5.
// Each heart is 32px tall and spaced 44px apart horizontally.  A thin dark
// outline helps visibility.
function drawHearts() {
  const total = 4;
  const size = 32;
  const spacing = 50;
  const startX = 24;
  const startY = 28;

  for (let i = 0; i < total; i++) {
    const cx = startX + i * spacing + size / 2;
    const cy = startY + size / 2;
    const filled = i < hearts;
    const s = size * 0.5;

    // Drop shadow
    noStroke();
    fill(0, 0, 0, 30);
    push();
    translate(2, 3);
    beginShape();
    vertex(cx, cy + s * 0.65);
    bezierVertex(
      cx - s * 1.25,
      cy - s * 0.15,
      cx - s * 1.25,
      cy - s * 1.05,
      cx,
      cy - s * 0.25,
    );
    bezierVertex(
      cx + s * 1.25,
      cy - s * 1.05,
      cx + s * 1.25,
      cy - s * 0.15,
      cx,
      cy + s * 0.65,
    );
    endShape(CLOSE);
    pop();

    // Main heart body
    noStroke();
    fill(filled ? "#E8445A" : "#CDB8B8");
    beginShape();
    vertex(cx, cy + s * 0.65);
    bezierVertex(
      cx - s * 1.25,
      cy - s * 0.15,
      cx - s * 1.25,
      cy - s * 1.05,
      cx,
      cy - s * 0.25,
    );
    bezierVertex(
      cx + s * 1.25,
      cy - s * 1.05,
      cx + s * 1.25,
      cy - s * 0.15,
      cx,
      cy + s * 0.65,
    );
    endShape(CLOSE);

    // Dark outline
    stroke(filled ? "#B02040" : "#A89090");
    strokeWeight(1.5);
    noFill();
    beginShape();
    vertex(cx, cy + s * 0.65);
    bezierVertex(
      cx - s * 1.25,
      cy - s * 0.15,
      cx - s * 1.25,
      cy - s * 1.05,
      cx,
      cy - s * 0.25,
    );
    bezierVertex(
      cx + s * 1.25,
      cy - s * 1.05,
      cx + s * 1.25,
      cy - s * 0.15,
      cx,
      cy + s * 0.65,
    );
    endShape(CLOSE);

    // Shine highlight (top left of heart)
    if (filled) {
      noStroke();
      fill(255, 255, 255, 70);
      ellipse(cx - s * 0.35, cy - s * 0.25, s * 0.55, s * 0.4);
    }
  }
  noStroke();
}

function draw() {
  if (gameState === "playing") {
    // --- CHECKPOINT ACTIVATION (silent) ---
    // Tracks how far the player has climbed so they can't respawn
    // above progress they haven't earned.
    for (let cy of world.checkpoints) {
      if (player.y < cy && cy < activeCheckpointY) {
        activeCheckpointY = cy;
      }
    }

    // --- STRESS GAUGE ---
    // Only increases when the player is actively moving or in the air.
    // Standing still on a platform: no change.
    // The higher the player has climbed, the faster stress builds.
    let isMoving = abs(player.vx) > 0.2;
    let isInAir = !player.onGround;

    if (isMoving || isInAir) {
      // Use the current level's start Y and level height top (80) dynamically
      // so stress scales correctly on every level.
      let levelStartY = world.start.y;
      let levelTopY = 80;
      let climbProgress = map(player.y, levelStartY, levelTopY, 0, 1);
      climbProgress = constrain(climbProgress, 0, 1);
      stress += map(climbProgress, 0, 1, 0.05, 0.2);
    }

    // Clamp stress
    stress = constrain(stress, 0, 100);

    // --- POPUP SPAWNING ---
    // Popups only spawn once stress hits 35.
    // stress=35  → every 300 frames (slow, rare)
    // stress=60  → every 100 frames (steady)
    // stress=100 → every 15 frames (rapid, overwhelming)
    let spawnInterval = floor(map(stress, 35, 100, 300, 15));

    if (stress >= 35 && popupSpawnCooldown <= 0) {
      // Safety ceiling to prevent performance issues
      if (activePopups.length < 80) {
        let tSize = map(stress, 35, 100, 12, 26);
        activePopups.push({
          text: random(level1Popups),
          x: random(width * 0.08, width * 0.92),
          y: random(height * 0.12, height * 0.9),
          size: tSize,
          alpha: 0, // fades in from 0
        });
      }
      popupSpawnCooldown = spawnInterval;
    }

    // Always count down cooldown
    if (popupSpawnCooldown > 0) popupSpawnCooldown--;

    // --- UPDATE ACTIVE POPUPS ---
    // Popups only fade in; they never disappear.
    for (let p of activePopups) {
      if (p.alpha < 200) p.alpha += 6;
    }

    // --- TRACK LAST GROUND POSITION ---
    if (player.onGround) {
      lastGroundY = player.y;
    }

    // --- FALL DETECTION ---
    if (player.y > lastGroundY + fallThreshold) {
      hearts--;
      // Losing a heart spikes stress significantly
      stress = min(stress + 25, 100);
      hearts = max(hearts, 0);
      let fellFromY = lastGroundY; // save before overwriting
      lastGroundY = activeCheckpointY;

      // Find which platform the player fell from (closest to fellFromY)
      let allPlatforms = world.platforms.filter(
        (p) => p.type !== "finish" && p.type !== "default",
      );

      // Sort all platforms by Y ascending (top of level first, y=0 is top)
      allPlatforms.sort((a, b) => a.y - b.y);

      // Find the index of the platform closest to where player last stood
      let fellFromIndex = 0;
      let closestDist = Infinity;
      for (let i = 0; i < allPlatforms.length; i++) {
        let dist = abs(allPlatforms[i].y - fellFromY);
        if (dist < closestDist) {
          closestDist = dist;
          fellFromIndex = i;
        }
      }

      // Step back 4 platforms DOWN from where they fell
      // (higher index = lower in level = larger y value)
      // But never go below the ground platform
      let respawnIndex = min(fellFromIndex + 4, allPlatforms.length - 1);

      // Clamp to valid array range — no unbounded loop
      respawnIndex = constrain(respawnIndex, 0, allPlatforms.length - 1);
      // If that platform is above the active checkpoint, find the
      // first platform at or below activeCheckpointY instead
      if (allPlatforms[respawnIndex].y < activeCheckpointY) {
        for (let i = 0; i < allPlatforms.length; i++) {
          if (allPlatforms[i].y >= activeCheckpointY) {
            respawnIndex = i;
            break;
          }
        }
        respawnIndex = constrain(respawnIndex, 0, allPlatforms.length - 1);
      }

      let bestPlatform = allPlatforms[respawnIndex];

      // Land player on top of that platform
      if (bestPlatform) {
        player.x = bestPlatform.x + bestPlatform.w / 2;
        player.y = bestPlatform.y - player.r - 1;
      } else {
        player.x = windowWidth / 2;
        player.y = activeCheckpointY - 80;
      }

      player.vx = 0;
      player.vy = 0;
      lastGroundY = player.y;
      cameraY = player.y - height * 0.6;

      if (hearts <= 0) {
        gameState = "gameover";
      }
    }

    // --- PHYSICS UPDATE ---
    player.update(world.platforms);

    // --- NPC CHECK ---
    // If the player just landed on a platform that has an untriggered NPC,
    // freeze the game and show the dialogue box.
    if (gameState === "playing" && player.onGround && world.npcs.length > 0) {
      for (let npc of world.npcs) {
        if (!npc.triggered && npc.isPlayerOn(player)) {
          npc.triggered = true;
          activeDialogue = npc;
          gameState = "dialogue";
          break;
        }
      }
    }

    // --- TRACK PLAYER PROGRESSION ---
    // mark the level as "started" once the player moves upward from the
    // spawn position.  this prevents wins on the very first frame of a level
    // load (we were seeing that on level 3 after transitioning from level 2).
    if (!levelStarted && player.y < world.start.y - 1) {
      levelStarted = true;
    }

    // --- UPDATE BELOW‑FINISH FLAG ---
    // If the finish platform exists we mark that the player has been below
    // it once the player's bottom edge crosses below the platform bottom
    // plus a small tolerance.  After this flag is true we will allow the win
    // check to succeed.  This guarantees the blob must actually climb from
    // under the goal before being able to finish.
    const finishPlatform = world.platforms.find((p) => p.type === "finish");
    if (
      finishPlatform &&
      !hasBeenBelowFinish &&
      player.y + player.r > finishPlatform.y + finishPlatform.h + 10
    ) {
      hasBeenBelowFinish = true;
    }

    // --- WIN DETECTION ---
    if (
      finishPlatform &&
      player.onGround &&
      hasBeenBelowFinish &&
      levelStarted
    ) {
      // Check if player is horizontally over the finish platform
      // and vertically sitting on top of it (within a small tolerance)
      let onFinish =
        player.x > finishPlatform.x &&
        player.x < finishPlatform.x + finishPlatform.w &&
        player.y + player.r >= finishPlatform.y - 2 &&
        player.y + player.r <= finishPlatform.y + finishPlatform.h + 10;

      if (onFinish) {
        if (levelIndex >= totalLevels - 1) {
          gameState = "complete";
        } else {
          gameState = "win";
        }
      }
    }
  }

  // --- CAMERA ---
  const target = player.y - height * 0.6;
  cameraY = lerp(cameraY, target, 0.1);
  cameraY = max(cameraY, 0);
  if (world.height !== undefined) {
    cameraY = min(cameraY, max(world.height - height, 0));
  }

  // --- DRAW WORLD ---
  push();
  translate(0, -cameraY);
  world.drawWorld();
  for (let npc of world.npcs) {
    npc.draw(npcGoodImg, npcBadImg);
  }
  player.draw(world.theme.blob);
  pop();

  // --- HUD ---
  push();
  resetMatrix();
  drawHearts();
  drawPopups();
  pop();

  // --- SCREENS ---
  if (gameState === "gameover") drawGameOver();
  if (gameState === "win") drawWinScreen();
  if (gameState === "complete") drawCompleteScreen();
  if (gameState === "dialogue") drawDialogue();
}

function drawGameOver() {
  push();
  resetMatrix();
  fill(40, 20, 20, 210);
  rect(0, 0, width, height);
  fill("#FFD0D0");
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(52);
  text("GAME OVER", width / 2, height / 2 - 40);
  textSize(16);
  fill(200, 160, 160);
  text("you couldn't hold it together", width / 2, height / 2 + 10);
  textSize(14);
  text("Press R to try again", width / 2, height / 2 + 55);
  textAlign(LEFT);
  pop();
}

function drawWinScreen() {
  push();
  resetMatrix();
  fill(255, 220, 150, 200);
  rect(0, 0, width, height);
  fill("#2C1810");
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(52);
  text("YOU MADE IT", width / 2, height / 2 - 40);
  textSize(18);
  text("hold yourself together a little longer", width / 2, height / 2 + 20);
  textSize(14);
  fill(100);
  text("Press ENTER to continue", width / 2, height / 2 + 65);
  textAlign(LEFT);
  pop();
}

function drawCompleteScreen() {
  push();
  resetMatrix();
  fill(30, 25, 20, 220);
  rect(0, 0, width, height);
  fill("#FFE8C0");
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(48);
  text("you made it through.", width / 2, height / 2 - 60);
  textSize(18);
  fill(200, 180, 150);
  text("all of it.", width / 2, height / 2 - 10);
  textSize(14);
  fill(160, 140, 120);
  text("that took everything you had.", width / 2, height / 2 + 30);
  textSize(13);
  text("Press R to play again", width / 2, height / 2 + 80);
  textAlign(LEFT);
  pop();
}

function drawDialogue() {
  if (!activeDialogue) return;
  push();
  resetMatrix();

  // Dim the background
  fill(0, 0, 0, 160);
  noStroke();
  rect(0, 0, width, height);

  // Dialogue box
  let bw = min(width * 0.5, 520);
  let bh = 160;
  let bx = width / 2 - bw / 2;
  let by = height / 2 - bh / 2;
  let isGood = activeDialogue.type === "good";

  fill(isGood ? "#FFF8EC" : "#FFF0F0");
  stroke(isGood ? "#C8A060" : "#C06060");
  strokeWeight(2);
  rect(bx, by, bw, bh, 12);

  // Label
  noStroke();
  fill(isGood ? "#7A5010" : "#902020");
  textSize(12);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  text("Stranger", bx + 18, by + 14);
  textStyle(NORMAL);

  // Dialogue text
  fill(40, 25, 20);
  textSize(17);
  textAlign(CENTER, CENTER);
  text(activeDialogue.dialogue, width / 2, height / 2 - 6);

  // Prompt
  fill(150);
  textSize(12);
  textAlign(CENTER, BOTTOM);
  text("Press ENTER to continue", width / 2, by + bh - 12);

  pop();
}

function drawPopups() {
  if (activePopups.length === 0) return;
  push();
  resetMatrix();
  noStroke();
  textStyle(ITALIC);
  for (let p of activePopups) {
    if (p.alpha <= 0) continue;
    fill(60, 40, 40, p.alpha);
    textSize(p.size);
    textAlign(CENTER, CENTER);
    text(p.text, p.x, p.y);
  }
  textStyle(NORMAL);
  textAlign(LEFT);
  pop();
}

function keyPressed() {
  if (key === " " || key === "W" || key === "w" || keyCode === UP_ARROW) {
    player.jump();
  }
  // Dismiss NPC dialogue — apply heart effect then resume
  if (gameState === "dialogue" && keyCode === ENTER) {
    if (activeDialogue.type === "good") {
      hearts = min(hearts + 1, 4);
    } else {
      hearts = max(hearts - 1, 0);
    }
    activeDialogue = null;
    gameState = hearts <= 0 ? "gameover" : "playing";
    return;
  }

  // Advance to next level
  if (gameState === "win" && keyCode === ENTER) {
    // carry remaining hearts into the next level instead of refilling
    // them.  The player should be punished for mistakes made earlier.
    gameState = "playing";
    loadLevel(levelIndex + 1);
  }
  // Restart from level 1 after game over
  if (gameState === "gameover" && (key === "r" || key === "R")) {
    gameState = "playing";
    hearts = 4;
    loadLevel(0);
  }
  // Restart from level 1 after full completion
  if (gameState === "complete" && (key === "r" || key === "R")) {
    gameState = "playing";
    hearts = 4;
    loadLevel(0);
  }
}

/*
Load a level by index:
- create a WorldLevel instance from JSON
- resize canvas based on inferred geometry
- spawn player using level start + physics
*/
function loadLevel(i) {
  levelIndex = i;

  // always make sure we start each level in the playing state.  calling
  // loadLevel directly (for testing) or after a win should behave the same.
  gameState = "playing";

  // reset win‑guards; the player hasn't climbed yet and certainly hasn't
  // been below the finish on this new level.
  hasBeenBelowFinish = false;
  levelStarted = false;

  // Create the world object from the JSON level object.
  world = new WorldLevel(levelData[levelIndex]);

  // For this version the canvas always fills the browser window.  The
  // world width therefore matches windowWidth and platforms should be
  // authored accordingly.  Simply resize to the current window size.
  resizeCanvas(windowWidth, windowHeight);

  // Apply level settings + respawn, then position the camera initially so the
  // player doesn't pop the first frame.
  player.spawnFromLevel(world);
  // center player horizontally on load
  player.x = windowWidth / 2;
  // initialize checkpoint/respawn state
  activeCheckpointY = world.start.y; // default respawn is spawn point
  lastGroundY = world.start.y;
  // reset stress/popup system
  stress = 0;
  activePopups = [];
  popupSpawnCooldown = 0;
  cameraY = player.y - height * 0.6;
  if (cameraY < 0) cameraY = 0;
}
