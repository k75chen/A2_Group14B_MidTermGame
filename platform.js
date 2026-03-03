/*
Platform.js (Example 5)

A Platform is a single axis-aligned rectangle in the world.

Why a class for something "simple"?
- It standardizes the shape of platform data.
- It makes later upgrades easy (e.g., moving platforms, icy platforms, spikes).
- It keeps drawing code in the object that knows what it is.

In JSON, platforms are stored like:
{ "x": 0, "y": 324, "w": 640, "h": 36 } 
*/

class Platform {
  constructor({ x, y, w, h, type }) {
    // Position is the top-left corner.
    this.x = x;
    this.y = y;

    // Size (width/height).
    this.w = w;
    this.h = h;

    // Semantic type used for drawing.
    this.type = type || "default";
  }

  draw(fillColor) {
    if (this.type === "checkpoint") return; // never draw checkpoints

    noStroke();
    switch (this.type) {
      case "bed":
        fill("#F4A58A");
        rect(this.x, this.y, this.w, this.h);
        fill("#E8907A");
        rect(this.x + 6, this.y - 8, this.w * 0.3, 10); // left pillow
        rect(this.x + this.w * 0.6, this.y - 8, this.w * 0.3, 10); // right pillow
        break;
      case "table":
        fill("#8B5E3C");
        rect(this.x, this.y, this.w, this.h);
        fill("#6B4423");
        rect(this.x + 8, this.y + this.h, 10, 14); // left leg
        rect(this.x + this.w - 18, this.y + this.h, 10, 14); // right leg
        break;
      case "piano":
        fill("#2C2C2C");
        rect(this.x, this.y, this.w, this.h);
        fill("#FFFFFF");
        stroke("#AAAAAA");
        strokeWeight(1);
        let keyW = this.w / 9;
        for (let k = 0; k < 8; k++) {
          rect(this.x + k * keyW + 2, this.y, keyW - 2, this.h * 0.8);
        }
        noStroke();
        break;
      case "couch":
        fill("#C4876B");
        rect(this.x, this.y, this.w, this.h);
        fill("#B07558");
        rect(this.x, this.y - 10, 16, this.h + 10); // left arm
        rect(this.x + this.w - 16, this.y - 10, 16, this.h + 10); // right arm
        break;
      case "chair":
        fill("#C9956C");
        rect(this.x, this.y, this.w, this.h);
        break;
      case "bathtub":
        fill("#A8D8EA");
        rect(this.x, this.y, this.w, this.h);
        fill("#8EC8DA");
        arc(this.x + 20, this.y + this.h / 2, 28, 28, PI / 2, PI * 1.5); // faucet end
        break;
      case "beanbag":
        fill("#9B89B5");
        ellipse(this.x + this.w / 2, this.y + this.h / 2, this.w, this.h * 3);
        break;
      case "tv":
        fill("#3A3A3A");
        rect(this.x, this.y, this.w, this.h);
        fill("#111111");
        rect(this.x + 6, this.y + 3, this.w - 12, this.h - 6); // screen
        break;
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
      default:
        fill(fillColor);
        rect(this.x, this.y, this.w, this.h);
    }
  }
}
