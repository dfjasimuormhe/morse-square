(function initMorseSquare(root) {
  "use strict";

  const hasDom = typeof window !== "undefined" && typeof document !== "undefined";

  const MORSE_CODE = Object.freeze({
    A: ".-",
    B: "-...",
    C: "-.-.",
    D: "-..",
    E: ".",
    F: "..-.",
    G: "--.",
    H: "....",
    I: "..",
    J: ".---",
    K: "-.-",
    L: ".-..",
    M: "--",
    N: "-.",
    O: "---",
    P: ".--.",
    Q: "--.-",
    R: ".-.",
    S: "...",
    T: "-",
    U: "..-",
    V: "...-",
    W: ".--",
    X: "-..-",
    Y: "-.--",
    Z: "--..",
    0: "-----",
    1: ".----",
    2: "..---",
    3: "...--",
    4: "....-",
    5: ".....",
    6: "-....",
    7: "--...",
    8: "---..",
    9: "----."
  });

  const WORD_BANK = Object.freeze([
    "STAR",
    "ORBIT",
    "NOVA",
    "COMET",
    "LUNAR",
    "SOLAR",
    "PULSE",
    "RADIO",
    "SIGNAL",
    "ROCKET",
    "COSMOS",
    "ASTRO",
    "BEACON",
    "VECTOR",
    "GALAXY",
    "METEOR",
    "DRIFT",
    "ZENITH",
    "APOLLO",
    "SATURN",
    "ION",
    "QUASAR",
    "PHOTON",
    "NEBULA",
    "ECLIPSE",
    "VOYAGE",
    "MODULE",
    "DOCK",
    "LAUNCH",
    "THRUST"
  ]);

  const MATERIAL_WORDS = Object.freeze({
    ICE: "ice",
    SLIME: "slime"
  });

  const PLATFORM_VISUALS = Object.freeze({
    normal: Object.freeze({ fill: "#e7eef8", stroke: "#92c8e6", shine: "#ffffff" }),
    ice: Object.freeze({ fill: "#e7eef8", stroke: "#92c8e6", shine: "#ffffff" }),
    slime: Object.freeze({ fill: "#e7eef8", stroke: "#92c8e6", shine: "#ffffff" })
  });

  const PHYSICS = Object.freeze({
    fixedDt: 1 / 120,
    playerSize: 28,
    gravity: 2200,
    maxFall: 1120,
    maxSpeed: 330,
    iceMaxSpeed: 390,
    slimeMaxSpeed: 275,
    groundAcceleration: 2600,
    iceAcceleration: 820,
    slimeAcceleration: 1800,
    airAcceleration: 1320,
    groundFriction: 2500,
    iceFriction: 210,
    slimeFriction: 4300,
    airDrag: 42,
    jumpVelocity: 690,
    slimeBounceVelocity: 610,
    jumpCutMultiplier: 0.45,
    coyoteTime: 0.09,
    jumpBuffer: 0.12,
    maxAirJumps: 1
  });

  const DEFAULT_SETTINGS = Object.freeze({
    chunkWords: 3,
    dotWidth: 58,
    dashWidth: 132,
    platformHeight: 18,
    startX: 0,
    startY: 430,
    minY: 190,
    maxY: 610,
    gapRanges: Object.freeze({
      easy: Object.freeze({ min: 44, max: 96 }),
      medium: Object.freeze({ min: 74, max: 134 }),
      hard: Object.freeze({ min: 108, max: 184 })
    }),
    yJitter: Object.freeze({
      easy: 22,
      medium: 42,
      hard: 62
    }),
    difficultyWeights: Object.freeze({
      easy: 0.6,
      medium: 0.35,
      hard: 0.05
    }),
    iceWordChance: 0.08,
    slimeWordChance: 0.08,
    movingBarChance: 1 / 20,
    lowSlimeChance: 1 / 15,
    lowSlimeDrop: 112,
    barWidth: 14,
    barHeight: 92,
    barAmplitude: 38,
    barSpeedMin: 1.1,
    barSpeedMax: 1.9
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function approach(value, target, step) {
    if (value < target) {
      return Math.min(target, value + step);
    }
    if (value > target) {
      return Math.max(target, value - step);
    }
    return target;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeSettings(base, patch) {
    const output = deepClone(base);
    if (!patch) {
      return output;
    }
    Object.keys(patch).forEach((key) => {
      const value = patch[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        output[key] = mergeSettings(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function hashSeed(text) {
    const input = String(text || "morse-square");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  class RNG {
    constructor(seed) {
      this.state = (seed >>> 0) || 0x6d2b79f5;
    }

    next() {
      let t = (this.state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    chance(probability) {
      return this.next() < clamp(probability || 0, 0, 1);
    }

    range(min, max) {
      return min + (max - min) * this.next();
    }

    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    }

    pick(items) {
      return items[Math.floor(this.next() * items.length) % items.length];
    }
  }

  function createModeSettings(mode) {
    const base = deepClone(DEFAULT_SETTINGS);
    if (mode === "classic") {
      return mergeSettings(base, {
        iceWordChance: 0,
        slimeWordChance: 0,
        movingBarChance: 0,
        lowSlimeChance: 0
      });
    }
    if (mode === "easy") {
      return mergeSettings(base, {
        iceWordChance: 0.03,
        slimeWordChance: 0.03,
        movingBarChance: 0.015,
        lowSlimeChance: 0.015,
        gapRanges: {
          easy: { min: 40, max: 84 },
          medium: { min: 64, max: 116 },
          hard: { min: 94, max: 152 }
        },
        yJitter: { easy: 16, medium: 28, hard: 46 },
        difficultyWeights: { easy: 0.78, medium: 0.2, hard: 0.02 }
      });
    }
    if (mode === "hard") {
      return mergeSettings(base, {
        iceWordChance: 0.16,
        slimeWordChance: 0.16,
        movingBarChance: 0.12,
        lowSlimeChance: 0.12,
        gapRanges: {
          easy: { min: 58, max: 110 },
          medium: { min: 92, max: 158 },
          hard: { min: 136, max: 220 }
        },
        yJitter: { easy: 30, medium: 52, hard: 76 },
        difficultyWeights: { easy: 0.45, medium: 0.4, hard: 0.15 }
      });
    }
    return base;
  }

  function fitSettingsToViewport(settings, height) {
    const fitted = deepClone(settings);
    fitted.startY = clamp(Math.round(height * 0.62), 300, Math.max(330, height - 140));
    fitted.minY = clamp(Math.round(height * 0.24), 130, fitted.startY - 120);
    fitted.maxY = clamp(Math.round(height * 0.76), fitted.startY + 90, Math.max(fitted.startY + 120, height - 84));
    return fitted;
  }

  function normalizeWords(text) {
    const words = String(text || "")
      .toUpperCase()
      .match(/[A-Z0-9]+/g);
    if (!words || words.length === 0) {
      return [];
    }
    return words.slice(0, 120);
  }

  class RandomWordsPlugin {
    constructor() {
      this.id = "randomWords";
      this.label = "Random words";
      this.rng = new RNG(1);
    }

    reset(seed) {
      this.rng = new RNG((seed ^ 0x9e3779b9) >>> 0);
    }

    getNextWords(context) {
      const count = context && context.count ? context.count : 3;
      const words = [];
      for (let index = 0; index < count; index += 1) {
        words.push(this.rng.pick(WORD_BANK));
      }
      return words;
    }
  }

  class CustomTypedStringPlugin {
    constructor(text) {
      this.id = "customTypedString";
      this.label = "Typed words";
      this.setText(text);
    }

    setText(text) {
      this.words = normalizeWords(text);
      if (this.words.length === 0) {
        this.words = ["MORSE", "SQUARE"];
      }
      this.index = 0;
    }

    reset() {
      this.index = 0;
    }

    getNextWords(context) {
      const count = context && context.count ? context.count : 3;
      const words = [];
      for (let step = 0; step < count; step += 1) {
        words.push(this.words[this.index % this.words.length]);
        this.index += 1;
      }
      return words;
    }
  }

  function createPluginFromText(text) {
    if (normalizeWords(text).length > 0) {
      return new CustomTypedStringPlugin(text);
    }
    return new RandomWordsPlugin();
  }

  function wordsToMorseString(words) {
    return normalizeWords(words.join ? words.join(" ") : words)
      .map((word) =>
        word
          .split("")
          .map((letter) => MORSE_CODE[letter])
          .filter(Boolean)
          .join(" ")
      )
      .filter(Boolean)
      .join(" / ");
  }

  function wordsToMorseTokens(words, options) {
    const normalized = Array.isArray(words) ? words.map(String) : normalizeWords(words);
    const modifiersEnabled = !options || options.modifiersEnabled !== false;
    const tokens = [];
    normalized.forEach((rawWord, wordIndex) => {
      const word = rawWord.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!word) {
        return;
      }
      if (wordIndex > 0) {
        tokens.push({
          symbol: "/",
          sourceWord: word,
          sourceLetter: " ",
          material: "normal"
        });
      }
      const material = modifiersEnabled && MATERIAL_WORDS[word] ? MATERIAL_WORDS[word] : "normal";
      word.split("").forEach((letter) => {
        const code = MORSE_CODE[letter];
        if (!code) {
          return;
        }
        code.split("").forEach((symbol) => {
          tokens.push({
            symbol,
            sourceWord: word,
            sourceLetter: letter,
            material
          });
        });
      });
    });
    return tokens;
  }

  function removeSlashTokens(tokens) {
    return tokens.filter((token) => token.symbol === "." || token.symbol === "-");
  }

  function chooseDifficulty(rng, weights) {
    const easy = Math.max(0, Number(weights.easy) || 0);
    const medium = Math.max(0, Number(weights.medium) || 0);
    const hard = Math.max(0, Number(weights.hard) || 0);
    const total = easy + medium + hard || 1;
    const roll = rng.next() * total;
    if (roll < easy) {
      return "easy";
    }
    if (roll < easy + medium) {
      return "medium";
    }
    return "hard";
  }

  function canReachPlatform(previous, next, physics) {
    const constants = physics || PHYSICS;
    const size = constants.playerSize;
    const dt = 1 / 120;
    const maxSteps = Math.ceil(2.2 / dt);
    const margin = Math.min(12, Math.max(6, next.width * 0.12));
    const landingLeft = next.x + margin;
    const landingRight = next.x + next.width - margin;

    if (landingRight <= landingLeft) {
      return false;
    }

    const speedOptions = [constants.maxSpeed, constants.maxSpeed * 0.82, constants.maxSpeed * 0.62];
    const jumpOptions = [
      constants.jumpVelocity,
      constants.jumpVelocity * 0.76,
      constants.jumpVelocity * 0.56,
      constants.jumpVelocity * 0.36,
      0
    ];

    for (let speedIndex = 0; speedIndex < speedOptions.length; speedIndex += 1) {
      for (let jumpIndex = 0; jumpIndex < jumpOptions.length; jumpIndex += 1) {
        const actor = {
          x: previous.x + previous.width - size - 1,
          y: previous.y - size,
          vx: speedOptions[speedIndex],
          vy: -jumpOptions[jumpIndex]
        };

        let priorBottom = actor.y + size;
        for (let step = 0; step < maxSteps; step += 1) {
          actor.vx = approach(actor.vx, constants.maxSpeed, constants.airAcceleration * dt);
          actor.vy = Math.min(constants.maxFall, actor.vy + constants.gravity * dt);

          actor.x += actor.vx * dt;
          actor.y += actor.vy * dt;

          const bottom = actor.y + size;
          const overlapsLanding =
            actor.x + size > landingLeft &&
            actor.x < landingRight &&
            priorBottom <= next.y + 8 &&
            bottom >= next.y &&
            actor.vy >= 0;

          if (overlapsLanding) {
            return true;
          }

          if (actor.x > next.x + next.width + 260 || actor.y > next.y + 620) {
            break;
          }
          priorBottom = bottom;
        }
      }
    }
    return false;
  }

  class MorseCourseGenerator {
    constructor(options) {
      const params = options || {};
      this.mode = params.mode || "medium";
      this.settings = deepClone(params.settings || createModeSettings(this.mode));
      this.seed = params.seed >>> 0;
      this.rng = new RNG(this.seed);
      this.plugin = params.plugin || new RandomWordsPlugin();
      this.plugin.reset(this.seed);
      this.platforms = [];
      this.mainPath = [];
      this.generatedEdge = 0;
      this.chunkIndex = 0;
      this.nextPlatformId = 1;
      this.reset();
    }

    reset() {
      this.platforms.length = 0;
      this.mainPath.length = 0;
      this.generatedEdge = 0;
      this.chunkIndex = 0;
      this.nextPlatformId = 1;
      this.rng = new RNG(this.seed);
      this.plugin.reset(this.seed);

      const start = {
        id: this.nextPlatformId,
        x: this.settings.startX,
        y: this.settings.startY,
        width: 260,
        height: this.settings.platformHeight,
        material: "normal",
        symbol: "start",
        sourceWord: "START",
        sourceLetter: "",
        movingBar: null,
        optional: false,
        main: true,
        difficulty: "easy"
      };
      this.nextPlatformId += 1;
      this.platforms.push(start);
      this.mainPath.push(start);
      this.lastMain = start;
      this.generatedEdge = start.x + start.width;
    }

    updateSettings(settings) {
      this.settings = mergeSettings(this.settings, settings);
    }

    setPlugin(plugin) {
      this.plugin = plugin;
      this.plugin.reset((this.seed ^ this.chunkIndex ^ 0xa5a5a5a5) >>> 0);
    }

    generateUntil(worldRight) {
      while (this.generatedEdge < worldRight) {
        this.generateChunk();
      }
      return this.platforms;
    }

    generateChunks(count) {
      for (let index = 0; index < count; index += 1) {
        this.generateChunk();
      }
      return this.platforms;
    }

    generateChunk() {
      const count = Math.max(1, Math.round(this.settings.chunkWords));
      const words = this.plugin.getNextWords({
        chunkIndex: this.chunkIndex,
        mode: this.mode,
        count
      });
      const injected = this.injectModifierWords(words);
      const modifiersEnabled = this.mode !== "classic";
      const tokens = removeSlashTokens(wordsToMorseTokens(injected, { modifiersEnabled }));
      const physicalTokens = tokens.length > 0
        ? tokens
        : removeSlashTokens(wordsToMorseTokens(["SOS"], { modifiersEnabled }));

      physicalTokens.forEach((token) => {
        this.addTokenPlatform(token);
      });
      this.chunkIndex += 1;
    }

    injectModifierWords(words) {
      if (this.mode === "classic") {
        return words;
      }
      const output = [];
      words.forEach((word) => {
        if (this.rng.chance(this.settings.iceWordChance)) {
          output.push("ICE");
        }
        if (this.rng.chance(this.settings.slimeWordChance)) {
          output.push("SLIME");
        }
        output.push(word);
      });
      return output;
    }

    addTokenPlatform(token) {
      const previous = this.lastMain;
      const difficulty = chooseDifficulty(this.rng, this.settings.difficultyWeights);
      const range = this.settings.gapRanges[difficulty];
      const jitter = this.settings.yJitter[difficulty];
      let gap = this.rng.range(range.min, range.max);
      let y = clamp(
        previous.y + this.rng.range(-jitter, jitter),
        this.settings.minY,
        this.settings.maxY
      );
      const width = token.symbol === "-" ? this.settings.dashWidth : this.settings.dotWidth;
      const platform = {
        id: this.nextPlatformId,
        x: previous.x + previous.width + gap,
        y,
        width,
        height: this.settings.platformHeight,
        material: token.material,
        symbol: token.symbol,
        sourceWord: token.sourceWord,
        sourceLetter: token.sourceLetter,
        movingBar: null,
        optional: false,
        main: true,
        difficulty
      };
      this.nextPlatformId += 1;

      this.adjustReachability(previous, platform);

      if (token.symbol === "-" && this.rng.chance(this.settings.movingBarChance)) {
        platform.movingBar = {
          amplitude: this.settings.barAmplitude,
          speed: this.rng.range(this.settings.barSpeedMin, this.settings.barSpeedMax),
          phase: this.rng.range(0, Math.PI * 2)
        };
      }

      this.platforms.push(platform);
      this.mainPath.push(platform);
      this.lastMain = platform;
      this.generatedEdge = Math.max(this.generatedEdge, platform.x + platform.width);

      if (platform.material === "slime" && this.rng.chance(this.settings.lowSlimeChance)) {
        this.addLowSlime(platform);
      }
    }

    adjustReachability(previous, platform) {
      let gap = platform.x - (previous.x + previous.width);
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (canReachPlatform(previous, platform, PHYSICS)) {
          return true;
        }
        gap = Math.max(24, gap - 16);
        platform.x = previous.x + previous.width + gap;
      }

      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (canReachPlatform(previous, platform, PHYSICS)) {
          return true;
        }
        platform.y = clamp(platform.y + 12, this.settings.minY, this.settings.maxY);
      }

      platform.x = previous.x + previous.width + 32;
      platform.y = clamp(previous.y + 10, this.settings.minY, this.settings.maxY);
      return canReachPlatform(previous, platform, PHYSICS);
    }

    addLowSlime(parent) {
      const width = Math.max(this.settings.dotWidth, parent.width * 0.74);
      const optional = {
        id: this.nextPlatformId,
        x: parent.x + parent.width * 0.12,
        y: clamp(parent.y + this.settings.lowSlimeDrop, this.settings.minY, this.settings.maxY + 170),
        width,
        height: this.settings.platformHeight,
        material: "slime",
        symbol: parent.symbol,
        sourceWord: "SLIME",
        sourceLetter: parent.sourceLetter,
        movingBar: null,
        optional: true,
        main: false,
        difficulty: parent.difficulty
      };
      this.nextPlatformId += 1;
      this.platforms.push(optional);
      this.generatedEdge = Math.max(this.generatedEdge, optional.x + optional.width);
    }

    pruneBefore(worldLeft) {
      const keepBehind = Math.max(0, worldLeft);
      this.platforms = this.platforms.filter((platform) => platform.x + platform.width > keepBehind);
      this.mainPath = this.mainPath.filter((platform) => platform.x + platform.width > keepBehind);
    }
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function getBarRect(platform, time, settings) {
    if (!platform.movingBar) {
      return null;
    }
    const bar = platform.movingBar;
    const offset = Math.sin(time * bar.speed + bar.phase) * bar.amplitude;
    return {
      x: platform.x + platform.width * 0.55 - settings.barWidth * 0.5,
      y: platform.y - settings.barHeight - 18 + offset,
      width: settings.barWidth,
      height: settings.barHeight,
      kind: "bar",
      material: "normal",
      platform
    };
  }

  class InputController {
    constructor() {
      this.keys = new Set();
      this.jumpPressed = false;
      this.jumpReleased = false;
      window.addEventListener("keydown", (event) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW"].includes(event.code)) {
          event.preventDefault();
        }
        if (!this.keys.has(event.code) && ["ArrowUp", "Space", "KeyW"].includes(event.code)) {
          this.jumpPressed = true;
        }
        this.keys.add(event.code);
      });
      window.addEventListener("keyup", (event) => {
        if (["ArrowUp", "Space", "KeyW"].includes(event.code)) {
          this.jumpReleased = true;
        }
        this.keys.delete(event.code);
      });
      window.addEventListener("blur", () => {
        this.keys.clear();
        this.jumpPressed = false;
        this.jumpReleased = false;
      });
    }

    axis() {
      const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
      const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
      return (right ? 1 : 0) - (left ? 1 : 0);
    }

    consumeJumpPressed() {
      const value = this.jumpPressed;
      this.jumpPressed = false;
      return value;
    }

    consumeJumpReleased() {
      const value = this.jumpReleased;
      this.jumpReleased = false;
      return value;
    }
  }

  class MorseSquareGame {
    constructor(canvas, dom) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dom = dom;
      this.input = new InputController();
      this.state = "title";
      this.mode = "medium";
      this.seed = 0;
      this.time = 0;
      this.accumulator = 0;
      this.lastFrame = 0;
      this.camera = { x: 0, y: 0 };
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.stars = [];
      this.player = null;
      this.generator = null;
      this.lastSafe = { x: 80, y: 320 };
      this.activeRun = null;
      this.resize = this.resize.bind(this);
      this.loop = this.loop.bind(this);
      window.addEventListener("resize", this.resize);
      this.resize();
      requestAnimationFrame(this.loop);
    }

    resize() {
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.buildStars();
    }

    buildStars() {
      const rng = new RNG(hashSeed(`stars-${this.width}-${this.height}`));
      const count = clamp(Math.round((this.width * this.height) / 3400), 130, 420);
      this.stars = [];
      for (let index = 0; index < count; index += 1) {
        this.stars.push({
          x: rng.range(0, this.width + 420),
          y: rng.range(0, this.height),
          size: rng.range(0.7, 2.2),
          depth: rng.range(0.08, 0.48),
          tint: rng.pick(["#ffffff", "#83f0d0", "#ffc35c", "#9cb7ff"])
        });
      }
    }

    start(mode, rawSettings, plugin, seed) {
      this.mode = mode;
      this.seed = seed >>> 0;
      this.time = 0;
      this.accumulator = 0;
      this.camera = { x: 0, y: 0 };
      const fittedSettings = fitSettingsToViewport(rawSettings, this.height);
      this.activeRun = {
        mode,
        settings: deepClone(fittedSettings),
        plugin,
        seed: this.seed
      };
      this.generator = new MorseCourseGenerator({
        mode,
        settings: fittedSettings,
        plugin,
        seed: this.seed
      });
      this.generator.generateUntil(this.width * 1.9);
      const startPlatform = this.generator.mainPath[0];
      this.player = {
        x: startPlatform.x + 64,
        y: startPlatform.y - PHYSICS.playerSize,
        prevX: startPlatform.x + 64,
        prevY: startPlatform.y - PHYSICS.playerSize,
        vx: 0,
        vy: 0,
        grounded: false,
        groundMaterial: "normal",
        coyote: 0,
        jumpBuffer: 0,
        airJumpsRemaining: PHYSICS.maxAirJumps,
        slimeCooldown: 0
      };
      this.lastSafe = { x: this.player.x, y: this.player.y };
      this.state = "playing";
      this.updateHud();
    }

    applyCustomSettings(settings) {
      if (this.generator && this.mode === "custom") {
        const fittedSettings = fitSettingsToViewport(settings, this.height);
        this.generator.updateSettings(fittedSettings);
        if (this.activeRun) {
          this.activeRun.settings = mergeSettings(this.activeRun.settings, fittedSettings);
        }
      }
    }

    setCustomWords(text) {
      if (this.generator && this.mode === "custom") {
        const plugin = createPluginFromText(text);
        this.generator.setPlugin(plugin);
        if (this.activeRun) {
          this.activeRun.plugin = plugin;
        }
      }
    }

    showTitle() {
      this.state = "title";
    }

    loop(timestamp) {
      if (!this.lastFrame) {
        this.lastFrame = timestamp;
      }
      const frameDt = Math.min(0.05, (timestamp - this.lastFrame) / 1000);
      this.lastFrame = timestamp;

      if (this.state === "playing") {
        this.accumulator += frameDt;
        while (this.accumulator >= PHYSICS.fixedDt) {
          this.update(PHYSICS.fixedDt);
          this.accumulator -= PHYSICS.fixedDt;
        }
      }

      this.render();
      requestAnimationFrame(this.loop);
    }

    update(dt) {
      this.time += dt;
      const targetGenerationEdge = this.camera.x + this.width * 1.25;
      this.generator.generateUntil(targetGenerationEdge);
      this.updatePlayer(dt);
      this.updateCamera(dt);
      this.generator.pruneBefore(this.camera.x - 1200);
      this.updateHud();
    }

    updatePlayer(dt) {
      const player = this.player;
      const size = PHYSICS.playerSize;
      player.prevX = player.x;
      player.prevY = player.y;

      if (player.slimeCooldown > 0) {
        player.slimeCooldown -= dt;
      }

      if (this.input.consumeJumpPressed()) {
        player.jumpBuffer = PHYSICS.jumpBuffer;
      } else {
        player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
      }

      if (player.grounded) {
        player.coyote = PHYSICS.coyoteTime;
        player.airJumpsRemaining = PHYSICS.maxAirJumps;
      } else {
        player.coyote = Math.max(0, player.coyote - dt);
      }

      const axis = this.input.axis();
      const material = player.grounded ? player.groundMaterial : "normal";
      const maxSpeed = material === "ice"
        ? PHYSICS.iceMaxSpeed
        : material === "slime"
          ? PHYSICS.slimeMaxSpeed
          : PHYSICS.maxSpeed;
      const acceleration = player.grounded
        ? material === "ice"
          ? PHYSICS.iceAcceleration
          : material === "slime"
            ? PHYSICS.slimeAcceleration
            : PHYSICS.groundAcceleration
        : PHYSICS.airAcceleration;

      if (axis !== 0) {
        player.vx += axis * acceleration * dt;
        player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
      } else if (player.grounded) {
        const friction = material === "ice"
          ? PHYSICS.iceFriction
          : material === "slime"
            ? PHYSICS.slimeFriction
            : PHYSICS.groundFriction;
        player.vx = approach(player.vx, 0, friction * dt);
      } else {
        player.vx = approach(player.vx, 0, PHYSICS.airDrag * dt);
      }

      if (player.jumpBuffer > 0 && player.coyote > 0) {
        player.vy = -PHYSICS.jumpVelocity;
        player.grounded = false;
        player.coyote = 0;
        player.jumpBuffer = 0;
      } else if (player.jumpBuffer > 0 && player.airJumpsRemaining > 0) {
        player.vy = -PHYSICS.jumpVelocity;
        player.grounded = false;
        player.coyote = 0;
        player.jumpBuffer = 0;
        player.airJumpsRemaining -= 1;
      }

      if (this.input.consumeJumpReleased() && player.vy < 0) {
        player.vy *= PHYSICS.jumpCutMultiplier;
      }

      player.vy = Math.min(PHYSICS.maxFall, player.vy + PHYSICS.gravity * dt);

      player.x += player.vx * dt;
      this.resolveHorizontalCollisions();

      const previousBottom = player.y + size;
      player.y += player.vy * dt;
      player.grounded = false;
      player.groundMaterial = "normal";
      this.resolveVerticalCollisions(previousBottom);

      const deathFloor = this.generator.settings.maxY + Math.max(180, this.height * 0.35);
      if (player.y > deathFloor) {
        this.resetCurrentRun();
      }
    }

    getSolidsNearPlayer() {
      const player = this.player;
      const solids = [];
      const left = player.x - 120;
      const right = player.x + PHYSICS.playerSize + 120;
      const top = player.y - 180;
      const bottom = player.y + PHYSICS.playerSize + 220;
      this.generator.platforms.forEach((platform) => {
        if (
          platform.x + platform.width >= left &&
          platform.x <= right &&
          platform.y + platform.height >= top &&
          platform.y <= bottom
        ) {
          solids.push({
            x: platform.x,
            y: platform.y,
            width: platform.width,
            height: platform.height,
            kind: "platform",
            material: platform.material,
            platform
          });
        }
        const bar = getBarRect(platform, this.time, this.generator.settings);
        if (
          bar &&
          bar.x + bar.width >= left &&
          bar.x <= right &&
          bar.y + bar.height >= top &&
          bar.y <= bottom
        ) {
          solids.push(bar);
        }
      });
      return solids;
    }

    resolveHorizontalCollisions() {
      const player = this.player;
      const size = PHYSICS.playerSize;
      const actor = { x: player.x, y: player.y, width: size, height: size };
      this.getSolidsNearPlayer().forEach((solid) => {
        if (!rectsOverlap(actor, solid)) {
          return;
        }
        if (player.vx > 0) {
          player.x = solid.x - size;
        } else if (player.vx < 0) {
          player.x = solid.x + solid.width;
        }
        player.vx = 0;
        actor.x = player.x;
      });
    }

    resolveVerticalCollisions(previousBottom) {
      const player = this.player;
      const size = PHYSICS.playerSize;
      const actor = { x: player.x, y: player.y, width: size, height: size };
      this.getSolidsNearPlayer().forEach((solid) => {
        if (!rectsOverlap(actor, solid)) {
          return;
        }
        if (player.vy >= 0 && previousBottom <= solid.y + 8) {
          player.y = solid.y - size;
          actor.y = player.y;
          if (solid.kind === "platform") {
            this.lastSafe = { x: player.x, y: player.y };
            player.airJumpsRemaining = PHYSICS.maxAirJumps;
            if (solid.material === "slime" && player.slimeCooldown <= 0) {
              player.vx *= 0.58;
              player.vy = -PHYSICS.slimeBounceVelocity;
              player.grounded = false;
              player.groundMaterial = "normal";
              player.slimeCooldown = 0.18;
              return;
            }
            player.grounded = true;
            player.groundMaterial = solid.material;
          } else {
            player.grounded = true;
            player.groundMaterial = "normal";
          }
          player.vy = 0;
        } else if (player.vy < 0) {
          player.y = solid.y + solid.height;
          actor.y = player.y;
          player.vy = 0;
        }
      });
    }

    updateCamera(dt) {
      const player = this.player;
      const targetX = Math.max(0, player.x - this.width * 0.34 + player.vx * 0.18);
      const targetY = player.y - this.height * 0.52;
      const followX = 1 - Math.exp(-dt * 4.4);
      const followY = 1 - Math.exp(-dt * 2.5);
      this.camera.x = lerp(this.camera.x, targetX, followX);
      this.camera.y = lerp(this.camera.y, targetY, followY);
    }

    respawn() {
      this.player.x = this.lastSafe.x;
      this.player.y = this.lastSafe.y;
      this.player.prevX = this.player.x;
      this.player.prevY = this.player.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.grounded = false;
      this.player.coyote = 0;
      this.player.jumpBuffer = 0;
      this.player.airJumpsRemaining = PHYSICS.maxAirJumps;
    }

    resetCurrentRun() {
      if (!this.activeRun) {
        this.respawn();
        return;
      }

      this.time = 0;
      this.accumulator = 0;
      this.camera = { x: 0, y: 0 };
      this.generator = new MorseCourseGenerator({
        mode: this.activeRun.mode,
        settings: fitSettingsToViewport(this.activeRun.settings, this.height),
        plugin: this.activeRun.plugin,
        seed: this.activeRun.seed
      });
      this.generator.generateUntil(this.width * 1.9);

      const startPlatform = this.generator.mainPath[0];
      this.player.x = startPlatform.x + 64;
      this.player.y = startPlatform.y - PHYSICS.playerSize;
      this.player.prevX = this.player.x;
      this.player.prevY = this.player.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.grounded = false;
      this.player.groundMaterial = "normal";
      this.player.coyote = 0;
      this.player.jumpBuffer = 0;
      this.player.airJumpsRemaining = PHYSICS.maxAirJumps;
      this.player.slimeCooldown = 0;
      this.lastSafe = { x: this.player.x, y: this.player.y };
    }

    updateHud() {
      if (!this.dom || !this.dom.hudMode) {
        return;
      }
      this.dom.hudMode.textContent = this.mode.toUpperCase();
      this.dom.hudDistance.textContent = `${Math.max(0, Math.floor(this.player.x / 10))} M`;
    }

    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawBackground(ctx);
      if (this.generator) {
        this.drawWorld(ctx);
      }
      if (this.player) {
        this.drawPlayer(ctx);
      }
    }

    drawBackground(ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "#060913");
      gradient.addColorStop(0.55, "#101b34");
      gradient.addColorStop(1, "#050711");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = "#6d79ff";
      for (let band = -2; band < 5; band += 1) {
        const y = ((band * 220 - this.camera.y * 0.03) % (this.height + 260)) - 120;
        ctx.beginPath();
        ctx.moveTo(0, y + 80);
        ctx.bezierCurveTo(this.width * 0.28, y, this.width * 0.68, y + 160, this.width, y + 48);
        ctx.lineTo(this.width, y + 118);
        ctx.bezierCurveTo(this.width * 0.66, y + 218, this.width * 0.2, y + 78, 0, y + 160);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      this.stars.forEach((star) => {
        const wrappedWidth = this.width + 420;
        let x = (star.x - this.camera.x * star.depth) % wrappedWidth;
        if (x < -20) {
          x += wrappedWidth;
        }
        let y = (star.y - this.camera.y * star.depth * 0.18) % this.height;
        if (y < 0) {
          y += this.height;
        }
        ctx.fillStyle = star.tint;
        ctx.globalAlpha = 0.45 + star.depth;
        ctx.fillRect(x, y, star.size, star.size);
      });
      ctx.globalAlpha = 1;
    }

    drawWorld(ctx) {
      const left = this.camera.x - 80;
      const right = this.camera.x + this.width + 80;
      const top = this.camera.y - 160;
      const bottom = this.camera.y + this.height + 220;

      this.generator.platforms.forEach((platform) => {
        if (
          platform.x + platform.width < left ||
          platform.x > right ||
          platform.y + platform.height < top ||
          platform.y > bottom
        ) {
          return;
        }
        this.drawPlatform(ctx, platform);
      });

      this.generator.platforms.forEach((platform) => {
        const bar = getBarRect(platform, this.time, this.generator.settings);
        if (!bar) {
          return;
        }
        if (bar.x + bar.width < left || bar.x > right || bar.y + bar.height < top || bar.y > bottom) {
          return;
        }
        this.drawMovingBar(ctx, bar);
      });
    }

    drawPlatform(ctx, platform) {
      const visual = PLATFORM_VISUALS[platform.material] || PLATFORM_VISUALS.normal;
      const x = Math.round(platform.x - this.camera.x);
      const y = Math.round(platform.y - this.camera.y);
      const width = Math.round(platform.width);
      const height = Math.round(platform.height);

      ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
      roundedRect(ctx, x + 5, y + 7, width, height, 4);
      ctx.fill();

      ctx.fillStyle = visual.fill;
      roundedRect(ctx, x, y, width, height, 4);
      ctx.fill();
      ctx.strokeStyle = visual.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.globalAlpha = 0.5;
      ctx.fillStyle = visual.shine;
      roundedRect(ctx, x + 5, y + 4, Math.max(0, width - 10), 3, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    drawMovingBar(ctx, bar) {
      const x = Math.round(bar.x - this.camera.x);
      const y = Math.round(bar.y - this.camera.y);
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      roundedRect(ctx, x + 4, y + 4, bar.width, bar.height, 5);
      ctx.fill();
      ctx.fillStyle = "#ffc35c";
      roundedRect(ctx, x, y, bar.width, bar.height, 5);
      ctx.fill();
      ctx.strokeStyle = "#fff2c1";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawPlayer(ctx) {
      const size = PHYSICS.playerSize;
      const x = Math.round(this.player.x - this.camera.x);
      const y = Math.round(this.player.y - this.camera.y);
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      roundedRect(ctx, x + 5, y + 6, size, size, 5);
      ctx.fill();
      ctx.fillStyle = "#fff476";
      roundedRect(ctx, x, y, size, size, 5);
      ctx.fill();
      ctx.strokeStyle = "#ffb84f";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wireDom() {
    const canvas = document.getElementById("gameCanvas");
    const titleScreen = document.getElementById("titleScreen");
    const wordInput = document.getElementById("wordInput");
    const hud = document.getElementById("hud");
    const settingsButton = document.getElementById("settingsButton");
    const settingsPanel = document.getElementById("settingsPanel");
    const liveWordInput = document.getElementById("liveWordInput");
    const dom = {
      hudMode: document.getElementById("hudMode"),
      hudDistance: document.getElementById("hudDistance")
    };
    const game = new MorseSquareGame(canvas, dom);
    const customSettings = createModeSettings("custom");

    const controls = {
      dotWidth: document.getElementById("dotWidth"),
      dashWidth: document.getElementById("dashWidth"),
      easyGap: document.getElementById("easyGap"),
      mediumGap: document.getElementById("mediumGap"),
      hardGap: document.getElementById("hardGap"),
      iceChance: document.getElementById("iceChance"),
      slimeChance: document.getElementById("slimeChance"),
      barChance: document.getElementById("barChance"),
      lowSlimeChance: document.getElementById("lowSlimeChance"),
      easyWeight: document.getElementById("easyWeight"),
      mediumWeight: document.getElementById("mediumWeight"),
      hardWeight: document.getElementById("hardWeight")
    };

    const outputs = {};
    Object.keys(controls).forEach((id) => {
      outputs[id] = document.getElementById(`${id}Out`);
    });

    function setPanelFromSettings(settings) {
      controls.dotWidth.value = settings.dotWidth;
      controls.dashWidth.value = settings.dashWidth;
      controls.easyGap.value = settings.gapRanges.easy.max;
      controls.mediumGap.value = settings.gapRanges.medium.max;
      controls.hardGap.value = settings.gapRanges.hard.max;
      controls.iceChance.value = settings.iceWordChance;
      controls.slimeChance.value = settings.slimeWordChance;
      controls.barChance.value = settings.movingBarChance;
      controls.lowSlimeChance.value = settings.lowSlimeChance;
      controls.easyWeight.value = Math.round(settings.difficultyWeights.easy * 100);
      controls.mediumWeight.value = Math.round(settings.difficultyWeights.medium * 100);
      controls.hardWeight.value = Math.round(settings.difficultyWeights.hard * 100);
      updateOutputs();
    }

    function outputPercent(value) {
      return `${Math.round(Number(value) * 100)}%`;
    }

    function updateOutputs() {
      outputs.dotWidth.textContent = `${controls.dotWidth.value}`;
      outputs.dashWidth.textContent = `${controls.dashWidth.value}`;
      outputs.easyGap.textContent = `${controls.easyGap.value}`;
      outputs.mediumGap.textContent = `${controls.mediumGap.value}`;
      outputs.hardGap.textContent = `${controls.hardGap.value}`;
      outputs.iceChance.textContent = outputPercent(controls.iceChance.value);
      outputs.slimeChance.textContent = outputPercent(controls.slimeChance.value);
      outputs.barChance.textContent = outputPercent(controls.barChance.value);
      outputs.lowSlimeChance.textContent = outputPercent(controls.lowSlimeChance.value);
      outputs.easyWeight.textContent = `${controls.easyWeight.value}`;
      outputs.mediumWeight.textContent = `${controls.mediumWeight.value}`;
      outputs.hardWeight.textContent = `${controls.hardWeight.value}`;
    }

    function readPanelSettings() {
      const easyWeight = Number(controls.easyWeight.value);
      const mediumWeight = Number(controls.mediumWeight.value);
      const hardWeight = Number(controls.hardWeight.value);
      const totalWeight = easyWeight + mediumWeight + hardWeight || 1;
      return mergeSettings(createModeSettings("custom"), {
        dotWidth: Number(controls.dotWidth.value),
        dashWidth: Number(controls.dashWidth.value),
        gapRanges: {
          easy: { min: 40, max: Number(controls.easyGap.value) },
          medium: { min: 64, max: Number(controls.mediumGap.value) },
          hard: { min: 96, max: Number(controls.hardGap.value) }
        },
        iceWordChance: Number(controls.iceChance.value),
        slimeWordChance: Number(controls.slimeChance.value),
        movingBarChance: Number(controls.barChance.value),
        lowSlimeChance: Number(controls.lowSlimeChance.value),
        difficultyWeights: {
          easy: easyWeight / totalWeight,
          medium: mediumWeight / totalWeight,
          hard: hardWeight / totalWeight
        }
      });
    }

    function applyPanelSettings() {
      updateOutputs();
      const settings = readPanelSettings();
      Object.assign(customSettings, settings);
      game.applyCustomSettings(settings);
    }

    Object.values(controls).forEach((control) => {
      control.addEventListener("input", applyPanelSettings);
    });

    liveWordInput.addEventListener("change", () => {
      game.setCustomWords(liveWordInput.value);
    });

    liveWordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        liveWordInput.blur();
        game.setCustomWords(liveWordInput.value);
      }
    });

    setPanelFromSettings(customSettings);

    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.getAttribute("data-mode");
        const isCustomMode = mode === "custom";
        const text = isCustomMode ? wordInput.value : "";
        const plugin = isCustomMode ? createPluginFromText(text) : new RandomWordsPlugin();
        const settings = mode === "custom" ? readPanelSettings() : createModeSettings(mode);
        const seed = hashSeed(`${mode}|${isCustomMode ? text : "generated"}|${Date.now()}`);
        liveWordInput.value = isCustomMode ? text : "";
        titleScreen.hidden = true;
        hud.hidden = false;
        settingsButton.hidden = mode !== "custom";
        settingsPanel.hidden = true;
        game.start(mode, settings, plugin, seed);
      });
    });

    settingsButton.addEventListener("click", () => {
      settingsPanel.hidden = !settingsPanel.hidden;
    });

    document.getElementById("closeSettings").addEventListener("click", () => {
      settingsPanel.hidden = true;
    });

    document.getElementById("menuButton").addEventListener("click", () => {
      game.showTitle();
      hud.hidden = true;
      settingsButton.hidden = true;
      settingsPanel.hidden = true;
      titleScreen.hidden = false;
    });
  }

  const api = {
    MORSE_CODE,
    MATERIAL_WORDS,
    PLATFORM_VISUALS,
    PHYSICS,
    DEFAULT_SETTINGS,
    RNG,
    RandomWordsPlugin,
    CustomTypedStringPlugin,
    MorseCourseGenerator,
    canReachPlatform,
    createModeSettings,
    fitSettingsToViewport,
    wordsToMorseString,
    wordsToMorseTokens,
    removeSlashTokens,
    normalizeWords,
    createPluginFromText,
    hashSeed
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.MorseSquare = api;

  if (hasDom) {
    window.addEventListener("DOMContentLoaded", wireDom);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
