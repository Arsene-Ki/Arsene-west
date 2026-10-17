const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ------------------------- SETTINGS (edit these) ------------------------- */
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tzco2026';
const BUSINESS = {
  name: 'TZCO Printing & Design',
  phone: '+255 747072438',
  whatsapp: '255747072438',            // no + sign
  email: 'info@tzco.co.tz',
  address: 'Arusha, Tanzania',
  hours: 'Mon–Sat: 8:00 – 18:00',
  mapLat: -6.1630,                     // change to your shop's exact location
  mapLng: 35.7516
};
const DATA_FILE = path.join(__dirname, 'data.json');

/* ------------------------------- DATA ------------------------------------ */
const SERVICES = [
  { id: 'cards',    icon: '💳', name: 'Business Cards',       desc: 'Premium paper, matte or gloss, spot UV and more.',  price: 50000,  unit: 'per 100 cards' },
  { id: 'flyers',   icon: '📄', name: 'Flyers & Brochures',   desc: 'Full-colour A5/A4 flyers, tri-fold and bi-fold brochures.', price: 45000,  unit: 'per 100 pieces' },
  { id: 'banners',  icon: '🚩', name: 'Banners & Roll-ups',   desc: 'Durable large-format banners for events and shops.',  price: 25000,  unit: 'per 1 square meter' },
  { id: 'tshirts',  icon: '👕', name: 'T-Shirt Printing',     desc: 'Custom shirts, caps and uniforms with lasting prints.',  price: 15000,  unit: 'per piece' },
  { id: 'branding', icon: '🎨', name: 'Logo & Branding',      desc: 'Logos, brand identity, stationery and social media kits.',  price: 150000, unit: 'per project' },
  { id: 'stickers', icon: '🏷️', name: 'Stickers & Labels',    desc: 'Die-cut stickers and product labels, waterproof options.',  price: 30000,  unit: 'per 100 pieces' },
  { id: 'posters',  icon: '🖼️', name: 'Posters & Large Format', desc: 'Sharp posters, A3 to A0, photo and canvas prints.',price: 20000,  unit: 'per poster' },
  { id: 'gifts',    icon: '☕', name: 'Mugs & Gifts',          desc: 'Personalised mugs, notebooks, pens and corporate gifts.',  price: 12000,  unit: 'per item' }
];

const WORKS = [
  { id: 1,  title: 'Savanna Coffee Business Cards', cat: 'Cards',    emoji: '💳', c1: '#0b4f94', c2: '#1aa0c8', note: 'Soft-touch matte with gold foil logo.' },
  { id: 2,  title: 'Kilimanjaro Tours Brochure',    cat: 'Print',    emoji: '🏔️', c1: '#1f9d55', c2: '#0b4f94', note: 'Tri-fold, 170gsm gloss, full colour.' },
  { id: 3,  title: 'Dodoma Fest Event Banner',      cat: 'Banners',  emoji: '🚩', c1: '#f2c21b', c2: '#e0661a', note: '3m × 1m weatherproof vinyl banner.' },
  { id: 4,  title: 'Mwanza Fitness T-Shirts',       cat: 'Apparel',  emoji: '👕', c1: '#1d2430', c2: '#1aa0c8', note: '120 team shirts, screen-printed.' },
  { id: 5,  title: 'Zawadi Bakery Brand Identity',  cat: 'Branding', emoji: '🎨', c1: '#d6336c', c2: '#f2c21b', note: 'Logo, labels, packaging and menu.' },
  { id: 6,  title: 'Product Label Set',             cat: 'Print',    emoji: '🏷️', c1: '#0b4f94', c2: '#1f9d55', note: 'Waterproof die-cut labels.' },
  { id: 7,  title: 'Wedding Invitation Cards',      cat: 'Cards',    emoji: '💌', c1: '#8e44ad', c2: '#e056a0', note: 'Embossed cards with envelopes.' },
  { id: 8,  title: 'Shop Signage & Roll-up',        cat: 'Banners',  emoji: '🏪', c1: '#1aa0c8', c2: '#1f9d55', note: 'Indoor & outdoor signage package.' },
  { id: 9,  title: 'Corporate Mugs & Notebooks',    cat: 'Apparel',  emoji: '☕', c1: '#e0661a', c2: '#1d2430', note: 'Company gift sets with logo.' },
  { id: 10, title: 'NGO Annual Report',             cat: 'Print',    emoji: '📘', c1: '#0b4f94', c2: '#8e44ad', note: '48-page perfect-bound report.' },
  { id: 11, title: 'Restaurant Menu Design',        cat: 'Branding', emoji: '🍽️', c1: '#c0392b', c2: '#f2c21b', note: 'Menu layout + laminated print.' },
  { id: 12, title: 'Real Estate Posters',           cat: 'Banners',  emoji: '🏠', c1: '#16a085', c2: '#0b4f94', note: 'A1 posters, UV-resistant ink.' }
];

const STATUSES = ['New', 'In design', 'In printing', 'Ready for pickup', 'Delivered', 'Cancelled'];

/* --------------------------- tiny JSON database -------------------------- */
function loadDB() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return { orders: [] }; }
}
function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

