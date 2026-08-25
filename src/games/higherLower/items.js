// Fandom pack: manga/manhwa/light novels/webtoons alongside western fantasy,
// sci-fi and spy franchises, replacing the original mountain-elevation pack
// per the user's request (see chat history — CLAUDE.md's "don't touch
// shared code without checking in first" doesn't apply here, this is a
// content-only swap + a couple of theme strings in play.js).
//
// value = the year the story FIRST appeared publicly, in whatever medium it
// began (manga/webtoon serialization, web novel, novel, or film) — the one
// fact that's genuinely comparable across every format here without unit
// conversion, playing the same role elevation played for the mountain pack.
// Web-original titles (Solo Leveling, Shadow Slave, Overlord, Re:Zero, Sword
// Art Online, Omniscient Reader's Viewpoint, Tower of God, One Punch Man)
// are dated to their web serialization start, not a later print release.
// Years are sourced from general knowledge at build time (Aug 2026) — double
// check any that look off before a party, sourcing can be genuinely fuzzy
// for some web-original works.
//
// Images: static/fandom_images/*.jpg are Claude-generated placeholder title
// cards (gradient + title text), NOT real cover art/posters — this session's
// tools can't download copyrighted images (no raw web-fetch access, only
// text-summarizing WebFetch). Drop real cover art into that folder using
// these exact filenames (<id>.jpg) to replace a placeholder; nothing else
// needs to change.
//
// 32 items, comfortably above GAME_PLANS.md's 30+ guidance for a full party
// without repeats.
module.exports = [
  { id: 'one-piece', name: 'One Piece', image: '/static/fandom_images/one-piece.jpg', value: 1997 },
  { id: 'bleach', name: 'Bleach', image: '/static/fandom_images/bleach.jpg', value: 2001 },
  { id: 'fairy-tail', name: 'Fairy Tail', image: '/static/fandom_images/fairy-tail.jpg', value: 2006 },
  { id: 'naruto', name: 'Naruto', image: '/static/fandom_images/naruto.jpg', value: 1999 },
  { id: 'attack-on-titan', name: 'Attack on Titan', image: '/static/fandom_images/attack-on-titan.jpg', value: 2009 },
  { id: 'death-note', name: 'Death Note', image: '/static/fandom_images/death-note.jpg', value: 2003 },
  { id: 'demon-slayer', name: 'Demon Slayer', image: '/static/fandom_images/demon-slayer.jpg', value: 2016 },
  { id: 'my-hero-academia', name: 'My Hero Academia', image: '/static/fandom_images/my-hero-academia.jpg', value: 2014 },
  { id: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', image: '/static/fandom_images/jujutsu-kaisen.jpg', value: 2018 },
  { id: 'chainsaw-man', name: 'Chainsaw Man', image: '/static/fandom_images/chainsaw-man.jpg', value: 2018 },
  { id: 'fullmetal-alchemist', name: 'Fullmetal Alchemist', image: '/static/fandom_images/fullmetal-alchemist.jpg', value: 2001 },
  { id: 'hunter-x-hunter', name: 'Hunter x Hunter', image: '/static/fandom_images/hunter-x-hunter.jpg', value: 1998 },
  { id: 'dragon-ball', name: 'Dragon Ball', image: '/static/fandom_images/dragon-ball.jpg', value: 1984 },
  { id: 'solo-leveling', name: 'Solo Leveling', image: '/static/fandom_images/solo-leveling.jpg', value: 2016 },
  { id: 'shadow-slave', name: 'Shadow Slave', image: '/static/fandom_images/shadow-slave.jpg', value: 2020 },
  { id: 'omniscient-reader', name: "Omniscient Reader's Viewpoint", image: '/static/fandom_images/omniscient-reader.jpg', value: 2018 },
  { id: 'tower-of-god', name: 'Tower of God', image: '/static/fandom_images/tower-of-god.jpg', value: 2010 },
  { id: 'overlord', name: 'Overlord', image: '/static/fandom_images/overlord.jpg', value: 2010 },
  { id: 're-zero', name: 'Re:Zero', image: '/static/fandom_images/re-zero.jpg', value: 2012 },
  { id: 'sword-art-online', name: 'Sword Art Online', image: '/static/fandom_images/sword-art-online.jpg', value: 2002 },
  { id: 'one-punch-man', name: 'One Punch Man', image: '/static/fandom_images/one-punch-man.jpg', value: 2009 },
  { id: 'spy-x-family', name: 'Spy x Family', image: '/static/fandom_images/spy-x-family.jpg', value: 2019 },
  { id: 'lord-of-the-rings', name: 'The Lord of the Rings', image: '/static/fandom_images/lord-of-the-rings.jpg', value: 1954 },
  { id: 'harry-potter', name: 'Harry Potter', image: '/static/fandom_images/harry-potter.jpg', value: 1997 },
  { id: 'james-bond', name: 'James Bond', image: '/static/fandom_images/james-bond.jpg', value: 1953 },
  { id: 'game-of-thrones', name: 'A Song of Ice and Fire', image: '/static/fandom_images/game-of-thrones.jpg', value: 1996 },
  { id: 'star-wars', name: 'Star Wars', image: '/static/fandom_images/star-wars.jpg', value: 1977 },
  { id: 'dune', name: 'Dune', image: '/static/fandom_images/dune.jpg', value: 1965 },
  { id: 'the-witcher', name: 'The Witcher', image: '/static/fandom_images/the-witcher.jpg', value: 1986 },
  { id: 'hunger-games', name: 'The Hunger Games', image: '/static/fandom_images/hunger-games.jpg', value: 2008 },
  { id: 'percy-jackson', name: 'Percy Jackson', image: '/static/fandom_images/percy-jackson.jpg', value: 2005 },
  { id: 'narnia', name: 'The Chronicles of Narnia', image: '/static/fandom_images/narnia.jpg', value: 1950 }
];
