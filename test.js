"use strict";

const assert = require("assert");
const {
  PLATFORM_VISUALS,
  CustomTypedStringPlugin,
  MorseCourseGenerator,
  canReachPlatform,
  createModeSettings,
  wordsToMorseString,
  wordsToMorseTokens,
  removeSlashTokens,
  hashSeed
} = require("./game.js");

class RepeatingPlugin {
  constructor(words) {
    this.id = "repeating";
    this.label = "Repeating";
    this.words = words;
    this.index = 0;
  }

  reset() {
    this.index = 0;
  }

  getNextWords(context) {
    const count = context && context.count ? context.count : 3;
    const out = [];
    for (let index = 0; index < count; index += 1) {
      out.push(this.words[this.index % this.words.length]);
      this.index += 1;
    }
    return out;
  }
}

function testMorseConversion() {
  assert.strictEqual(wordsToMorseString(["SOS", "ICE"]), "... --- ... / .. -.-. .");
  const tokens = wordsToMorseTokens(["SOS", { text: "ICE", material: "ice" }], { modifiersEnabled: true });
  assert(tokens.some((token) => token.symbol === "/"), "word separator slash should exist before physical filtering");
  const physical = removeSlashTokens(tokens);
  assert(!physical.some((token) => token.symbol === "/"), "slash tokens should be removed from parkour");
  assert(physical.some((token) => token.sourceWord === "ICE" && token.material === "ice"));
}

function testTypedModifierWordsStayNormal() {
  const settings = createModeSettings("custom");
  settings.iceWordChance = 0;
  settings.slimeWordChance = 0;
  settings.lowSlimeChance = 0;
  const generator = new MorseCourseGenerator({
    mode: "custom",
    settings,
    plugin: new CustomTypedStringPlugin("SLIME ICE SLIME"),
    seed: hashSeed("typed-modifier-words-normal")
  });
  generator.generateChunks(12);
  const nonStart = generator.platforms.filter((platform) => platform.symbol !== "start");
  assert(nonStart.length > 0);
  assert(nonStart.every((platform) => platform.material === "normal"), "typed words named slime or ice should not become modifiers");
}

function testInjectedSlimeDoesNotTurnEverythingSlime() {
  const settings = createModeSettings("medium");
  settings.iceWordChance = 0;
  settings.slimeWordChance = 1;
  settings.lowSlimeChance = 0;
  const generator = new MorseCourseGenerator({
    mode: "medium",
    settings,
    plugin: new CustomTypedStringPlugin("E"),
    seed: hashSeed("injected-slime-mixed-materials")
  });
  generator.generateChunks(8);
  const nonStart = generator.platforms.filter((platform) => platform.symbol !== "start");
  assert(nonStart.some((platform) => platform.material === "slime"), "injected slime should still create slime platforms");
  assert(nonStart.some((platform) => platform.material === "normal"), "source words should remain normal after injected slime");
}

function testMaterialVisualsMatch() {
  assert.deepStrictEqual(PLATFORM_VISUALS.normal, PLATFORM_VISUALS.ice);
  assert.deepStrictEqual(PLATFORM_VISUALS.normal, PLATFORM_VISUALS.slime);
}

function testClassicHasNoModifiers() {
  const generator = new MorseCourseGenerator({
    mode: "classic",
    settings: createModeSettings("classic"),
    plugin: new CustomTypedStringPlugin("ICE SLIME ICE SLIME"),
    seed: hashSeed("classic-no-modifiers")
  });
  generator.generateChunks(40);
  const nonStart = generator.platforms.filter((platform) => platform.symbol !== "start");
  assert(nonStart.length > 0);
  assert(nonStart.every((platform) => platform.material === "normal"), "classic materials should stay normal");
  assert(nonStart.every((platform) => !platform.movingBar), "classic should not create moving bars");
  assert(nonStart.every((platform) => platform.main), "classic should not create optional low slime");
}

function testGeneratedJumpsAreReachable() {
  const modes = ["classic", "easy", "medium", "hard", "custom"];
  modes.forEach((mode) => {
    const generator = new MorseCourseGenerator({
      mode,
      settings: createModeSettings(mode),
      plugin: new RepeatingPlugin(["SIGNAL", "ORBIT", "VECTOR", "RADIO", "LAUNCH"]),
      seed: hashSeed(`reachability-${mode}`)
    });
    generator.generateChunks(220);
    for (let index = 1; index < generator.mainPath.length; index += 1) {
      const previous = generator.mainPath[index - 1];
      const next = generator.mainPath[index];
      assert(
        canReachPlatform(previous, next),
        `${mode} generated an unreachable jump at main platform ${index}`
      );
    }
  });
}

