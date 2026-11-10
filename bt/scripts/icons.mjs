import sharp from "sharp";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const logo = new URL("assets/bt-mark.svg", root);
for (const [name, size] of [
  ["icon.png", 1024],
  ["favicon.png", 96],
  ["android-icon-foreground.png", 1024],
  ["splash-icon.png", 512],
]) {
  await sharp(fileURLToPath(logo))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`assets/${name}`, root)));
}
console.log("BT 아이콘 생성 완료");
