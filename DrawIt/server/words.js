const WORD_BANK = [
  // Objects & Everyday Items
  "astronaut", "volcano", "sushi", "katana", "guitar", "penguin", "pyramid",
  "telescope", "lighthouse", "umbrella", "skateboard", "compass", "anchor",

  // Pop Culture, Gaming & Anime
  "pikachu", "minecraft", "lightsaber", "pokeball", "naruto", "spiderman",
  "batmobile", "controller", "headphones", "keyboard",

  // Animals & Nature
  "octopus", "kangaroo", "platypus", "hedgehog", "cactus", "sunflower",
  "dinosaur", "phoenix", "dragon", "tornado"
];

// Fisher-Yates (unbiased, unlike sort(() => 0.5 - Math.random()))
function getRandomWords(count = 3) {
  const a = [...WORD_BANK];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}

module.exports = { getRandomWords };
