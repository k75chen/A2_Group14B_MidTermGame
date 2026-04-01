/*
Week 4 — Example 5: Example 5: Blob Platformer (JSON + Classes)
Course: GBDA302
Instructors: Dr. Karen Cochrane and David Han
Date: Feb. 5, 2026
*/

let levelData = [];
let levelIndex = 0;
let totalLevels = 3;

let world;
let player;

let cameraY = 0;
let hearts = 4;
let hasBeenBelowFinish = false;
let levelStarted = false;
let activeCheckpointY = 0;
let gameState = "start"; // "start", "rules", "playing", "gameover", "win", "complete"
let respawnFlashTimer = 0;
let fallThreshold = 600;
let lastGroundY = 0;

// stress & popups
let stress = 0;

let popupImgs = { small: [], regular: [], tall: [], long: [] };

const POPUP_SLOTS = [
  // Level 1 cap: 6 popups (stress 0-30%, 1 per 5%)
  { imgKey: "long", imgIndex: 0, xf: 0.58, yf: 0.8 },
  { imgKey: "small", imgIndex: 0, xf: 0.1, yf: 0.12 },
  { imgKey: "regular", imgIndex: 2, xf: 0.04, yf: 0.28 },
  { imgKey: "tall", imgIndex: 0, xf: 0.5, yf: 0.08 },
  { imgKey: "regular", imgIndex: 1, xf: 0.7, yf: 0.38 },
  { imgKey: "small", imgIndex: 1, xf: 0.3, yf: 0.52 },
  // Level 2 additional: slots 6-11
  { imgKey: "regular", imgIndex: 2, xf: 0.72, yf: 0.55 },
  { imgKey: "tall", imgIndex: 1, xf: 0.55, yf: 0.2 },
  { imgKey: "long", imgIndex: 0, xf: 0.58, yf: 0.82 },
  { imgKey: "small", imgIndex: 0, xf: 0.82, yf: 0.15 },
  { imgKey: "tall", imgIndex: 2, xf: 0.1, yf: 0.6 },
  { imgKey: "regular", imgIndex: 0, xf: 0.45, yf: 0.48 },
  // Level 3 additional: slots 12-19
  { imgKey: "small", imgIndex: 1, xf: 0.88, yf: 0.42 },
  { imgKey: "tall", imgIndex: 0, xf: 0.25, yf: 0.1 },
  { imgKey: "regular", imgIndex: 1, xf: 0.62, yf: 0.68 },
  { imgKey: "small", imgIndex: 2, xf: 0.78, yf: 0.78 },
  { imgKey: "long", imgIndex: 0, xf: 0.12, yf: 0.85 },
  { imgKey: "tall", imgIndex: 1, xf: 0.5, yf: 0.05 },
  { imgKey: "regular", imgIndex: 2, xf: 0.35, yf: 0.35 },
  { imgKey: "small", imgIndex: 0, xf: 0.9, yf: 0.65 },
];

// Each slot gets a scale value: 0 = hidden, animates to 1 = full size
// Uses an ease-out so it pops in fast then settles
let popupScales = new Array(POPUP_SLOTS.length).fill(0);
let popupVelocities = new Array(POPUP_SLOTS.length).fill(0);
let visibleSlotCount = 0;

let popupSpawnCooldown = 0;

let cursorSprites = { normal: null, fall: null, jumpl: null, jumpr: null };

// Background image
let bgImg = null;
let bgImg2 = null;

// Start screen assets
let startButtonImg = null;
let rulesImg = null;
let reverieImg = null;

// Sound assets
let sndJump, sndBgMusic, sndGameover, sndRespawn, sndPopup;

