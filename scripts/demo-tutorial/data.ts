import type { ListRole, Platform, SeriesStatus, TitleKind } from "../../src/db/schema";

/**
 * FIL-I38 · Data for the Filmia video tutorial, on the demo account only.
 * Real TMDB ids, names (es-MX) and posters, resolved on 2026-10-30. Reviews and notes are
 * written for the demo; the friends below are fictitious and live on `*.invalid` addresses.
 */

export const DEMO_USER_ID = "cm4demofilmia00000000001";
export const DEMO_EMAIL = "demo@filmia.local";

/** The year of «Tu top 10 de {año}» on /cine/mejor/{año}. */
export const TOP_YEAR = 2026;

/** What Perfil › Plataformas shows. */
export const DEMO_PLATFORMS: Platform[] = ["NETFLIX", "PRIME", "MAX", "DISNEY", "APPLE", "MUBI"];

export type DemoFilm = {
  tmdbId: number;
  kind: TitleKind;
  name: string;
  originalName?: string;
  year: number;
  posterPath: string;
};

export type WatchedSeed = DemoFilm & {
  /** Day of October 2026 it was watched (evening, CDMX). */
  day: number;
  /** 1–10, two points per star. */
  rating: number;
  review?: string;
  platform?: Platform;
};

export type QueueSeed = DemoFilm & {
  queueNote?: string;
  platform?: Platform;
  seriesStatus?: SeriesStatus;
  seriesSeason?: number;
};

const movie = (tmdbId: number, name: string, year: number, posterPath: string, originalName?: string): DemoFilm => ({
  tmdbId,
  kind: "MOVIE",
  name,
  originalName,
  year,
  posterPath,
});

const series = (tmdbId: number, name: string, year: number, posterPath: string, originalName?: string): DemoFilm => ({
  tmdbId,
  kind: "SERIES",
  name,
  originalName,
  year,
  posterPath,
});

/** Released in 2026 and watched in October: they fill «Tu top 10 de 2026». */
export const WATCHED_2026: WatchedSeed[] = [
  { ...movie(687163, "Proyecto Fin del Mundo", 2026, "/cWpvRQcppLnXD0Kno4OZUzkA05R.jpg", "Project Hail Mary"), day: 3, rating: 10, review: "Ciencia, amistad y un final que se gana cada minuto." },
  { ...movie(1368337, "La Odisea", 2026, "/sRxbUe5FB25Gde0e2FnwwSckpXb.jpg", "The Odyssey"), day: 5, rating: 9, review: "Mar, monstruos y paciencia. Pide pantalla grande." },
  { ...movie(1275779, "El día de la revelación", 2026, "/8yQ7RDPPBlHMYdIo4ihPkHkOfnY.jpg", "Disclosure Day"), day: 7, rating: 9 },
  { ...movie(1084244, "Toy Story 5", 2026, "/zkQmhKTszD48vEcjIfwAlqLnGSr.jpg"), day: 8, rating: 8, platform: "DISNEY" },
  { ...movie(1327819, "Hoppers: Operación castor", 2026, "/yONVGkDGZ07WGAR5Fq0GErzHUZ9.jpg", "Hoppers"), day: 10, rating: 8, platform: "DISNEY" },
  { ...movie(1272837, "Exterminio: El templo de huesos", 2026, "/6yUxfwcDYR0RRfbxwGA7rhwreWU.jpg", "28 Years Later: The Bone Temple"), day: 12, rating: 8 },
  { ...movie(969681, "Spider-Man: Un nuevo día", 2026, "/fBFjaDWfNslvrs6bJjknmG27wOS.jpg", "Spider-Man: Brand New Day"), day: 14, rating: 7 },
  { ...movie(1316092, "“Cumbres Borrascosas”", 2026, "/kCb3QJNLi0alrk7i5aCphkkuoFl.jpg", "“Wuthering Heights”"), day: 16, rating: 7 },
  { ...movie(1171145, "Caminos del crimen", 2026, "/2EI8HmeQgbryWw5clWYc4vYj1tU.jpg", "Crime 101"), day: 18, rating: 7, platform: "PRIME" },
  { ...movie(1306368, "El botín", 2026, "/3dQVnkDyTq0NCbRCUZc5tdztVbd.jpg", "The Rip"), day: 20, rating: 6, platform: "NETFLIX" },
  { ...movie(1226863, "Super Mario Galaxy: La película", 2026, "/4Js0gYWxuvTN6b8iAaSF1cSQzBs.jpg", "The Super Mario Galaxy Movie"), day: 22, rating: 6 },
  { ...movie(1159559, "Scream 7", 2026, "/iUdLnidOSYJMals9AmOgCa0Qz6K.jpg"), day: 24, rating: 5 },
];

