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
// Art Online, Omniscient Reader's Viewpoint, Tower of God, One Punch Man,
// KonoSuba, Mushoku Tensei, The Rising of the Shield Hero, That Time I Got
// Reincarnated as a Slime, The Wandering Inn, Mother of Learning, He Who
// Fights With Monsters) are dated to their web serialization start, not a
// later print release. Years for the last group (added on request, plus
// Made in Abyss) were confirmed via web search at build time; the rest are
// sourced from general knowledge at build time (Aug 2026) — double check any
// that look off before a party, sourcing can be genuinely fuzzy for some
// web-original works.
//
// Images: static/fandom_images/*.jpg are Claude-generated placeholder title
// cards (gradient + title text), NOT real cover art/posters — this session's
// tools can't download copyrighted images (no raw web-fetch access, only
// text-summarizing WebFetch). Drop real cover art into that folder using
// these exact filenames (<id>.jpg) to replace a placeholder; nothing else
// needs to change.
//
// 56 items, well above GAME_PLANS.md's 30+ guidance for a full party
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
  { id: 'narnia', name: 'The Chronicles of Narnia', image: '/static/fandom_images/narnia.jpg', value: 1950 },
  { id: 'berserk', name: 'Berserk', image: '/static/fandom_images/berserk.jpg', value: 1989 },
  { id: 'vinland-saga', name: 'Vinland Saga', image: '/static/fandom_images/vinland-saga.jpg', value: 2005 },
  { id: 'tokyo-ghoul', name: 'Tokyo Ghoul', image: '/static/fandom_images/tokyo-ghoul.jpg', value: 2011 },
  { id: 'made-in-abyss', name: 'Made in Abyss', image: '/static/fandom_images/made-in-abyss.jpg', value: 2012 },
  { id: 'black-clover', name: 'Black Clover', image: '/static/fandom_images/black-clover.jpg', value: 2015 },
  { id: 'promised-neverland', name: 'The Promised Neverland', image: '/static/fandom_images/promised-neverland.jpg', value: 2016 },
  { id: 'mob-psycho-100', name: 'Mob Psycho 100', image: '/static/fandom_images/mob-psycho-100.jpg', value: 2012 },
  { id: 'dr-stone', name: 'Dr. Stone', image: '/static/fandom_images/dr-stone.jpg', value: 2017 },
  { id: 'konosuba', name: 'KonoSuba', image: '/static/fandom_images/konosuba.jpg', value: 2012 },
  { id: 'mushoku-tensei', name: 'Mushoku Tensei', image: '/static/fandom_images/mushoku-tensei.jpg', value: 2012 },
  { id: 'shield-hero', name: 'The Rising of the Shield Hero', image: '/static/fandom_images/shield-hero.jpg', value: 2013 },
  { id: 'reincarnated-as-a-slime', name: 'That Time I Got Reincarnated as a Slime', image: '/static/fandom_images/reincarnated-as-a-slime.jpg', value: 2013 },
  { id: 'wandering-inn', name: 'The Wandering Inn', image: '/static/fandom_images/wandering-inn.jpg', value: 2016 },
  { id: 'mother-of-learning', name: 'Mother of Learning', image: '/static/fandom_images/mother-of-learning.jpg', value: 2011 },
  { id: 'cradle', name: 'Cradle', image: '/static/fandom_images/cradle.jpg', value: 2016 },
  { id: 'he-who-fights-with-monsters', name: 'He Who Fights With Monsters', image: '/static/fandom_images/he-who-fights-with-monsters.jpg', value: 2019 },
  { id: 'discworld', name: 'Discworld', image: '/static/fandom_images/discworld.jpg', value: 1983 },
  { id: 'mistborn', name: 'Mistborn', image: '/static/fandom_images/mistborn.jpg', value: 2006 },
  { id: 'name-of-the-wind', name: 'The Name of the Wind', image: '/static/fandom_images/name-of-the-wind.jpg', value: 2007 },
  { id: 'stormlight-archive', name: 'The Stormlight Archive', image: '/static/fandom_images/stormlight-archive.jpg', value: 2010 },
  { id: 'foundation', name: 'Foundation', image: '/static/fandom_images/foundation.jpg', value: 1951 },
  { id: 'hitchhikers-guide', name: "The Hitchhiker's Guide to the Galaxy", image: '/static/fandom_images/hitchhikers-guide.jpg', value: 1979 },
  { id: 'enders-game', name: "Ender's Game", image: '/static/fandom_images/enders-game.jpg', value: 1985 },
  { id: 'wheel-of-time', name: 'The Wheel of Time', image: '/static/fandom_images/wheel-of-time.jpg', value: 1990 }
];