function preload() {
  levelData = [];
  levelData[0] = loadJSON("level1.json");
  levelData[1] = loadJSON("level2.json");
  levelData[2] = loadJSON("level3.json");

  const popupTypes = { small: 3, regular: 3, tall: 3, long: 1 };
  for (let [key, count] of Object.entries(popupTypes)) {
    for (let i = 1; i <= count; i++) {
      (function (k, idx, num) {
        popupImgs[k][idx] = loadImage(
          "assets/images/" + k + "_popup_" + num + ".png",
          (img) => {
            popupImgs[k][idx] = img;
          },
          () => {
            popupImgs[k][idx] = null;
          },
        );
      })(key, i - 1, i);
    }
  }

  // Start screen images
  startButtonImg = loadImage(
    "assets/images/start_button.png",
    (img) => {
      startButtonImg = img;
    },
    () => {
      startButtonImg = null;
    },
  );
  reverieImg = loadImage(
    "assets/images/reverie.png",
    (img) => {
      reverieImg = img;
    },
    () => {
      reverieImg = null;
    },
  );
  rulesImg = loadImage(
    "assets/images/rules.jpg",
    (img) => {
      rulesImg = img;
    },
    () => {
      rulesImg = null;
    },
  );

  // Background images
  bgImg = loadImage(
    "assets/images/background.png",
    (img) => {
      bgImg = img;
    },
    () => {
      bgImg = null;
    },
  );
  bgImg2 = loadImage(
    "assets/images/background2.png",
    (img) => {
      bgImg2 = img;
    },
    () => {
      bgImg2 = null;
    },
  );

  // Sounds
  sndJump = loadSound(
    "assets/sounds/jump.mp3",
    () => {},
    () => {
      sndJump = null;
    },
  );
  sndBgMusic = loadSound(
    "assets/sounds/level1_sound.mp3",
    () => {},
    () => {
      sndBgMusic = null;
    },
  );
  sndGameover = loadSound(
    "assets/sounds/gameover.mp3",
    () => {},
    () => {
      sndGameover = null;
    },
  );
  sndRespawn = loadSound(
    "assets/sounds/respawn.mp3",
    () => {},
    () => {
      sndRespawn = null;
    },
  );
  sndPopup = loadSound(
    "assets/sounds/popup.mp3",
    () => {},
    () => {
      sndPopup = null;
    },
  );
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  player = new BlobPlayer();
  noStroke();
  textFont("sans-serif");
  textSize(14);

  // Load cursor sprites after preload — nested loadImage breaks p5's preload counter
  const spriteNames = ["normal", "fall", "jumpl", "jumpr"];
  for (let s of spriteNames) {
    (function (name) {
      cursorSprites[name] = null;
      const paths = [
        "assets/images/cursor_" + name + ".PNG",
        "assets/images/cursor_" + name + ".png",
        "assets/images/Cursor_" + name + ".PNG",
        "assets/images/Cursor_" + name + ".png",
      ];
      function tryNext(i) {
        if (i >= paths.length) return;
        loadImage(
          paths[i],
          (img) => {
            cursorSprites[name] = img;
          },
          () => tryNext(i + 1),
        );
      }
      tryNext(0);
    })(s);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function drawHearts() {
  const total = 4;
  const size = 32;
  const spacing = 50;
  const startX = 24;
  const startY = 28;

  // Dark pill backdrop behind all hearts so they pop on any background
  noStroke();
  fill(0, 0, 0, 110);
  let padX = 10,
    padY = 8;
  let pillW = total * spacing + padX * 2 - (spacing - size);
  let pillH = size + padY * 2;
  rect(startX - padX, startY - padY, pillW, pillH, pillH / 2);

  for (let i = 0; i < total; i++) {
    const cx = startX + i * spacing + size / 2;
    const cy = startY + size / 2;
    const filled = i < hearts;
    const s = size * 0.5;

    // Stronger drop shadow
    noStroke();
    fill(0, 0, 0, 90);
    push();
    translate(3, 5);
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

    if (filled) {
      noStroke();
      fill(255, 255, 255, 70);
      ellipse(cx - s * 0.35, cy - s * 0.25, s * 0.55, s * 0.4);
    }
  }
  noStroke();
}

function draw() {
  if (gameState === "playing" && world) {
    for (let cy of world.checkpoints) {
      if (player.y < cy && cy < activeCheckpointY) {
        activeCheckpointY = cy;
      }
    }

    // --- STRESS GAUGE ---
    let isMoving = abs(player.vx) > 0.2;
    let isInAir = !player.onGround;

    if (isMoving || isInAir) {
      let levelStartY = world.start.y;
      let levelTopY = 80;
      let climbProgress = map(player.y, levelStartY, levelTopY, 0, 1);
      climbProgress = constrain(climbProgress, 0, 1);
      stress += map(climbProgress, 0, 1, 0.006, 0.018);
    }

    let stressCap = levelIndex === 0 ? 30 : levelIndex === 1 ? 60 : 100;
    stress = constrain(stress, 0, stressCap);

    // --- POPUP SLOTS ---
    let maxSlots = levelIndex === 0 ? 6 : levelIndex === 1 ? 12 : 20;
    let targetVisible = constrain(floor(stress / 5), 0, maxSlots);

    if (targetVisible > visibleSlotCount) {
      let nextSlot = visibleSlotCount;
      if (levelIndex === 2) {
        let hidden = [];
        for (let s = 0; s < maxSlots; s++) {
          if (popupScales[s] === 0) hidden.push(s);
        }
        if (hidden.length > 0) nextSlot = hidden[floor(random(hidden.length))];
      }
      // Kick off pop animation — start at small scale
      if (popupScales[nextSlot] === 0) popupScales[nextSlot] = 0.01;
      visibleSlotCount++;
      if (sndPopup) {
        sndPopup.stop();
        sndPopup.setVolume(0.5);
        sndPopup.play();
      }
    }

    // Spring physics — overshoots slightly then settles for a subtle bounce
    for (let s = 0; s < POPUP_SLOTS.length; s++) {
      if (popupScales[s] <= 0) continue;
      popupVelocities[s] += (1 - popupScales[s]) * 0.22; // stiffness
      popupVelocities[s] *= 0.72; // damping (lower = more bounce)
      popupScales[s] += popupVelocities[s];
    }

    // --- TRACK LAST GROUND POSITION ---
    if (player.onGround) lastGroundY = player.y;

    // --- FALL DETECTION ---
    if (player.y > lastGroundY + fallThreshold) {
      hearts--;
      stress = min(stress + 3, stressCap);
      hearts = max(hearts, 0);
      let fellFromY = lastGroundY;
      lastGroundY = activeCheckpointY;

      let candidates = world.platforms.filter(
        (p) =>
          p.mechanic !== "falling" &&
          p.type !== "finish" &&
          p.type !== "default" &&
          p.y <= activeCheckpointY,
      );
      if (candidates.length === 0) {
        candidates = world.platforms.filter(
          (p) =>
            p.mechanic !== "falling" &&
            p.type !== "finish" &&
            p.type !== "default",
        );
      }

      let bestPlatform = null;
      let bestDist = Infinity;
      for (let p of candidates) {
        if (p.y < fellFromY) continue; // never respawn above where you fell from
        let dist = abs(p.y - fellFromY);
        if (dist < bestDist) {
          bestDist = dist;
          bestPlatform = p;
        }
      }

      if (bestPlatform) {
        player.x = bestPlatform.x + bestPlatform.w / 2;
        player.y = bestPlatform.y - player.r - 1;
      } else {
        player.x = windowWidth / 2;
        player.y = activeCheckpointY - player.r - 1;
      }

      player.vx = 0;
      player.vy = 0;
      lastGroundY = player.y;
      cameraY = player.y - height * 0.6;
      respawnFlashTimer = 90;
      if (sndRespawn) {
        sndRespawn.stop();
        sndRespawn.setVolume(0.7);
        sndRespawn.play();
      }

      if (hearts <= 0) {
        gameState = "gameover";
        if (sndBgMusic) sndBgMusic.stop();
        if (sndGameover) {
          sndGameover.stop();
          sndGameover.setVolume(0.8);
          sndGameover.play();
        }
      }
    }

    // --- PHYSICS UPDATE ---
    player.update(world.platforms);

    // --- TRACK PLAYER PROGRESSION ---
    if (!levelStarted && player.y < world.start.y - 1) levelStarted = true;

    // --- UPDATE BELOW-FINISH FLAG ---
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
      let onFinish =
        player.x > finishPlatform.x &&
        player.x < finishPlatform.x + finishPlatform.w &&
        player.y + player.r >= finishPlatform.y - 2 &&
        player.y + player.r <= finishPlatform.y + finishPlatform.h + 10;
      if (onFinish) {
        gameState = levelIndex >= totalLevels - 1 ? "complete" : "win";
      }
    }
  }

  // --- PRE-WORLD SCREENS (start/rules render before world exists) ---
  if (gameState === "start") {
    drawStartScreen();
    return;
  }
  if (gameState === "rules") {
    drawRulesScreen();
    return;
  }

  // --- CAMERA ---
  if (!world) return;
  const target = player.y - height * 0.6;
  cameraY = lerp(cameraY, target, 0.1);
  cameraY = max(cameraY, 0);
  if (world.height !== undefined)
    cameraY = min(cameraY, max(world.height - height, 0));

  // --- DRAW WORLD ---
  if (respawnFlashTimer > 0) respawnFlashTimer--;
  let showPlayer =
    respawnFlashTimer === 0 || floor(respawnFlashTimer / 15) % 2 === 0;

  // Clear canvas first so areas outside the bg image don't show stale frames
  background(color(world.theme.bg));

  push();
  translate(0, -cameraY);
  world.updatePlatforms();
  let currentBg = levelIndex === 1 ? bgImg2 : bgImg;
  world.drawWorld(currentBg);
  if (showPlayer) player.draw(world.theme.blob, cursorSprites);
  pop();

  // --- HUD ---
  push();
  resetMatrix();
  drawHearts();
  drawStressDebug();
  drawPopups();
  pop();

  // --- SCREENS ---
  if (gameState === "gameover") drawGameOver();
  if (gameState === "win") drawWinScreen();
  if (gameState === "complete") drawCompleteScreen();
}

function drawGameOver() {
  push();
  resetMatrix();
  fill("#1138FE");
  rect(0, 0, width, height);
  fill("#FFFFFF");
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(52);
  text("GAME OVER", width / 2, height / 2 - 40);
  textSize(16);
  fill("#FFFFFF");
  text(
    "You couldn't hold it together. Now everyone knows.",
    width / 2,
    height / 2 + 10,
  );
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
  text("Hold yourself together a little longer.", width / 2, height / 2 + 20);
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

function drawPopups() {
  imageMode(CORNER);
  for (let s = 0; s < POPUP_SLOTS.length; s++) {
    let sc = popupScales[s];
    if (sc <= 0) continue;
    let slot = POPUP_SLOTS[s];
    let img = popupImgs[slot.imgKey]
      ? popupImgs[slot.imgKey][slot.imgIndex]
      : null;
    if (!img) continue;

    let maxW =
      slot.imgKey === "long"
        ? width * 0.3
        : slot.imgKey === "tall"
          ? width * 0.18
          : slot.imgKey === "small"
            ? width * 0.14
            : width * 0.22;
    let baseScale = maxW / img.width;
    let dw = img.width * baseScale * sc;
    let dh = img.height * baseScale * sc;

    // Anchor from top-left corner position, but keep the center fixed
    // so the popup grows from its intended position rather than top-left
    let cx = slot.xf * width + (img.width * baseScale) / 2;
    let cy = slot.yf * height + (img.height * baseScale) / 2;

    image(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  imageMode(CORNER);
}

// TEMPORARY DEBUG: stress gauge top-right — remove when asked
function drawStressDebug() {
  push();
  let stressCap = levelIndex === 0 ? 30 : levelIndex === 1 ? 60 : 100;
  let barW = 180,
    barH = 18;
  let bx = width - barW - 20,
    by = 16;

  noStroke();
  fill(0, 0, 0, 60);
  rect(bx, by, barW, barH, 4);

  let fillW = map(stress, 0, stressCap, 0, barW);
  let col =
    stress < stressCap * 0.5
      ? color("#6EC97A")
      : stress < stressCap * 0.85
        ? color("#F0C040")
        : color("#E05050");
  fill(col);
  rect(bx, by, fillW, barH, 4);

  stroke(255, 255, 255, 120);
  strokeWeight(1);
  noFill();
  rect(bx, by, barW, barH, 4);
  noStroke();

  fill(255);
  textSize(11);
  textAlign(RIGHT, TOP);
  text(
    "stress: " +
      nf(stress, 1, 1) +
      "% / " +
      stressCap +
      "%  |  popups: " +
      visibleSlotCount,
    width - 20,
    by + barH + 4,
  );
  textAlign(LEFT);
}

function drawStartScreen() {
  push();
  resetMatrix();
  background("#1138FE");
  noStroke();
  imageMode(CORNER);

  // Sizes — reverie is now ~2x bigger, tight gap to button
  let btnW = min(width * 0.38, 480);
  let revW = min(width * 1.0, 1000); // doubled from 0.52

  // Heights (preserve aspect ratios)
  let btnH = startButtonImg
    ? btnW * (startButtonImg.height / startButtonImg.width)
    : btnW * 0.22;
  let revH = reverieImg
    ? revW * (reverieImg.height / reverieImg.width)
    : revW * 0.25;

  // Total stack height so we can center both together vertically
  let gap = 32; // tight gap
  let stackH = revH + gap + btnH;
  let topY = height / 2 - stackH / 2;

  // --- Reverie title ---
  if (reverieImg) {
    let rx = width / 2 - revW / 2;
    image(reverieImg, rx, topY, revW, revH);
  }

  // --- Start button (below reverie) ---
  if (startButtonImg) {
    let bx = width / 2 - btnW / 2;
    let by = topY + revH + gap;
    noTint();
    blendMode(SCREEN);
    image(startButtonImg, bx, by, btnW, btnH);
    blendMode(BLEND);
  }

  textFont("sans-serif");
  textAlign(LEFT);
  pop();
}

function drawRulesScreen() {
  push();
  resetMatrix();
  background("#1138FE");
  noStroke();
  textAlign(CENTER, CENTER);

  if (rulesImg) {
    let maxW = min(width * 0.78, 720);
    let maxH = height * 0.78;
    let sc = min(maxW / rulesImg.width, maxH / rulesImg.height);
    let rw = rulesImg.width * sc;
    let rh = rulesImg.height * sc;
    let rx = width / 2 - rw / 2; // horizontally centered
    let promptH = 40;
    let totalH = rh + promptH;
    let ry = height / 2 - totalH / 2; // vertically centered with prompt
    imageMode(CORNER);
    noTint();
    image(rulesImg, rx, ry, rw, rh);

    // Prompt below image
    fill(255);
    textFont("monospace");
    textSize(min(width * 0.018, 16));
    text("press ENTER to start", width / 2, ry + rh + 40);
  } else {
    // Fallback if rules.png not found
    fill(255);
    textFont("monospace");
    textSize(min(width * 0.018, 16));
    text("press ENTER to start", width / 2, height / 2);
  }

  textFont("sans-serif");
  textAlign(LEFT);
  pop();
}

function keyPressed() {
  if (gameState === "start") return; // no keys on start screen
  if (gameState === "rules" && keyCode === ENTER) {
    loadLevel(0);
    return;
  }

  if (
    gameState === "playing" &&
    (key === " " || key === "W" || key === "w" || keyCode === UP_ARROW)
  ) {
    player.jump();
    if (sndJump) {
      sndJump.stop();
      sndJump.setVolume(0.6);
      sndJump.play();
    }
  }

  if (gameState === "win" && keyCode === ENTER) {
    gameState = "playing";
    if (levelIndex + 1 === 1) hearts = 4;
    loadLevel(levelIndex + 1);
  }
  if (gameState === "gameover" && (key === "r" || key === "R")) {
    gameState = "playing";
    hearts = 4;
    loadLevel(0);
  }
  if (gameState === "complete" && (key === "r" || key === "R")) {
    gameState = "playing";
    hearts = 4;
    loadLevel(0);
  }
  if (key === "8") {
    hearts = 4;
    loadLevel(1);
  }
  if (key === "9") {
    hearts = 4;
    loadLevel(2);
  }
}

function mousePressed() {
  if (gameState !== "start") return;
  if (!startButtonImg) {
    // fallback: any click advances
    gameState = "rules";
    return;
  }
  // Check if click lands on the start button image
  let btnW = min(width * 0.38, 480);
  let revW = min(width * 1.0, 1000);
  let revH = reverieImg
    ? revW * (reverieImg.height / reverieImg.width)
    : revW * 0.25;
  let btnH = btnW * (startButtonImg.height / startButtonImg.width);
  let gap = 24;
  let stackH = revH + gap + btnH;
  let bx = width / 2 - btnW / 2;
  let by = height / 2 - stackH / 2 + revH + gap;
  if (
    mouseX >= bx &&
    mouseX <= bx + btnW &&
    mouseY >= by &&
    mouseY <= by + btnH
  ) {
    gameState = "rules";
  }
}

function loadLevel(i) {
  levelIndex = i;
  gameState = "playing";
  hasBeenBelowFinish = false;
  levelStarted = false;
  world = new WorldLevel(levelData[levelIndex]);
  resizeCanvas(windowWidth, windowHeight);
  player.spawnFromLevel(world);
  player.x = windowWidth / 2;
  activeCheckpointY = world.start.y;
  lastGroundY = world.start.y;
  stress = 0;
  popupScales.fill(0);
  popupVelocities.fill(0);
  visibleSlotCount = 0;
  popupSpawnCooldown = 0;
  respawnFlashTimer = 0;
  cameraY = player.y - height * 0.6;
  if (cameraY < 0) cameraY = 0;

  // Start background music looping quietly
  if (sndBgMusic) {
    sndBgMusic.stop();
    sndBgMusic.setVolume(0.25);
    sndBgMusic.loop();
  }
}
