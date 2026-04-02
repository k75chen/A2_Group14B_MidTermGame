/*
WorldLevel.js (Example 5)

WorldLevel wraps ONE level object from levels.json and provides:
- Theme colours (background/platform/blob)
- Physics parameters that influence the player (gravity, jump velocity)
- Spawn position for the player (start)
- An array of Platform instances
- A couple of helpers to size the canvas to fit the geometry

This is directly inspired by your original blob sketch’s responsibilities: 
- parse JSON
- map platforms array
- apply theme + physics
- infer canvas size

Expected JSON shape for each level (from your provided file): 
{
  "name": "Intro Steps",
  "gravity": 0.65,
  "jumpV": -11.0,
  "theme": { "bg":"...", "platform":"...", "blob":"..." },
  "start": { "x":80, "y":220, "r":26 },
  "platforms": [ {x,y,w,h}, ... ]
}
*/

class WorldLevel {
  constructor(levelJson) {
    // A readable label for HUD.
    this.name = levelJson.name || "Level";

    // Theme defaults + override with JSON.
    this.theme = Object.assign(
      { bg: "#F0F0F0", platform: "#C8C8C8", blob: "#1478FF" },
      levelJson.theme || {},
    );

    // Physics knobs (the blob player will read these).
    this.gravity = levelJson.gravity ?? 0.65;
    this.jumpV = levelJson.jumpV ?? -11.0;

    // Convert raw platform objects into Platform instances.
    // If a platform entry has an "npc" field, also create an NPC for it.
    this.platforms = [];
    this.npcs = [];
    for (let pd of levelJson.platforms || []) {
      let plat = new Platform(pd);
      this.platforms.push(plat);
      if (pd.npc) {
        this.npcs.push(new NPC(pd.npc, plat));
      }
    }

    // Extract checkpoint heights (they are not platforms).
    this.checkpoints = (levelJson.checkpoints || []).map((c) => c.y);

    // Determine the vertical size of the level by looking at the lowest
    // platform edge and the start position (if provided).  This lets callers
    // clamp camera movement and optionally default the player to the bottom.
    // Note: world y coordinates increase downward (0 = top).
    let maxY = 0;
    for (const p of this.platforms) {
      maxY = max(maxY, p.y + p.h);
    }

    // If the JSON explicitly provides a start.y we keep it, otherwise we
    // default the spawn point to slightly above the bottom of the world.
    const explicitStartY = levelJson.start?.y;
    const defaultStartY = maxY ? maxY - 200 : 180;

    // Player spawn data.
    // Use optional chaining so levels can omit fields safely.
    this.start = {
      x: levelJson.start?.x ?? 80,
      y: explicitStartY !== undefined ? explicitStartY : defaultStartY,
      r: levelJson.start?.r ?? 26,
    };

    // Store computed height for camera/clamping purposes.
    this.height = maxY;
  }

  /*
  Canvas sizing is managed externally (typically windowWidth/Height).  The
  world width is effectively the full browser width so platforms should be
  authored to span whatever size is desired.  Older helpers for inferring
  canvas size have been removed.
  */

  /*
  Draw only the world (background + platforms).
  The player draws itself separately, after the world is drawn.
  */
  // Update platform state each frame (handles falling timers, stripe animation)
  updatePlatforms(player) {
    for (const p of this.platforms) {
      if (p.update) p.update();
      if (player && p.mechanic === "invisible") {
        p.updateVisibility(player.x, player.y);
      }
    }
  }

  drawWorld(bgImg) {
    if (bgImg) {
      // Draw bg at full level height, inside the camera transform so it scrolls naturally
      let levelH = this.height || 6000;
      imageMode(CORNER);
      image(bgImg, 0, 0, width, levelH);
    } else {
      background(color(this.theme.bg));
    }
    for (const p of this.platforms) {
      p.draw(color(this.theme.platform));
    }
  }
}