/** Older films watched in October 2026 (rewatches and catch-ups). */
export const WATCHED_OLDER: WatchedSeed[] = [
  { ...movie(244786, "Whiplash: Música y Obsesión", 2014, "/uy36CPy5ARuC8qrH8Esg2ndFyJ5.jpg", "Whiplash"), day: 1, rating: 10, platform: "NETFLIX", review: "El último número sigue sin dejarme respirar." },
  { ...movie(313369, "La La Land: Una historia de amor", 2016, "/2aBAqu6f0fBpr47gDI6Fje56sCn.jpg", "La La Land"), day: 2, rating: 8, platform: "PRIME" },
  { ...movie(329865, "La Llegada", 2016, "/dkYr7GA9F9Vps5QN74ycbbxMfiQ.jpg", "Arrival"), day: 2, rating: 9, platform: "NETFLIX" },
  { ...movie(545611, "Todo en todas partes al mismo tiempo", 2022, "/vbR5YirdyIQyLzWHALmdDAJshWC.jpg", "Everything Everywhere All at Once"), day: 4, rating: 9, platform: "PRIME", review: "Caos con corazón. Los dedos de salchicha se quedan." },
  { ...movie(872585, "Oppenheimer", 2023, "/mJRUREPjTqqMEKwEiM2sdmIGngz.jpg"), day: 6, rating: 9, platform: "PRIME" },
  { ...movie(666277, "Vidas Pasadas", 2023, "/z34UKyOAONFN54O340rL1dQRHKa.jpg", "Past Lives"), day: 6, rating: 10, platform: "MUBI", review: "Pequeña, callada y devastadora." },
  { ...movie(792307, "Pobres Criaturas", 2023, "/xbfzQ7Q7qmDUf50eZH8C57Ygx6n.jpg", "Poor Things"), day: 9, rating: 8, platform: "DISNEY" },
  { ...movie(840430, "Los que se quedan", 2023, "/aZj21Kcmazecm6VDBn4bYU4evi3.jpg", "The Holdovers"), day: 11, rating: 8, platform: "PRIME" },
  { ...movie(915935, "Anatomía de una Caída", 2023, "/31MkIlfEaQ5vopz5lulP96xbZyU.jpg", "Anatomie d'une chute"), day: 11, rating: 9, platform: "MUBI" },
  { ...movie(426426, "Roma", 2018, "/veWGVw33lnifG10fpkz3QmimVaI.jpg"), day: 13, rating: 10, platform: "NETFLIX", review: "La Colonia Roma en blanco y negro. Cada plano es un recuerdo." },
  { ...movie(1391, "Y tu mamá también", 2001, "/oLl2f0r3c6WMhXv6hYOyjQj4LGU.jpg"), day: 15, rating: 9 },
  { ...movie(55, "Amores perros", 2000, "/uoObXx53SjSLLtAavMSIe02zizs.jpg"), day: 15, rating: 9, platform: "MAX" },
  { ...movie(1417, "El laberinto del fauno", 2006, "/cxVlgYbn1GAdVhuBjM2jFiavfRp.jpg"), day: 17, rating: 10, platform: "NETFLIX" },
  { ...movie(419430, "¡Huye!", 2017, "/s0BriSYHEOIypAM0ZhUIQUOr3HE.jpg", "Get Out"), day: 19, rating: 8, platform: "PRIME" },
  { ...movie(546554, "Entre Navajas y Secretos", 2019, "/omPRLe495hZSsKdI3LjYsK7HcYn.jpg", "Knives Out"), day: 21, rating: 8, platform: "PRIME" },
  { ...movie(569094, "Spider-Man: A través del Spider-Verso", 2023, "/rXhgHQmtjTIQOEDU8E2TbUFMjWM.jpg", "Spider-Man: Across the Spider-Verse"), day: 23, rating: 10, platform: "NETFLIX" },
  { ...movie(27205, "El Origen", 2010, "/xgPGDEKkBrXhPaNmwIlf8e2RCMk.jpg", "Inception"), day: 25, rating: 9, platform: "MAX" },
  { ...movie(152601, "Ella", 2013, "/n1sY9uAsQKOus91A4FtvN3JdHYH.jpg", "Her"), day: 26, rating: 8, platform: "MAX" },
  { ...movie(354912, "Coco", 2017, "/oburjHqzOrTtDLYbLunKLwUHhk1.jpg"), day: 27, rating: 9, platform: "DISNEY" },
  { ...movie(1233413, "Pecadores", 2025, "/jIVa5m9s7bKYdI0KH8wFw1qLxHl.jpg", "Sinners"), day: 28, rating: 9, platform: "MAX", review: "Blues, vampiros y una secuencia musical que no se olvida." },
  { ...movie(1054867, "Una batalla tras otra", 2025, "/kgVBwI8V4jjYTEbfyugEr6sDa7v.jpg", "One Battle After Another"), day: 29, rating: 9, platform: "MAX" },
  { ...movie(1078605, "La hora de la desaparición", 2025, "/6Gw2eH2SkANYXC7mDjtYMppOXiL.jpg", "Weapons"), day: 29, rating: 8, platform: "MAX" },
];

