// Regenerates the 5 fabricated sample exports in public/samples/. Everything is made up:
// fictional merchants, channels and gear; public-domain book titles. Fixed seed, so files are stable.
// Run with TZ=Europe/Paris (npm run samples) so watch-history timestamps match a Paris viewer.
import { writeFileSync, mkdirSync } from "node:fs";

let seed = 20261013;
const rnd = (): number => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const q = (v: unknown) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: unknown[][], sep = ",") => rows.map((r) => r.map(q).join(sep)).join("\n") + "\n";
const pad = (n: number) => String(n).padStart(2, "0");
const days = (from: string, to: string): Date[] => { const out: Date[] = []; for (let d = new Date(from + "T00:00:00Z"); d <= new Date(to + "T00:00:00Z"); d = new Date(d.getTime() + 864e5)) out.push(d); return out; };
const OUT = new URL("../public/samples/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// 1. Running log (Strava-style bulk export: duplicate "Elapsed Time" and "Distance" columns, km then meters)
{
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (d: Date) => { let h = d.getUTCHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${h}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${ap}`; };
  const head = ["Activity ID", "Activity Date", "Activity Name", "Activity Type", "Activity Description", "Elapsed Time", "Distance", "Max Heart Rate", "Relative Effort", "Commute", "Activity Gear", "Filename", "Elapsed Time", "Moving Time", "Distance", "Max Speed", "Average Speed", "Elevation Gain", "Calories"];
  const rows: unknown[][] = [head];
  let id = 11873400000;
  for (const d of days("2024-11-01", "2026-03-20")) {
    const m = d.getUTCMonth(), dow = d.getUTCDay(), y = d.getUTCFullYear();
    const streak = y === 2025 && m === 0 && d.getUTCDate() >= 6 && d.getUTCDate() <= 23;
    const race = y === 2025 && m === 9 && d.getUTCDate() === 12;
    let type: string | null = null;
    if (race || streak) type = "Run";
    else if ([2, 4].includes(dow) && rnd() < 0.8) type = "Run";
    else if (dow === 0 && rnd() < 0.85) type = "Run";
    else if (dow === 6 && m >= 4 && m <= 8 && rnd() < 0.7) type = "Ride";
    else if (dow === 1 && rnd() < 0.25) type = "Swim";
    else if (rnd() < 0.12) type = "Walk";
    else if (dow === 6 && rnd() < 0.15) type = "Hike";
    if (!type) continue;
    const progress = y === 2025 ? m / 11 : y > 2025 ? 1 : 0;
    let km = 0, pace = 0; // pace in s/km
    if (type === "Run") { km = race ? 21.1 : dow === 0 ? between(10, 14 + 6 * progress) : between(5, 9); pace = race ? 301 : between(330, 375) - 25 * progress; }
    if (type === "Ride") { km = between(35, 85); pace = between(120, 150); }
    if (type === "Swim") { km = between(1.2, 2.4); pace = between(1000, 1150); }
    if (type === "Walk") { km = between(3, 7); pace = between(640, 720); }
    if (type === "Hike") { km = between(9, 19); pace = between(700, 820); }
    const hour = type === "Run" && dow !== 0 ? (rnd() < 0.7 ? int(6, 7) : int(18, 19)) : int(8, 10);
    const start = new Date(Date.UTC(y, m, d.getUTCDate(), hour, int(0, 59), int(0, 59)));
    const moving = Math.round(km * pace), elapsed = Math.round(moving * between(1.02, 1.12));
    const part = hour < 11 ? "Morning" : hour < 14 ? "Lunch" : hour < 18 ? "Afternoon" : "Evening";
    const name = race ? "Half Marathon - race day!" : streak ? `Run streak day ${d.getUTCDate() - 5}` : `${part} ${type}`;
    const desc = race ? "Sub 1:46, so happy" : rnd() < 0.1 ? pick(["legs felt heavy", "new route by the river", "windy!", "easy recovery", "with the club"]) : "";
    const gear = type === "Run" ? (y === 2025 && m >= 6 ? "Blue trainers v2" : "Blue trainers") : type === "Ride" ? "Grey road bike" : "";
    const elev = type === "Swim" ? "" : (km * between(4, type === "Hike" ? 40 : 12)).toFixed(1);
    rows.push([++id, fmt(start), name, type, desc, elapsed, km.toFixed(2), type === "Swim" ? "" : int(150, 189), int(8, race ? 260 : 120), type === "Ride" && rnd() < 0.2 ? "true" : "false", gear, `activities/${id}.fit.gz`, `${elapsed}.0`, `${moving}.0`, (km * 1000).toFixed(1), ((1000 / pace) * between(1.3, 1.8)).toFixed(1), (1000 / pace).toFixed(3), elev, Math.round(km * between(55, 75))]);
  }
  writeFileSync(OUT + "running-log.csv", csv(rows));
}

// 2. Reading list (Goodreads-style library export: ="ISBN", rating 0 = unrated, to-read rows without a read date)
{
  const BOOKS: [string, string, number, number][] = [["Pride and Prejudice", "Jane Austen", 432, 1813], ["Frankenstein", "Mary Shelley", 280, 1818], ["Dracula", "Bram Stoker", 418, 1897], ["Jane Eyre", "Charlotte Bronte", 532, 1847], ["Wuthering Heights", "Emily Bronte", 416, 1847], ["Moby-Dick", "Herman Melville", 635, 1851], ["Middlemarch", "George Eliot", 880, 1871], ["Great Expectations", "Charles Dickens", 505, 1861], ["A Tale of Two Cities", "Charles Dickens", 489, 1859], ["The Count of Monte Cristo", "Alexandre Dumas", 1276, 1844], ["Anna Karenina", "Leo Tolstoy", 864, 1878], ["War and Peace", "Leo Tolstoy", 1225, 1869], ["Crime and Punishment", "Fyodor Dostoevsky", 671, 1866], ["The Brothers Karamazov", "Fyodor Dostoevsky", 796, 1880], ["Little Women", "Louisa May Alcott", 449, 1868], ["The Time Machine", "H.G. Wells", 118, 1895], ["The War of the Worlds", "H.G. Wells", 192, 1898], ["Treasure Island", "Robert Louis Stevenson", 311, 1883], ["Emma", "Jane Austen", 474, 1815], ["Persuasion", "Jane Austen", 249, 1817], ["Sense and Sensibility", "Jane Austen", 409, 1811], ["The Scarlet Letter", "Nathaniel Hawthorne", 238, 1850], ["Walden", "Henry David Thoreau", 352, 1854], ["Heart of Darkness", "Joseph Conrad", 96, 1899], ["The Call of the Wild", "Jack London", 172, 1903], ["Madame Bovary", "Gustave Flaubert", 329, 1857], ["The Age of Innocence", "Edith Wharton", 365, 1920], ["The House of Mirth", "Edith Wharton", 352, 1905], ["Siddhartha", "Hermann Hesse", 152, 1922], ["The Metamorphosis", "Franz Kafka", 201, 1915], ["Mrs Dalloway", "Virginia Woolf", 194, 1925], ["The Great Gatsby", "F. Scott Fitzgerald", 180, 1925], ["To the Lighthouse", "Virginia Woolf", 209, 1927], ["Don Quixote", "Miguel de Cervantes", 1072, 1605], ["Les Miserables", "Victor Hugo", 1463, 1862], ["The Picture of Dorian Gray", "Oscar Wilde", 254, 1890], ["Northanger Abbey", "Jane Austen", 251, 1817], ["The Odyssey", "Homer", 541, -700], ["Bleak House", "Charles Dickens", 1017, 1853], ["Far from the Madding Crowd", "Thomas Hardy", 433, 1874], ["Tess of the d'Urbervilles", "Thomas Hardy", 518, 1891], ["The Secret Garden", "Frances Hodgson Burnett", 331, 1911], ["Kim", "Rudyard Kipling", 368, 1901], ["Ethan Frome", "Edith Wharton", 99, 1911], ["The Turn of the Screw", "Henry James", 121, 1898], ["Silas Marner", "George Eliot", 240, 1861], ["Robinson Crusoe", "Daniel Defoe", 320, 1719], ["Gulliver's Travels", "Jonathan Swift", 306, 1726], ["The Three Musketeers", "Alexandre Dumas", 625, 1844], ["Around the World in Eighty Days", "Jules Verne", 252, 1872], ["Twenty Thousand Leagues Under the Seas", "Jules Verne", 394, 1870], ["Journey to the Center of the Earth", "Jules Verne", 183, 1864], ["The Hound of the Baskervilles", "Arthur Conan Doyle", 248, 1902], ["A Study in Scarlet", "Arthur Conan Doyle", 108, 1887]];
  const head = ["Book Id", "Title", "Author", "Author l-f", "Additional Authors", "ISBN", "ISBN13", "My Rating", "Average Rating", "Publisher", "Binding", "Number of Pages", "Year Published", "Original Publication Year", "Date Read", "Date Added", "Bookshelves", "Bookshelves with positions", "Exclusive Shelf", "My Review", "Spoiler", "Private Notes", "Read Count", "Owned Copies"];
  const rows: unknown[][] = [head];
  const ymd = (d: Date) => `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
  BOOKS.forEach(([title, author, pages, orig], i) => {
    let shelf: string, read: Date | null = null, added: Date;
    if (i < 31) { shelf = "read"; const y = i < 24 ? 2025 : 2024; const doy = y === 2025 ? int(5, 360) : int(30, 360); read = new Date(Date.UTC(y, 0, 1) + doy * 864e5); added = new Date(read.getTime() - int(20, 200) * 864e5); }
    else if (i < 33) { shelf = "currently-reading"; added = new Date(Date.UTC(2026, int(0, 2), int(1, 28))); }
    else { shelf = "to-read"; added = new Date(Date.UTC(int(2023, 2026), int(0, 8), int(1, 28))); }
    if (title === "Les Miserables") { shelf = "read"; read = new Date(Date.UTC(2025, 7, 30)); added = new Date(Date.UTC(2025, 5, 1)); }
    const rating = shelf === "read" ? (rnd() < 0.15 ? 0 : pick([3, 4, 4, 4, 5, 5, 2])) : 0;
    const isbn = String(int(100000000, 999999999)) + int(0, 9);
    const [first, ...rest] = author.split(" ");
    const shelves = shelf === "read" && rnd() < 0.4 ? pick(["classics", "favorites", "book-club", "classics, favorites"]) : "";
    rows.push([int(1000, 99999999), title, author, rest.length ? `${rest.join(" ")}, ${first}` : author, "", `="${isbn}"`, `="978${isbn}"`, rating, between(3.5, 4.3).toFixed(2), pick(["Public Domain Press", "Lighthouse Classics", "Harbor Books"]), pick(["Paperback", "Paperback", "Kindle Edition", "Hardcover"]), pages, int(1995, 2022), orig, read ? ymd(read) : "", ymd(added), shelves, shelves ? shelves.split(", ").map((s, k) => `${s} (#${k + 1})`).join(", ") : "", shelf, rnd() < 0.15 && shelf === "read" ? "Loved the ending.\nWould reread." : "", "", "", shelf === "read" ? 1 : 0, rnd() < 0.3 ? 1 : 0]);
  });
  writeFileSync(OUT + "reading-list.csv", csv(rows));
}

// 3. Bank account CSV, US style (MM/DD/YYYY, negative = money out, store numbers in descriptions, newest first)
{
  const head = ["Details", "Posting Date", "Description", "Amount", "Type", "Balance", "Check or Slip #"];
  const MERCH: [string, number, number, number, string[] | null][] = [["BEAN THERE CAFE #%s AUSTIN TX", 4.5, 7.5, 0.55, ["0412", "0977", "1203"]], ["GREENLEAF MARKET #%s AUSTIN TX", 25, 110, 0.28, ["88", "141"]], ["METRO TRANSIT FARE", 2.5, 2.5, 0.35, null], ["RIDEPOOL *TRIP %s", 9, 32, 0.08, ["HELP.RIDEPOOL", "AUSTIN"]], ["NOODLE BAR %s", 14, 38, 0.12, ["DOWNTOWN", "EAST 6TH"]], ["CORNER BOOKSHOP", 12, 45, 0.04, null], ["PIXELPLAY GAMES ONLINE", 9.99, 59.99, 0.02, null], ["FRESHBOX MEAL KIT", 64.95, 64.95, 0.035, null]];
  const rows: unknown[][] = [head];
  let bal = 4200;
  const tx: [Date, string, number, string][] = [];
  for (const d of days("2025-01-01", "2026-02-28")) {
    const dd = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear(), dow = d.getUTCDay();
    if (dd === 1) tx.push([d, "OAKWOOD APTS RENT PPD ID: 7741", -1650, "ACH_DEBIT"]);
    if (dd === 15 || dd === new Date(Date.UTC(y, m + 1, 0)).getUTCDate()) tx.push([d, "ACME ROBOTICS PAYROLL PPD ID: 9001", 2380.55, "ACH_CREDIT"]);
    if (dd === 5) tx.push([d, "STREAMFLIX.COM MONTHLY", -15.49, "DEBIT_CARD"]);
    if (dd === 8) tx.push([d, "IRONWORKS GYM MEMBERSHIP", -49, "DEBIT_CARD"]);
    if (dd === 20) tx.push([d, "CITY POWER & LIGHT AUTOPAY", -Math.round(between(55, m >= 5 && m <= 8 ? 180 : 95) * 100) / 100, "ACH_DEBIT"]);
    for (const [name, lo, hi, p, stores] of MERCH) {
      const boost = name.startsWith("BEAN") && dow >= 1 && dow <= 5 ? 1.3 : 1;
      if (rnd() < p * boost) tx.push([d, name.replace("%s", stores ? pick(stores) : "").trim(), -Math.round(between(lo, hi) * 100) / 100, "DEBIT_CARD"]);
    }
    if (y === 2025 && m === 6 && dd === 12) tx.push([d, "SKYBRIDGE AIRLINES 0062291 TICKET", -742.3, "DEBIT_CARD"]);
    if (y === 2025 && m === 10 && dd === 28) tx.push([d, "BRIGHTSPARK ELECTRONICS #19", -1299.99, "DEBIT_CARD"]);
    if (y === 2025 && m === 3 && dd === 18) tx.push([d, "IRS TREAS 310 TAX REF", 612, "ACH_CREDIT"]);
    if (rnd() < 0.02) tx.push([d, "ATM WITHDRAWAL 00431 CONGRESS AVE", -pick([40, 60, 100]), "ATM"]);
  }
  for (const [d, desc, amt, type] of tx) {
    bal = Math.round((bal + amt) * 100) / 100;
    rows.push([amt < 0 ? "DEBIT" : "CREDIT", `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()}`, desc, amt.toFixed(2), type, bal.toFixed(2), ""]);
  }
  rows.splice(1, 0, ...rows.splice(1).reverse());
  writeFileSync(OUT + "bank-account.csv", csv(rows));
}

// 4. Watch history (Google Takeout-style JSON: nested, ads, removed videos, UTC timestamps of a Paris viewer)
{
  const CH: [string, number, string[]][] = [["Kitchen Lab", 0.16, ["Sourdough in 10 steps", "The 5-minute pasta sauce", "Why your rice is mushy", "Knife skills for beginners", "Ramen from scratch"]], ["Pixel Garage", 0.12, ["I rebuilt a 1998 laptop", "Tiny Linux server under $50", "Fixing a dead keyboard", "Retro console teardown"]], ["Daily Lo-Fi Beats", 0.2, ["lofi beats to study to", "rainy night lofi mix", "3 AM coding playlist"]], ["Chess Corner", 0.14, ["The trap every beginner falls for", "Endgames you must know", "Speedrun to 1500 part 12"]], ["Trail Talks", 0.07, ["Hiking 40 km in a day", "Ultralight packing list", "Camping in the rain"]], ["Explained Simply", 0.1, ["How does GPS actually work?", "Why is the sky blue (really)", "Compound interest in 6 minutes"]], ["Night Desk News", 0.06, ["Weekly recap", "This week in science", "Morning briefing"]], ["Gamer Grandpa", 0.08, ["Let's play part 34", "Boss fight no damage", "Speedrun attempt"]]];
  type Item = Record<string, unknown> & { time: string };
  const items: Item[] = [];
  for (const d of days("2025-01-01", "2026-01-31")) {
    const n = Math.max(0, Math.round(between(2, 9) + (d.getUTCDay() % 6 === 0 ? 4 : 0) + (d.getUTCMonth() === 11 ? 3 : 0)));
    for (let i = 0; i < n; i++) {
      const localHour = rnd() < 0.55 ? int(21, 23) : rnd() < 0.3 ? int(0, 1) : int(7, 20);
      const t = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), localHour, int(0, 59), int(0, 59), int(0, 999)); // local (Paris) time
      const r = rnd();
      let acc = 0, ch = CH[0];
      for (const c of CH) { acc += c[1]; if (r < acc) { ch = c; break; } }
      const vid = Math.floor(rnd() * 36 ** 8).toString(36).padStart(11, "x");
      if (rnd() < 0.06) { items.push({ header: "YouTube", title: `Watched ${pick(["Try the new FreshBox meal kit", "Upgrade your phone today", "Learn piano in 30 days"])}`, titleUrl: `https://www.youtube.com/watch?v=${vid}`, time: t.toISOString(), products: ["YouTube"], details: [{ name: "From Google Ads" }], activityControls: ["Web & App Activity", "YouTube watch history", "YouTube search history"] }); continue; }
      if (rnd() < 0.03) { items.push({ header: "YouTube", title: "Watched a video that has been removed", time: t.toISOString(), products: ["YouTube"], activityControls: ["YouTube watch history"] }); continue; }
      items.push({ header: rnd() < 0.08 ? "YouTube Music" : "YouTube", title: `Watched ${pick(ch[2])}`, titleUrl: `https://www.youtube.com/watch?v=${vid}`, subtitles: [{ name: ch[0], url: `https://www.youtube.com/channel/UC${ch[0].replace(/\W/g, "")}` }], time: t.toISOString(), products: ["YouTube"], activityControls: ["YouTube watch history"] });
    }
  }
  items.sort((a, b) => b.time.localeCompare(a.time));
  writeFileSync(OUT + "watch-history.json", JSON.stringify(items, null, 2));
}