/* ------------------------------- helpers --------------------------------- */
function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 100000) { req.destroy(); reject(new Error('too large')); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const clean = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max || 200);
function newRef() { return 'TZ-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function isAdmin(req) { return req.headers['x-admin-password'] === ADMIN_PASSWORD; }

/* --------------------------------- SERVER -------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    /* ----- pages ----- */
    if (req.method === 'GET' && p === '/') return send(res, 200, SITE_HTML, 'text/html; charset=utf-8');
    if (req.method === 'GET' && p === '/admin') return send(res, 200, ADMIN_HTML, 'text/html; charset=utf-8');

    /* ----- logo (put logo.png next to this file) ----- */
    if (req.method === 'GET' && p === '/logo') {
      const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };
      for (const ext of Object.keys(types)) {
        const f = path.join(__dirname, 'logo.' + ext);
        if (fs.existsSync(f)) return send(res, 200, fs.readFileSync(f), types[ext]);
      }
      return send(res, 404, 'no logo', 'text/plain');
    }

    /* ----- public API ----- */
    if (req.method === 'GET' && p === '/api/config')   return send(res, 200, BUSINESS);
    if (req.method === 'GET' && p === '/api/services') return send(res, 200, SERVICES);
    if (req.method === 'GET' && p === '/api/works')    return send(res, 200, WORKS);

    if (req.method === 'POST' && p === '/api/orders') {
      const b = await readBody(req);
      const service = SERVICES.find(s => s.id === b.service);
      const order = {
        ref: newRef(),
        name: clean(b.name, 80),
        phone: clean(b.phone, 30),
        email: clean(b.email, 120),
        service: service ? service.name : '',
        quantity: Math.max(1, Math.min(100000, parseInt(b.quantity, 10) || 1)),
        deadline: clean(b.deadline, 20),
        delivery: b.delivery === 'delivery' ? 'Delivery' : 'Pickup',
        details: clean(b.details, 1500),
        estimate: service ? service.price * (parseFloat(b.quantity) || 1) : 0,
        status: 'New',
        createdAt: new Date().toISOString()
      };
      if (!order.name || !order.phone || !service) return send(res, 400, { error: 'Please fill in your name, phone and service.' });
      const db = loadDB();
      db.orders.unshift(order);
      saveDB(db);
      console.log('New order ' + order.ref + ' from ' + order.name);
      return send(res, 201, { ok: true, ref: order.ref, estimate: order.estimate });
    }

    if (req.method === 'GET' && p === '/api/track') {
      const ref = clean(url.searchParams.get('ref'), 20).toUpperCase();
      const o = loadDB().orders.find(x => x.ref === ref);
      if (!o) return send(res, 404, { error: 'No order found with that reference.' });
      return send(res, 200, { ref: o.ref, service: o.service, status: o.status, createdAt: o.createdAt, deadline: o.deadline });
    }

    /* ----- admin API ----- */
    if (p === '/api/admin/orders' && req.method === 'GET') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password' });
      return send(res, 200, { orders: loadDB().orders, statuses: STATUSES });
    }
    if (p.startsWith('/api/admin/orders/') && req.method === 'PATCH') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password' });
      const ref = decodeURIComponent(p.split('/').pop());
      const b = await readBody(req);
      const db = loadDB();
      const o = db.orders.find(x => x.ref === ref);
      if (!o) return send(res, 404, { error: 'Not found' });
      if (STATUSES.includes(b.status)) o.status = b.status;
      saveDB(db);
      return send(res, 200, { ok: true });
    }
    if (p.startsWith('/api/admin/orders/') && req.method === 'DELETE') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password' });
      const ref = decodeURIComponent(p.split('/').pop());
      const db = loadDB();
      db.orders = db.orders.filter(x => x.ref !== ref);
      saveDB(db);
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log('\n  TZCO website running →  http://localhost:' + PORT);
  console.log('  Admin dashboard      →  http://localhost:' + PORT + '/admin  (password: ' + ADMIN_PASSWORD + ')\n');
});

/* =====================================================================
   FRONTEND  (HTML + CSS + JS) — served at  /
   NOTE: no backticks or dollar-brace inside this block (it is a template).
   ===================================================================== */