export const WATCHED: WatchedSeed[] = [...WATCHED_OLDER, ...WATCHED_2026];

/** New rows for «Quiero ver», in queue order after whatever is already there. */
export const QUEUE: QueueSeed[] = [
  { ...movie(974576, "Conclave", 2024, "/jkOgeASTlWwyKLBNblHVwWmAKhD.jpg"), platform: "PRIME", queueNote: "Para una noche de intriga." },
  { ...movie(1064213, "Anora", 2024, "/vpoxEgEHu3B8apJMGygtrTlh1I4.jpg"), platform: "MAX" },
  { ...movie(549509, "El brutalista", 2024, "/zOHNOv5JHzDjDXt24mM9aSXKpSU.jpg", "The Brutalist"), platform: "MAX", queueNote: "Tres horas y media: domingo." },
  { ...movie(933260, "La sustancia", 2024, "/w1PiIqM89r4AM7CiMEP4VLCEFUn.jpg", "The Substance"), platform: "MUBI" },
  { ...movie(937287, "Desafiantes", 2024, "/wvJbx3pg1EUatQgazl34ylIh5cD.jpg", "Challengers"), platform: "PRIME" },
  { ...movie(786892, "Furiosa: De la saga Mad Max", 2024, "/tGHUlykWn9V2IIQ4ZaATIAq9VLB.jpg", "Furiosa: A Mad Max Saga"), platform: "MAX", queueNote: "Antes de volver a Fury Road." },
  { ...movie(929590, "Guerra Civil", 2024, "/rLyuE271bVhhRMTjukRNXkWTg6C.jpg", "Civil War"), platform: "MAX" },
  { ...movie(976893, "Días Perfectos", 2023, "/efnvsuEdkdwiWR7WyQ2QgcGt8mM.jpg", "PERFECT DAYS"), platform: "MUBI" },
  { ...movie(965150, "Aftersun", 2022, "/zJd2NwGzciSMppCHividNSROIZR.jpg"), platform: "MUBI", queueNote: "Con pañuelos a la mano." },
  { ...movie(467244, "Zona de Interés", 2023, "/jjBgrAsz0vFerjesnM3NnyU3Bm5.jpg", "The Zone of Interest"), platform: "MAX" },
  { ...movie(705996, "La decisión de partir", 2022, "/93ukueajvdIKusWvAzMBe6zX3hN.jpg", "헤어질 결심"), platform: "MUBI" },
  { ...movie(758866, "Drive My Car", 2021, "/iGm0oHpKzFo7z73z82KL1cy9iMX.jpg", "ドライブ・マイ・カー"), platform: "MUBI" },
  { ...movie(531428, "Retrato de una mujer en llamas", 2019, "/muAsDE6qAqdKB2VJsIzo1uVSSuM.jpg", "Portrait de la jeune fille en feu"), platform: "MUBI" },
  { ...movie(146233, "Intriga", 2013, "/sxNRj5VftRw0Vu5nhoJuAkDEpBm.jpg", "Prisoners"), platform: "NETFLIX" },
  { ...movie(273481, "Sicario: Tierra de nadie", 2015, "/t0bJ16uBEqg0ahDI8kaqHBS0XKd.jpg", "Sicario"), platform: "NETFLIX" },
  { ...movie(6977, "Sin lugar para los débiles", 2007, "/zEPHUBFa7mFsF9xO5Vzx6mjZ1JE.jpg", "No Country for Old Men"), platform: "PRIME", queueNote: "Los Coen, por fin." },
  { ...movie(7345, "Petróleo sangriento", 2007, "/o8VQMSZecPNWtYP42yWo2OH1gH0.jpg", "There Will Be Blood"), platform: "PRIME" },
  { ...movie(1949, "Zodíaco", 2007, "/3gdnyFroJP1IxKI5ZReRZ1d4cs2.jpg", "Zodiac"), platform: "MAX" },
  { ...movie(949, "Fuego contra Fuego", 1995, "/c1qMPl0takx8I4JFxDXMAEEOKXg.jpg", "Heat"), platform: "DISNEY" },
  { ...movie(9693, "Niños del hombre", 2006, "/rh0TK6TTBbyxHkM1ae4Erf2k7c1.jpg", "Children of Men"), platform: "PRIME" },
  { ...movie(376867, "Luz de luna", 2016, "/xVzMkuXkRrmfYSYTzBCCJlj990Y.jpg", "Moonlight"), platform: "NETFLIX" },
  { ...movie(1317288, "Marty Supremo", 2025, "/guRmwb1r337m2tKBH9KcE3vOpGE.jpg", "Marty Supreme") },
  { ...movie(1062722, "Frankenstein", 2025, "/hTj8x0ElKldJyAjTYvaqxkQNxxN.jpg"), platform: "NETFLIX", queueNote: "Del Toro en Halloween." },
  { ...movie(701387, "Bugonia", 2025, "/fndDv16tDmgvMBJd2bb2w5CDxpe.jpg") },
  { ...movie(858024, "Hamnet", 2025, "/qXF968t2LfHZJ8Zrq2NgMGNomnE.jpg") },
  { ...movie(1228710, "Star Wars: The Mandalorian and Grogu", 2026, "/qWEGudNnHfEKp18IG1Wq1Qmp00l.jpg", "The Mandalorian and Grogu"), queueNote: "Cuando llegue a Disney+." },
  { ...movie(1101383, "El final de la Calle Oak", 2026, "/jPBfFTwmgco94oS9ikdt9tqHsxm.jpg", "The End of Oak Street") },
  { ...movie(1301421, "Las ovejas detectives", 2026, "/iryjE7zrVxML5UM5vCPJGtKYvWC.jpg", "The Sheep Detectives") },
  { ...series(126308, "Shōgun", 2024, "/uIoDvVOQaKjSfz2oihkVS8M7l1v.jpg"), platform: "DISNEY" },
  { ...series(136315, "El Oso", 2022, "/5TZnk9ryzfcNlsCOghURfZsBong.jpg", "The Bear"), platform: "DISNEY", seriesStatus: "WATCHING", seriesSeason: 3 },
  { ...series(83867, "Andor", 2022, "/e3cWQzBxHK803AbZGjp1feQFgyS.jpg"), platform: "DISNEY" },
];

