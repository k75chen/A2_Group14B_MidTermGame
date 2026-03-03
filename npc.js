/*
NPC.js

An NPC is a JPEG image that sits on top of a platform.
It has no collision — the player walks right over it.
When the player lands on the same platform, it triggers
a dialogue box and pauses the game.

Each NPC is defined inside a platform entry in the level JSON:
  {
    "x": 300, "y": 2400, "w": 120, "h": 20, "type": "table",
    "npc": {
      "type": "good",
      "dialogue": "Hey, you're doing great."
    }
  }

type "good" → +1 heart when dismissed
type "bad"  → -1 heart when dismissed
*/

class NPC {
  constructor(data, platform) {
    this.type     = data.type     || "good"; // "good" or "bad"
    this.dialogue = data.dialogue || "...";
    this.platform = platform; // reference to the Platform this NPC sits on
    this.triggered = false;   // true once the player has seen this dialogue
  }

  /*
  Draw the NPC image centred above its platform.
  goodImg / badImg are p5 image objects loaded in sketch.js preload().
  If the image file is missing (null), a coloured circle is drawn as a fallback
  so the game still runs while teammates are setting up assets.
  */
  draw(goodImg, badImg) {
    let cx   = this.platform.x + this.platform.w / 2;
    let topY = this.platform.y;
    let size = 44;

    let img = this.type === "good" ? goodImg : badImg;

    imageMode(CENTER);
    if (img) {
      image(img, cx, topY - size / 2, size, size);
    } else {
      // Fallback shape if image asset is not yet added
      noStroke();
      fill(this.type === "good" ? "#7EC8A0" : "#C87E7E");
      ellipse(cx, topY - size / 2, size, size);
      fill(255, 255, 255, 180);
      textSize(20);
      textAlign(CENTER, CENTER);
      text(this.type === "good" ? "?" : "!", cx, topY - size / 2);
    }
    imageMode(CORNER);
  }

  /*
  Returns true when the player is standing on this NPC's platform.
  Uses a small vertical tolerance to catch the frame the player lands.
  */
  isPlayerOn(player) {
    let p = this.platform;
    return (
      player.x > p.x &&
      player.x < p.x + p.w &&
      player.y + player.r >= p.y - 4 &&
      player.y + player.r <= p.y + 12
    );
  }
}