function testMovingBarChanceOnDashes() {
  const settings = createModeSettings("medium");
  settings.iceWordChance = 0;
  settings.slimeWordChance = 0;
  const generator = new MorseCourseGenerator({
    mode: "medium",
    settings,
    plugin: new RepeatingPlugin(["T"]),
    seed: hashSeed("moving-bar-stats")
  });
  generator.generateChunks(1800);
  const dashPlatforms = generator.mainPath.filter((platform) => platform.symbol === "-");
  const movingBars = dashPlatforms.filter((platform) => platform.movingBar).length;
  const rate = movingBars / dashPlatforms.length;
  assert(dashPlatforms.length > 5000);
  assert(rate > 0.038 && rate < 0.064, `moving bar rate ${rate} should be close to 1/20`);
}

function testCheckpointsEveryTwentyFiveDashes() {
  const settings = createModeSettings("medium");
  settings.iceWordChance = 0;
  settings.slimeWordChance = 0;
  settings.lowSlimeChance = 0;
  settings.movingBarChance = 0;
  const generator = new MorseCourseGenerator({
    mode: "medium",
    settings,
    plugin: new RepeatingPlugin(["T"]),
    seed: hashSeed("checkpoint-dash-count")
  });
  generator.generateChunks(60);
  assert.strictEqual(generator.mainPath[0].checkpoint, true, "start platform should be the first checkpoint");
  const dashPlatforms = generator.mainPath.filter((platform) => platform.symbol === "-");
  assert(dashPlatforms.length >= 150);
  dashPlatforms.forEach((platform, index) => {
    const dashNumber = index + 1;
    if (dashNumber % 25 === 0) {
      assert.strictEqual(platform.checkpoint, true, `dash ${dashNumber} should be a checkpoint`);
      assert.strictEqual(platform.checkpointNumber, dashNumber / 25);
    } else {
      assert.strictEqual(platform.checkpoint, false, `dash ${dashNumber} should not be a checkpoint`);
      assert.strictEqual(platform.checkpointNumber, null);
    }
  });
}

function testCheckpointPlatformsAreNeutral() {
  const settings = createModeSettings("medium");
  settings.iceWordChance = 0;
  settings.slimeWordChance = 1;
  settings.lowSlimeChance = 0;
  settings.movingBarChance = 0;
  settings.checkpointDashInterval = 1;
  const generator = new MorseCourseGenerator({
    mode: "medium",
    settings,
    plugin: new RepeatingPlugin(["T"]),
    seed: hashSeed("checkpoint-neutral-platforms")
  });
  generator.generateChunks(5);
  const checkpoints = generator.mainPath.filter((platform) => platform.checkpoint && platform.symbol === "-");
  assert(checkpoints.length > 0);
  assert(checkpoints.every((platform) => platform.material === "normal"), "checkpoint platforms should be safe neutral respawn spots");
}

function testLowSlimeChance() {
  const settings = createModeSettings("medium");
  settings.iceWordChance = 0;
  settings.slimeWordChance = 1;
  const generator = new MorseCourseGenerator({
    mode: "medium",
    settings,
    plugin: new RepeatingPlugin(["E"]),
    seed: hashSeed("low-slime-stats")
  });
  generator.generateChunks(900);
  const mainSlime = generator.platforms.filter((platform) => platform.main && platform.material === "slime");
  const lowSlime = generator.platforms.filter((platform) => platform.optional && platform.material === "slime");
  const rate = lowSlime.length / mainSlime.length;
  assert(mainSlime.length > 10000);
  assert(rate > 0.052 && rate < 0.082, `low slime rate ${rate} should be close to 1/15`);
}

function testCustomSettingsAffectFuturePlatformsOnly() {
  const settings = createModeSettings("custom");
  const generator = new MorseCourseGenerator({
    mode: "custom",
    settings,
    plugin: new RepeatingPlugin(["E"]),
    seed: hashSeed("custom-future-only")
  });
  generator.generateChunks(4);
  const oldDots = generator.mainPath.filter((platform) => platform.symbol === ".");
  assert(oldDots.length > 0);
  const oldWidths = oldDots.map((platform) => platform.width);

  generator.updateSettings({ dotWidth: 92 });
  generator.generateChunks(4);

  oldDots.forEach((platform, index) => {
    assert.strictEqual(platform.width, oldWidths[index], "existing platforms should not be rewritten");
  });
  const newDots = generator.mainPath
    .filter((platform) => platform.symbol === ".")
    .slice(oldDots.length);
  assert(newDots.some((platform) => platform.width === 92), "future dots should use new custom width");
}

testMorseConversion();
testTypedModifierWordsStayNormal();
testInjectedSlimeDoesNotTurnEverythingSlime();
testMaterialVisualsMatch();
testClassicHasNoModifiers();
testGeneratedJumpsAreReachable();
testMovingBarChanceOnDashes();
testCheckpointsEveryTwentyFiveDashes();
testCheckpointPlatformsAreNeutral();
testLowSlimeChance();
testCustomSettingsAffectFuturePlatformsOnly();

console.log("All tests passed.");