export type FriendSeed = { id: string; email: string; name: string; role: ListRole };

/** Fictitious friends: non-routable addresses, unusable password, no Google link, no push. */
export const FRIENDS: FriendSeed[] = [
  { id: "cm4demofilmiacuate000001", email: "lalo.cuate@filmia.invalid", name: "Lalo", role: "EDITOR" },
  { id: "cm4demofilmiacuate000002", email: "pau.cuate@filmia.invalid", name: "Pau", role: "EDITOR" },
  { id: "cm4demofilmiacuate000003", email: "memo.cuate@filmia.invalid", name: "Memo", role: "EDITOR" },
  { id: "cm4demofilmiacuate000004", email: "tere.cuate@filmia.invalid", name: "Tere", role: "VIEWER" },
];

export const SHARED_LIST_NAME = "Cine con los cuates";
export const SHARED_LIST_DESCRIPTION = "Lo que vemos juntos los viernes. Cada quien agrega su propuesta.";

/** Films on the shared list and who proposed each (null = the demo account). */
export const SHARED_ITEMS: Array<{ tmdbId: number; kind: DemoFilm["kind"]; addedBy: string | null }> = [
  { tmdbId: 1368337, kind: "MOVIE", addedBy: null },
  { tmdbId: 974576, kind: "MOVIE", addedBy: FRIENDS[0].id },
  { tmdbId: 786892, kind: "MOVIE", addedBy: FRIENDS[1].id },
  { tmdbId: 1062722, kind: "MOVIE", addedBy: FRIENDS[2].id },
  { tmdbId: 937287, kind: "MOVIE", addedBy: FRIENDS[0].id },
  { tmdbId: 1317288, kind: "MOVIE", addedBy: FRIENDS[1].id },
  { tmdbId: 6977, kind: "MOVIE", addedBy: null },
  { tmdbId: 1078605, kind: "MOVIE", addedBy: FRIENDS[2].id },
];