const SITE_HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TZCO Printing & Design — Creativity • Quality • Service</title>
<meta name="description" content="TZCO Printing & Design: business cards, banners, T-shirts, branding and more in Tanzania.">
<link rel="icon" href="/logo">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<style>
:root{
  --blue:#0b4f94; --blue-d:#073766; --teal:#1aa0c8; --green:#1f9d55; --yellow:#f2c21b;
  --cyan:#00aeef; --magenta:#ec008c; --ink:#1d2430; --muted:#5d6878; --bg:#f6f9fc; --card:#ffffff;
  --radius:18px; --shadow:0 10px 30px rgba(11,79,148,.12);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Poppins',system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;overflow-x:hidden}
img{max-width:100%}
a{color:inherit;text-decoration:none}
.container{width:min(1180px,92%);margin:auto}
section{padding:90px 0}
.eyebrow{display:inline-block;font-weight:600;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-bottom:10px}
h2.title{font-size:clamp(1.8rem,4vw,2.6rem);font-weight:800;line-height:1.2;color:var(--blue-d)}
.lead{color:var(--muted);max-width:620px;margin-top:12px}
.center{text-align:center}.center .lead{margin-inline:auto}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:50px;font-weight:600;border:0;cursor:pointer;font-family:inherit;font-size:1rem;transition:.25s}
.btn-primary{background:linear-gradient(135deg,var(--blue),var(--teal));color:#fff;box-shadow:0 8px 20px rgba(11,79,148,.3)}
.btn-primary:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(11,79,148,.4)}
.btn-ghost{background:#fff;color:var(--blue);border:2px solid var(--blue)}
.btn-ghost:hover{background:var(--blue);color:#fff;transform:translateY(-3px)}

/* ---------- header ---------- */
header{position:fixed;inset:0 0 auto 0;z-index:50;transition:.3s;padding:14px 0}
header.scrolled{background:rgba(255,255,255,.92);backdrop-filter:blur(12px);box-shadow:0 4px 20px rgba(0,0,0,.08);padding:8px 0}
.nav{display:flex;align-items:center;justify-content:space-between;gap:20px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;color:var(--blue-d)}
.brand img{height:52px;width:auto;display:block}
.brand .fallback{display:none;font-size:1.5rem;letter-spacing:.04em}
.brand .fallback span{color:var(--teal)}
nav ul{display:flex;gap:26px;list-style:none;align-items:center}
nav a.link{font-weight:500;font-size:.95rem;position:relative;padding:4px 0}
nav a.link::after{content:"";position:absolute;left:0;bottom:-2px;height:2px;width:0;background:var(--teal);transition:.3s}
nav a.link:hover::after{width:100%}
.burger{display:none;background:none;border:0;font-size:1.8rem;cursor:pointer;color:var(--blue-d)}

/* ---------- hero ---------- */
.hero{min-height:100vh;display:flex;align-items:center;padding-top:110px;position:relative;overflow:hidden;
  background:radial-gradient(circle at 85% 20%,rgba(26,160,200,.18),transparent 45%),radial-gradient(circle at 10% 90%,rgba(31,157,85,.14),transparent 45%),#fff}
.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:50px;align-items:center}
.hero h1{font-size:clamp(2.3rem,6vw,4rem);font-weight:800;line-height:1.1;color:var(--blue-d)}
.hero h1 .grad{background:linear-gradient(90deg,var(--teal),var(--green),var(--yellow));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{color:var(--muted);font-size:1.1rem;margin:20px 0 32px;max-width:520px}
.hero .cta{display:flex;gap:14px;flex-wrap:wrap}
.tagline{display:flex;gap:14px;margin-top:34px;font-weight:600;color:var(--blue-d);flex-wrap:wrap}
.tagline span::before{content:"●";color:var(--teal);margin-right:6px}
.hero-art{position:relative;height:480px}
.blob{position:absolute;border-radius:50%;filter:blur(2px);animation:float 7s ease-in-out infinite}
.b1{width:120px;height:120px;background:var(--cyan);top:6%;left:10%;opacity:.9}
.b2{width:90px;height:90px;background:var(--magenta);top:20%;right:6%;animation-delay:1.2s;opacity:.9}
.b3{width:70px;height:70px;background:var(--yellow);bottom:14%;left:22%;animation-delay:2.2s}
.b4{width:100px;height:100px;background:var(--ink);bottom:6%;right:14%;animation-delay:.6s}
.hero-card{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:78%;background:#fff;border-radius:26px;padding:34px;box-shadow:0 30px 60px rgba(11,79,148,.2);text-align:center;animation:float 6s ease-in-out infinite}
.hero-card img{max-height:170px;max-width:100%;object-fit:contain}
.hero-card .fallback{display:none;font-size:3.5rem;font-weight:800;color:var(--blue)}
.hero-card small{display:block;margin-top:14px;color:var(--muted);font-weight:600;letter-spacing:.12em}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
.hero-card{animation-name:floatc}
@keyframes floatc{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,-56%)}}

/* ---------- stats ---------- */
.stats{background:linear-gradient(120deg,var(--blue-d),var(--blue) 55%,var(--teal));color:#fff;padding:50px 0}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;text-align:center}
.stats b{display:block;font-size:2.6rem;font-weight:800}
.stats span{opacity:.85;font-size:.95rem}

/* ---------- services ---------- */
.grid{display:grid;gap:24px;margin-top:50px}
.services-grid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.service{background:var(--card);border-radius:var(--radius);padding:30px 26px;box-shadow:var(--shadow);transition:.3s;position:relative;overflow:hidden;border-top:4px solid transparent}
.service:hover{transform:translateY(-8px);border-top-color:var(--teal)}
.service .ic{font-size:2.2rem;width:64px;height:64px;display:grid;place-items:center;background:linear-gradient(135deg,#e7f4fb,#eaf8ef);border-radius:16px;margin-bottom:16px}
.service h3{font-size:1.1rem;color:var(--blue-d);margin-bottom:6px}
.service p{color:var(--muted);font-size:.92rem}
.service .price{margin-top:14px;font-weight:700;color:var(--green);font-size:.95rem}
.service .price small{color:var(--muted);font-weight:500}
.service button{margin-top:14px;background:none;border:0;color:var(--blue);font-weight:600;cursor:pointer;font-family:inherit;font-size:.95rem}
.service button:hover{color:var(--teal)}

/* ---------- process ---------- */
.process{background:#fff}
.steps{grid-template-columns:repeat(auto-fit,minmax(200px,1fr));counter-reset:s}
.step{text-align:center;padding:10px 14px;position:relative}
.step::before{counter-increment:s;content:counter(s);display:grid;place-items:center;width:62px;height:62px;margin:0 auto 14px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--teal));color:#fff;font-weight:800;font-size:1.4rem;box-shadow:0 8px 18px rgba(11,79,148,.3)}
.step h4{color:var(--blue-d)}.step p{color:var(--muted);font-size:.9rem}

/* ---------- portfolio ---------- */
.filters{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:30px 0 10px}
.filters button{padding:9px 22px;border-radius:30px;border:2px solid #d9e4ee;background:#fff;font-family:inherit;font-weight:600;color:var(--muted);cursor:pointer;transition:.25s}
.filters button.active,.filters button:hover{background:var(--blue);border-color:var(--blue);color:#fff}
.works-grid{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}
.work{border-radius:var(--radius);overflow:hidden;cursor:pointer;position:relative;aspect-ratio:4/3;box-shadow:var(--shadow);transition:.35s;display:grid;place-items:center;color:#fff}
.work:hover{transform:translateY(-6px) scale(1.02)}
.work .emo{font-size:4.2rem;filter:drop-shadow(0 6px 10px rgba(0,0,0,.25));transition:.4s}
.work:hover .emo{transform:scale(1.2) rotate(-6deg)}
.work .cap{position:absolute;inset:auto 0 0 0;padding:40px 18px 16px;background:linear-gradient(transparent,rgba(0,0,0,.65))}
.work .cap b{display:block;font-size:1rem}.work .cap span{font-size:.78rem;opacity:.85;text-transform:uppercase;letter-spacing:.1em}
.work.hide{display:none}
.modal{position:fixed;inset:0;background:rgba(7,20,40,.8);display:none;place-items:center;z-index:100;padding:20px;backdrop-filter:blur(4px)}
.modal.open{display:grid;animation:fade .25s}
.modal-box{background:#fff;border-radius:22px;max-width:520px;width:100%;overflow:hidden;position:relative}
.modal-top{height:260px;display:grid;place-items:center;font-size:6rem;color:#fff}
.modal-body{padding:26px}
.modal-body h3{color:var(--blue-d);margin-bottom:6px}.modal-body p{color:var(--muted);margin-bottom:18px}
.close{position:absolute;top:12px;right:14px;background:rgba(255,255,255,.9);border:0;width:38px;height:38px;border-radius:50%;font-size:1.3rem;cursor:pointer}
@keyframes fade{from{opacity:0}to{opacity:1}}

/* ---------- order ---------- */
.order{background:linear-gradient(180deg,#eaf4fb,#f6f9fc)}
.order-wrap{display:grid;grid-template-columns:1.3fr .9fr;gap:34px;margin-top:46px;align-items:start}
form,.side-card{background:#fff;border-radius:var(--radius);padding:34px;box-shadow:var(--shadow)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
label{display:block;font-weight:600;font-size:.88rem;margin:14px 0 6px;color:var(--blue-d)}
input,select,textarea{width:100%;padding:13px 15px;border:2px solid #e1e9f1;border-radius:12px;font-family:inherit;font-size:.95rem;background:#fbfdff;transition:.2s;color:var(--ink)}
input:focus,select:focus,textarea:focus{outline:0;border-color:var(--teal);box-shadow:0 0 0 4px rgba(26,160,200,.15)}
textarea{min-height:110px;resize:vertical}
.radios{display:flex;gap:12px}
.radios label{flex:1;margin:0;border:2px solid #e1e9f1;border-radius:12px;padding:12px;text-align:center;cursor:pointer;font-weight:500;transition:.2s}
.radios input{display:none}
.radios input:checked+span{color:var(--blue);font-weight:700}
.radios label:has(input:checked){border-color:var(--teal);background:#eaf8fd}
.estimate{margin:22px 0 6px;padding:16px 20px;border-radius:14px;background:linear-gradient(135deg,#eaf8ef,#e7f4fb);display:flex;justify-content:space-between;align-items:center;font-weight:600}
.estimate b{font-size:1.5rem;color:var(--green)}
.note{font-size:.78rem;color:var(--muted);margin-bottom:18px}
.msg{padding:14px 18px;border-radius:12px;margin-top:16px;font-weight:500;display:none}
.msg.ok{display:block;background:#e6f7ee;color:#116a39}.msg.err{display:block;background:#fdeaea;color:#a12a2a}
.side-card h3{color:var(--blue-d);margin-bottom:8px}
.side-card+.side-card{margin-top:24px}
.track-res{margin-top:16px;display:none}
.timeline{list-style:none;margin-top:14px;position:relative;padding-left:26px}
.timeline li{position:relative;padding:6px 0;color:var(--muted);font-size:.92rem}
.timeline li::before{content:"";position:absolute;left:-26px;top:11px;width:14px;height:14px;border-radius:50%;background:#d9e4ee}
.timeline li.done{color:var(--ink);font-weight:600}.timeline li.done::before{background:var(--green)}
.timeline li.now::before{background:var(--teal);box-shadow:0 0 0 5px rgba(26,160,200,.25)}

/* ---------- testimonials ---------- */
.t-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.testi{background:#fff;padding:30px;border-radius:var(--radius);box-shadow:var(--shadow);position:relative}
.testi::before{content:"“";font-family:'Playfair Display',serif;font-size:5rem;color:var(--teal);opacity:.25;position:absolute;top:-6px;left:18px}
.testi p{margin-top:22px;color:var(--ink)}.testi .who{margin-top:16px;font-weight:700;color:var(--blue-d)}.testi .who small{display:block;color:var(--muted);font-weight:500}
.stars{color:var(--yellow);letter-spacing:3px}

/* ---------- contact ---------- */
.contact{background:#fff}
.contact-grid{display:grid;grid-template-columns:.9fr 1.3fr;gap:34px;margin-top:46px}
.info{display:grid;gap:16px;align-content:start}
.info-item{display:flex;gap:16px;align-items:center;background:var(--bg);border-radius:16px;padding:18px 20px}
.info-item .ic{font-size:1.5rem;width:50px;height:50px;border-radius:14px;background:#fff;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.06)}
.info-item small{display:block;color:var(--muted)}.info-item b{color:var(--blue-d)}
.map{border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);min-height:420px}
.map iframe{width:100%;height:100%;min-height:420px;border:0}

/* ---------- footer ---------- */
footer{background:var(--blue-d);color:#cfe0f1;padding:50px 0 24px}
.foot{display:flex;justify-content:space-between;gap:30px;flex-wrap:wrap}
.foot h4{color:#fff;margin-bottom:10px}.foot a{display:block;opacity:.85;margin:4px 0}.foot a:hover{opacity:1;color:var(--yellow)}
.cmyk{display:flex;gap:8px;margin-top:14px}.cmyk i{width:14px;height:14px;border-radius:50%}
.copy{border-top:1px solid rgba(255,255,255,.15);margin-top:30px;padding-top:18px;text-align:center;font-size:.85rem;opacity:.8}
.wa{position:fixed;right:22px;bottom:22px;z-index:60;width:60px;height:60px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;font-size:1.8rem;box-shadow:0 10px 24px rgba(37,211,102,.5);animation:pulse 2.2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(37,211,102,.6)}70%{box-shadow:0 0 0 18px rgba(37,211,102,0)}100%{box-shadow:0 0 0 0 rgba(37,211,102,0)}}
.top{position:fixed;right:30px;bottom:94px;z-index:60;width:44px;height:44px;border-radius:50%;border:0;background:var(--blue);color:#fff;cursor:pointer;opacity:0;pointer-events:none;transition:.3s;font-size:1.2rem}
.top.show{opacity:1;pointer-events:auto}

/* ---------- reveal ---------- */
.reveal{opacity:0;transform:translateY(34px);transition:opacity .7s,transform .7s}
.reveal.in{opacity:1;transform:none}

/* ---------- responsive ---------- */
@media(max-width:900px){
  .hero-grid,.order-wrap,.contact-grid{grid-template-columns:1fr}
  .hero-art{height:340px}.stats-grid{grid-template-columns:repeat(2,1fr)}
  .burger{display:block}
  nav ul{position:fixed;top:0;right:-100%;height:100vh;width:min(300px,80%);background:#fff;flex-direction:column;justify-content:center;gap:28px;box-shadow:-10px 0 30px rgba(0,0,0,.15);transition:.35s}
  nav ul.open{right:0}
  .row{grid-template-columns:1fr}
  section{padding:70px 0}
}
</style>
</head>
<body>

<header id="header">
  <div class="container nav">
    <a href="#home" class="brand">
      <img src="/logo" alt="TZCO Printing & Design logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <span class="fallback">TZ<span>CO</span></span>
    </a>
    <nav>
      <ul id="menu">
        <li><a class="link" href="#home">Home</a></li>
        <li><a class="link" href="#services">Services</a></li>
        <li><a class="link" href="#work">Our Work</a></li>
        <li><a class="link" href="#order">Order</a></li>
        <li><a class="link" href="#contact">Contact</a></li>
        <li><a class="btn btn-primary" href="#order" style="padding:10px 22px">Place Order</a></li>
      </ul>
    </nav>
    <button class="burger" id="burger" aria-label="Menu">☰</button>
  </div>
</header>

<!-- ============ HERO ============ -->
<section class="hero" id="home">
  <div class="container hero-grid">
    <div class="reveal">
      <span class="eyebrow">Printing & Design Studio • Tanzania</span>
      <h1>We turn your ideas into <span class="grad">vivid prints</span> that get noticed.</h1>
      <p>From business cards to giant banners, T-shirts to complete brand identities — TZCO delivers sharp colours, premium finishes and friendly service, on time.</p>
      <div class="cta">
        <a href="#order" class="btn btn-primary">🛒 Reserve an Order</a>
        <a href="#work" class="btn btn-ghost">View Our Work</a>
      </div>
      <div class="tagline"><span>Creativity</span><span>Quality</span><span>Service</span></div>
    </div>
    <div class="hero-art reveal">
      <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="blob b4"></div>
      <div class="hero-card">
        <img src="/logo" alt="TZCO logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="fallback">TZCO</div>
        <small>PRINTING & DESIGN</small>
      </div>
    </div>
  </div>
</section>

<!-- ============ STATS ============ -->
<div class="stats">
  <div class="container stats-grid">
    <div><b data-count="1500">0</b><span>Projects delivered</span></div>
    <div><b data-count="600">0</b><span>Happy clients</span></div>
    <div><b data-count="8">0</b><span>Core services</span></div>
    <div><b data-count="24">0</b><span>Hour express options</span></div>
  </div>
</div>

<!-- ============ SERVICES ============ -->
<section id="services">
  <div class="container center">
    <span class="eyebrow">What we do</span>
    <h2 class="title reveal">Services built around your brand</h2>
    <p class="lead reveal">Pick a service, see an instant estimate and reserve your order online in under a minute.</p>
    <div class="grid services-grid" id="servicesGrid"></div>
  </div>
</section>

<!-- ============ PROCESS ============ -->
<section class="process">
  <div class="container center">
    <span class="eyebrow">How it works</span>
    <h2 class="title reveal">Four simple steps</h2>
    <div class="grid steps reveal">
      <div class="step"><h4>Reserve</h4><p>Fill the order form and get a tracking code instantly.</p></div>
      <div class="step"><h4>Design</h4><p>We confirm details and prepare a proof for your approval.</p></div>
      <div class="step"><h4>Print</h4><p>Your job is printed with premium inks and materials.</p></div>
      <div class="step"><h4>Receive</h4><p>Pick up at our shop or get it delivered to you.</p></div>
    </div>
  </div>
</section>

<!-- ============ PORTFOLIO ============ -->
<section id="work">
  <div class="container center">
    <span class="eyebrow">Portfolio</span>
    <h2 class="title reveal">Our recent work</h2>
    <p class="lead reveal">A taste of what we have produced for businesses, events and families.</p>
    <div class="filters" id="filters"></div>
    <div class="grid works-grid" id="worksGrid" style="text-align:left"></div>
  </div>
</section>
<div class="modal" id="modal"><div class="modal-box">
  <button class="close" id="mClose">✕</button>
  <div class="modal-top" id="mTop"></div>
  <div class="modal-body"><h3 id="mTitle"></h3><p id="mNote"></p><a href="#order" class="btn btn-primary" id="mOrder">Order something similar</a></div>
</div></div>

<!-- ============ ORDER ============ -->
<section class="order" id="order">
  <div class="container">
    <div class="center">
      <span class="eyebrow">Reserve</span>
      <h2 class="title reveal">Place your order online</h2>
      <p class="lead reveal">Tell us what you need. We will call or message you to confirm the final price and design details.</p>
    </div>
    <div class="order-wrap">
      <form id="orderForm" class="reveal">
        <div class="row">
          <div><label for="name">Full name *</label><input id="name" required placeholder="e.g. Amina Juma"></div>
          <div><label for="phone">Phone / WhatsApp *</label><input id="phone" required placeholder="+255 ..."></div>
        </div>
        <label for="email">Email (optional)</label><input id="email" type="email" placeholder="you@example.com">
        <div class="row">
          <div><label for="service">Service *</label><select id="service" required></select></div>
          <div><label for="quantity" id="qtyLabel">Quantity</label><input id="quantity" type="number" min="1" value="1"></div>
        </div>
        <div class="row">
          <div><label for="deadline">Needed by</label><input id="deadline" type="date"></div>
          <div>
            <label>Receive by</label>
            <div class="radios">
              <label><input type="radio" name="delivery" value="pickup" checked><span>🏪 Pickup</span></label>
              <label><input type="radio" name="delivery" value="delivery"><span>🚚 Delivery</span></label>
            </div>
          </div>
        </div>
        <label for="details">Project details</label>
        <textarea id="details" placeholder="Size, colours, paper type, text to print, links to your files..."></textarea>
        <div class="estimate"><span>Estimated price</span><b id="estimate">TZS 0</b></div>
        <p class="note">* Estimate only — the final price is confirmed after we review your request.</p>
        <button class="btn btn-primary" type="submit" id="submitBtn">Send Reservation →</button>
        <div class="msg" id="orderMsg"></div>
      </form>

      <div class="reveal">
        <div class="side-card">
          <h3>📦 Track your order</h3>
          <p style="color:var(--muted);font-size:.92rem">Enter the code you received after ordering (e.g. TZ-A1B2C3).</p>
          <label for="ref">Order code</label>
          <input id="ref" placeholder="TZ-XXXXXX">
          <button class="btn btn-ghost" id="trackBtn" style="margin-top:14px;width:100%;justify-content:center">Check status</button>
          <div class="track-res" id="trackRes"></div>
        </div>
        <div class="side-card">
          <h3>⚡ Need it fast?</h3>
          <p style="color:var(--muted);font-size:.92rem">Express printing is available for most jobs. Chat with us directly on WhatsApp.</p>
          <a class="btn btn-primary" id="waBtn" target="_blank" rel="noopener" style="margin-top:14px;width:100%;justify-content:center;background:#25d366;box-shadow:none">💬 Chat on WhatsApp</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ============ TESTIMONIALS ============ -->
<section>
  <div class="container center">
    <span class="eyebrow">Testimonials</span>
    <h2 class="title reveal">Clients love working with us</h2>
    <div class="grid t-grid" style="text-align:left">
      <div class="testi reveal"><div class="stars">★★★★★</div><p>My business cards look incredible and were ready in two days. The colours are exactly what I wanted.</p><div class="who">Neema M.<small>Boutique owner</small></div></div>
      <div class="testi reveal"><div class="stars">★★★★★</div><p>They designed our whole brand — logo, labels and banners. Professional team and great communication.</p><div class="who">Hassan K.<small>Food producer</small></div></div>
      <div class="testi reveal"><div class="stars">★★★★★</div><p>200 event T-shirts delivered right on schedule. Quality is top-notch and prices are fair.</p><div class="who">Grace L.<small>Event organiser</small></div></div>
    </div>
  </div>
</section>

<!-- ============ CONTACT + MAP ============ -->
<section class="contact" id="contact">
  <div class="container">
    <div class="center">
      <span class="eyebrow">Find us</span>
      <h2 class="title reveal">Visit our studio</h2>
    </div>
    <div class="contact-grid">
      <div class="info reveal" id="info"></div>
      <div class="map reveal"><iframe id="mapFrame" loading="lazy" title="TZCO location map"></iframe></div>
    </div>
  </div>
</section>

<footer>
  <div class="container">
    <div class="foot">
      <div><h4>TZCO Printing & Design</h4><p>Creativity • Quality • Service</p><div class="cmyk"><i style="background:#00aeef"></i><i style="background:#ec008c"></i><i style="background:#f2c21b"></i><i style="background:#000"></i></div></div>
      <div><h4>Quick links</h4><a href="#services">Services</a><a href="#work">Our work</a><a href="#order">Order online</a><a href="#contact">Contact</a></div>
      <div><h4>Staff</h4><a href="/admin">Admin dashboard</a></div>
    </div>
    <div class="copy">© <span id="year"></span> TZCO Printing & Design. All rights reserved.</div>
  </div>
</footer>

<a class="wa" id="waFloat" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
<button class="top" id="toTop" aria-label="Back to top">↑</button>

<script>
(function(){
  var $ = function(s){ return document.querySelector(s); };
  var fmt = function(n){ return 'TZS ' + Math.round(n).toLocaleString('en-US'); };
  var services = [], cfg = {};

  /* header scroll + back-to-top */
  window.addEventListener('scroll', function(){
    $('#header').classList.toggle('scrolled', window.scrollY > 40);
    $('#toTop').classList.toggle('show', window.scrollY > 600);
  });
  $('#toTop').onclick = function(){ window.scrollTo({top:0,behavior:'smooth'}); };
  $('#burger').onclick = function(){ $('#menu').classList.toggle('open'); };
  document.querySelectorAll('#menu a').forEach(function(a){ a.onclick = function(){ $('#menu').classList.remove('open'); }; });
  $('#year').textContent = new Date().getFullYear();

  /* reveal on scroll */
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:.12});
  function observe(){ document.querySelectorAll('.reveal:not(.in)').forEach(function(el){ io.observe(el); }); }

  /* animated counters */
  var cio = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target, target = +el.dataset.count, cur = 0, step = Math.max(1, Math.ceil(target/60));
      var t = setInterval(function(){ cur += step; if(cur >= target){ cur = target; clearInterval(t); } el.textContent = cur.toLocaleString() + (target>=100?'+':''); }, 25);
      cio.unobserve(el);
    });
  });
  document.querySelectorAll('[data-count]').forEach(function(el){ cio.observe(el); });

  function api(url, opts){ return fetch(url, opts).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); }); }

  /* config / contact / map */
  api('/api/config').then(function(r){
    cfg = r.data;
    var wa = 'https://wa.me/' + cfg.whatsapp + '?text=' + encodeURIComponent('Hello TZCO, I would like to ask about printing.');
    $('#waFloat').href = wa; $('#waBtn').href = wa;
    $('#info').innerHTML =
      item('📍','Address',cfg.address) + item('📞','Phone',cfg.phone) + item('✉️','Email',cfg.email) + item('🕒','Opening hours',cfg.hours);
    var d = 0.012;
    $('#mapFrame').src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (cfg.mapLng-d) + ',' + (cfg.mapLat-d) + ',' + (cfg.mapLng+d) + ',' + (cfg.mapLat+d) + '&layer=mapnik&marker=' + cfg.mapLat + ',' + cfg.mapLng;
    observe();
  });
  function item(ic,l,v){ return '<div class="info-item"><div class="ic">'+ic+'</div><div><small>'+l+'</small><b>'+v+'</b></div></div>'; }

  /* services */
  api('/api/services').then(function(r){
    services = r.data;
    $('#servicesGrid').innerHTML = services.map(function(s){
      return '<div class="service reveal"><div class="ic">'+s.icon+'</div><h3>'+s.name+'</h3><p>'+s.desc+'</p>' +
             '<div class="price">From '+fmt(s.price)+' <small>'+s.unit+'</small></div>' +
             '<button data-pick="'+s.id+'">Order this →</button></div>';
    }).join('');
    $('#service').innerHTML = '<option value="">Choose a service…</option>' + services.map(function(s){ return '<option value="'+s.id+'">'+s.name+'</option>'; }).join('');
    document.querySelectorAll('[data-pick]').forEach(function(b){
      b.onclick = function(){ $('#service').value = b.dataset.pick; updateEstimate(); document.getElementById('order').scrollIntoView({behavior:'smooth'}); };
    });
    observe();
  });

  function updateEstimate(){
    var s = services.find(function(x){ return x.id === $('#service').value; });
    var q = Math.max(1, parseFloat($('#quantity').value) || 1);
    $('#estimate').textContent = s ? fmt(s.price * q) : 'TZS 0';
    $('#qtyLabel').textContent = s ? 'Quantity (' + s.unit + ')' : 'Quantity';
  }
  $('#service').onchange = updateEstimate;
  $('#quantity').oninput = updateEstimate;
  var today = new Date().toISOString().split('T')[0];
  $('#deadline').min = today;

  /* portfolio */
  var works = [];
  api('/api/works').then(function(r){
    works = r.data;
    var cats = ['All'].concat(works.map(function(w){ return w.cat; }).filter(function(c,i,a){ return a.indexOf(c) === i; }));
    $('#filters').innerHTML = cats.map(function(c,i){ return '<button class="'+(i?'':'active')+'" data-cat="'+c+'">'+c+'</button>'; }).join('');
    $('#worksGrid').innerHTML = works.map(function(w){
      return '<div class="work reveal" data-cat="'+w.cat+'" data-id="'+w.id+'" style="background:linear-gradient(135deg,'+w.c1+','+w.c2+')">' +
             '<span class="emo">'+w.emoji+'</span><div class="cap"><b>'+w.title+'</b><span>'+w.cat+'</span></div></div>';
    }).join('');
    document.querySelectorAll('#filters button').forEach(function(b){
      b.onclick = function(){
        document.querySelectorAll('#filters button').forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active');
        document.querySelectorAll('.work').forEach(function(w){ w.classList.toggle('hide', b.dataset.cat !== 'All' && w.dataset.cat !== b.dataset.cat); });
      };
    });
    document.querySelectorAll('.work').forEach(function(el){
      el.onclick = function(){
        var w = works.find(function(x){ return x.id == el.dataset.id; });
        $('#mTop').style.background = 'linear-gradient(135deg,'+w.c1+','+w.c2+')';
        $('#mTop').textContent = w.emoji; $('#mTitle').textContent = w.title; $('#mNote').textContent = w.note;
        $('#modal').classList.add('open');
      };
    });
    observe();
  });
  function closeModal(){ $('#modal').classList.remove('open'); }
  $('#mClose').onclick = closeModal; $('#mOrder').onclick = closeModal;
  $('#modal').onclick = function(e){ if(e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

  /* submit order */
  $('#orderForm').onsubmit = function(e){
    e.preventDefault();
    var msg = $('#orderMsg'); msg.className = 'msg';
    var body = {
      name: $('#name').value, phone: $('#phone').value, email: $('#email').value,
      service: $('#service').value, quantity: $('#quantity').value, deadline: $('#deadline').value,
      delivery: document.querySelector('input[name=delivery]:checked').value, details: $('#details').value
    };
    $('#submitBtn').disabled = true; $('#submitBtn').textContent = 'Sending…';
    api('/api/orders', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}).then(function(r){
      $('#submitBtn').disabled = false; $('#submitBtn').textContent = 'Send Reservation →';
      if(r.ok){
        msg.className = 'msg ok';
        msg.innerHTML = '✅ Thank you! Your order code is <b>' + r.data.ref + '</b>. Save it to track your order. We will contact you shortly.';
        $('#ref').value = r.data.ref;
        $('#orderForm').reset(); updateEstimate();
      } else { msg.className = 'msg err'; msg.textContent = r.data.error || 'Something went wrong.'; }
    }).catch(function(){
      $('#submitBtn').disabled = false; $('#submitBtn').textContent = 'Send Reservation →';
      msg.className = 'msg err'; msg.textContent = 'Could not reach the server. Please try again.';
    });
  };

  /* track order */
  var flow = ['New','In design','In printing','Ready for pickup','Delivered'];
  $('#trackBtn').onclick = function(){
    var ref = $('#ref').value.trim(), box = $('#trackRes');
    if(!ref) return;
    api('/api/track?ref=' + encodeURIComponent(ref)).then(function(r){
      box.style.display = 'block';
      if(!r.ok){ box.innerHTML = '<div class="msg err" style="display:block">' + r.data.error + '</div>'; return; }
      var idx = flow.indexOf(r.data.status);
      var html = '<b>' + r.data.service + '</b> — ' + r.data.ref + '<ul class="timeline">';
      if(idx < 0){ html += '<li class="done now">' + r.data.status + '</li>'; }
      else flow.forEach(function(s,i){ html += '<li class="' + (i<idx?'done':'') + (i===idx?' done now':'') + '">' + s + '</li>'; });
      box.innerHTML = html + '</ul>';
    });
  };
})();
</script>
</body>
</html>`;

/* =====================================================================
   ADMIN DASHBOARD — served at /admin
   ===================================================================== */
const ADMIN_HTML = String.raw`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TZCO Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,Segoe UI,sans-serif;background:#f1f5f9;color:#1d2430}
.top{background:linear-gradient(120deg,#073766,#0b4f94,#1aa0c8);color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
.wrap{max-width:1200px;margin:24px auto;padding:0 16px}
.login{max-width:360px;margin:90px auto;background:#fff;padding:30px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.1)}
input,select,button{font:inherit;padding:11px 14px;border-radius:10px;border:2px solid #dbe4ee}
button{background:#0b4f94;color:#fff;border:0;cursor:pointer;font-weight:600}button.del{background:#c0392b;padding:8px 12px}
.login input,.login button{width:100%;margin-top:12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:20px}
.card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 4px 14px rgba(0,0,0,.06)}.card b{font-size:1.8rem;display:block;color:#0b4f94}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.06)}
th,td{padding:12px 14px;text-align:left;border-bottom:1px solid #eef2f6;font-size:.9rem;vertical-align:top}th{background:#eaf3fb;color:#073766}
.scroll{overflow-x:auto}small{color:#6b7686}
</style></head><body>
<div id="loginBox" class="login"><h2>TZCO Admin</h2><p style="color:#6b7686;margin-top:6px">Enter the admin password</p>
<input type="password" id="pw" placeholder="Password"><button id="go">Log in</button><p id="err" style="color:#c0392b;margin-top:10px"></p></div>
<div id="app" style="display:none">
  <div class="top"><h2>📋 Orders dashboard</h2><div><button id="refresh">↻ Refresh</button> <a href="/" style="color:#fff;margin-left:10px">← Website</a></div></div>
  <div class="wrap"><div class="cards" id="cards"></div>
  <div class="scroll"><table><thead><tr><th>Code</th><th>Customer</th><th>Order</th><th>Details</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></div>
</div>
<script>
var pw = '', statuses = [];
function call(url, method, body){
  return fetch(url, {method: method || 'GET', headers: {'Content-Type':'application/json','x-admin-password': pw}, body: body ? JSON.stringify(body) : undefined})
    .then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); });
}
function esc(s){ var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
function load(){
  call('/api/admin/orders').then(function(r){
    if(!r.ok){ document.getElementById('err').textContent = 'Wrong password'; return; }
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    statuses = r.data.statuses; var o = r.data.orders;
    var count = function(s){ return o.filter(function(x){ return x.status === s; }).length; };
    document.getElementById('cards').innerHTML =
      '<div class="card"><b>' + o.length + '</b>Total orders</div>' +
      '<div class="card"><b>' + count('New') + '</b>New</div>' +
      '<div class="card"><b>' + (count('In design') + count('In printing')) + '</b>In progress</div>' +
      '<div class="card"><b>' + count('Ready for pickup') + '</b>Ready</div>' +
      '<div class="card"><b>' + count('Delivered') + '</b>Delivered</div>';
    document.getElementById('rows').innerHTML = o.length ? o.map(function(x){
      var opts = statuses.map(function(s){ return '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>'; }).join('');
      return '<tr><td><b>' + esc(x.ref) + '</b><br><small>' + new Date(x.createdAt).toLocaleString() + '</small></td>' +
        '<td>' + esc(x.name) + '<br><small>' + esc(x.phone) + '<br>' + esc(x.email) + '</small></td>' +
        '<td>' + esc(x.service) + '<br><small>Qty: ' + x.quantity + ' • ' + esc(x.delivery) + '<br>Needed by: ' + esc(x.deadline || '—') + '<br>Est: TZS ' + Math.round(x.estimate).toLocaleString() + '</small></td>' +
        '<td style="max-width:260px">' + esc(x.details || '—') + '</td>' +
        '<td><select data-ref="' + esc(x.ref) + '" class="st">' + opts + '</select></td>' +
        '<td><button class="del" data-del="' + esc(x.ref) + '">Delete</button></td></tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;padding:30px">No orders yet.</td></tr>';
    document.querySelectorAll('.st').forEach(function(s){ s.onchange = function(){ call('/api/admin/orders/' + encodeURIComponent(s.dataset.ref), 'PATCH', {status: s.value}).then(load); }; });
    document.querySelectorAll('[data-del]').forEach(function(b){ b.onclick = function(){ if(confirm('Delete order ' + b.dataset.del + '?')) call('/api/admin/orders/' + encodeURIComponent(b.dataset.del), 'DELETE').then(load); }; });
  });
}
document.getElementById('go').onclick = function(){ pw = document.getElementById('pw').value; load(); };
document.getElementById('pw').onkeydown = function(e){ if(e.key === 'Enter') document.getElementById('go').click(); };
document.getElementById('refresh').onclick = load;
</script></body></html>`;