// 5. Sleep diary from an unknown app: French headers, semicolons, decimal commas, DD/MM/YYYY, bedtimes across midnight
{
  const rows: unknown[][] = [["date", "coucher", "réveil", "durée (h)", "qualité (1-5)", "réveils nocturnes", "café après 16h", "notes"]];
  for (const d of days("2025-03-01", "2026-02-15")) {
    if (rnd() < 0.12) continue;
    const late = d.getUTCDay() === 5 || d.getUTCDay() === 6;
    const bedMin = (late ? int(23 * 60 + 30, 25 * 60 + 30) : int(22 * 60 + 30, 24 * 60 + 15)) % 1440;
    const dur = between(late ? 6.2 : 6.8, late ? 9.2 : 8.3) - (d.getUTCMonth() === 11 ? 0.6 : 0);
    const wake = Math.round(bedMin + dur * 60) % 1440;
    const coffee = rnd() < 0.25;
    const q5 = Math.max(1, Math.min(5, Math.round(dur - 3.6 - (coffee ? 0.8 : 0) + between(-0.7, 0.7))));
    rows.push([`${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, `${pad(Math.floor(bedMin / 60))}:${pad(bedMin % 60)}`, `${pad(Math.floor(wake / 60))}:${pad(wake % 60)}`, dur.toFixed(1).replace(".", ","), q5, int(0, 3), coffee ? "oui" : "non", rnd() < 0.08 ? pick(["voisins bruyants", "cauchemar", "chat qui miaule", "trop chaud"]) : ""]);
  }
  writeFileSync(OUT + "sleep-diary.csv", csv(rows, ";"));
}

writeFileSync(OUT + "README.txt", "Sample exports for Anywrap. All data in these files is made up (fixed random seed, scripts/make-samples.ts).\nMerchants, channels, gear and people are fictional; book titles are public-domain classics.\n");
console.log("samples written to public/samples/");
