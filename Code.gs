var SEARCH_QUERY  = 'from:me subject:"session notes"';
var MAX_THREADS   = 500;
var CACHE_KEY     = 'clientData';
var DAYS_90       = 90  * 24 * 60 * 60 * 1000;
var DAYS_180      = 180 * 24 * 60 * 60 * 1000;
var DAYS_365      = 365 * 24 * 60 * 60 * 1000;

// ── Add-on entry point (reads cache only — instant) ───────────────────────────

function onHomepage(e) {
  var now    = new Date();
  var store  = PropertiesService.getUserProperties();
  var raw    = store.getProperty(CACHE_KEY);

  if (!raw) {
    // No cache yet — run the scan now (slow, one-time)
    buildCache();
    raw = store.getProperty(CACHE_KEY);
  }

  var cached = JSON.parse(raw);
  var clients = cached.data;
  Object.keys(clients).forEach(function(k) {
    clients[k].lastDate = new Date(clients[k].lastDate);
  });

  var groups  = categorise(clients, now);
  var updated = new Date(cached.ts);
  return buildCard(groups, updated);
}

// ── Cache builder — called by daily trigger or Refresh button ─────────────────

function buildCache() {
  var threads = GmailApp.search(SEARCH_QUERY, 0, MAX_THREADS);
  var clients = {};
  var me      = Session.getEffectiveUser().getEmail().toLowerCase();

  threads.forEach(function(thread) {
    var msg = thread.getMessages()[0];
    if (msg.getFrom().toLowerCase().indexOf(me) === -1) return;
    var date = msg.getDate();
    parseRecipients(msg.getTo()).forEach(function(r) {
      var key = r.email.toLowerCase();
      if (!clients[key] || clients[key].lastDate < date)
        clients[key] = { name: r.name, lastDate: date };
    });
  });

  PropertiesService.getUserProperties().setProperty(
    CACHE_KEY,
    JSON.stringify({ ts: new Date().toISOString(), data: clients })
  );
}

function refreshAndShow() {
  buildCache();
  return onHomepage(null);
}

// ── Run once to create the daily trigger ─────────────────────────────────────

function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('buildCache').timeBased().everyDays(1).atHour(6).create();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseRecipients(toHeader) {
  if (!toHeader) return [];
  return toHeader.split(',').reduce(function(acc, part) {
    part = part.trim();
    var m = part.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
    if (m) acc.push({ name: m[1].trim() || m[2].trim(), email: m[2].trim() });
    else if (part.indexOf('@') !== -1) acc.push({ name: part, email: part });
    return acc;
  }, []);
}

function categorise(clients, now) {
  var groups = { current: [], ago3mo: [], ago6mo: [], ago1yr: [] };
  Object.keys(clients).forEach(function(key) {
    var c = clients[key], diff = now - c.lastDate;
    if      (diff < DAYS_90)  groups.current.push(c);
    else if (diff < DAYS_180) groups.ago3mo.push(c);
    else if (diff < DAYS_365) groups.ago6mo.push(c);
    else                      groups.ago1yr.push(c);
  });
  var byName = function(a, b) { return a.name.localeCompare(b.name); };
  Object.keys(groups).forEach(function(k) { groups[k].sort(byName); });
  return groups;
}

// ── Card UI ───────────────────────────────────────────────────────────────────

function buildCard(groups, updatedAt) {
  var refreshAction = CardService.newAction().setFunctionName('refreshAndShow');
  var refreshBtn    = CardService.newTextButton()
    .setText('🔄 Refresh')
    .setOnClickAction(refreshAction);
  var subtitle = 'Updated ' + Utilities.formatDate(updatedAt, Session.getScriptTimeZone(), 'MMM d h:mm a');
  var topSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('<font color="#999999">' + subtitle + '</font>'))
    .addWidget(CardService.newButtonSet().addButton(refreshBtn));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Client Check-in Tracker'))
    .addSection(topSection)
    .addSection(buildSection('✅ Current',       groups.current, 'Within 90 days'))
    .addSection(buildSection('🟡 3 months ago',  groups.ago3mo,  '3–6 months ago'))
    .addSection(buildSection('🟠 6 months ago',  groups.ago6mo,  '6–12 months ago'))
    .addSection(buildSection('🔴 1 year+',       groups.ago1yr,  'Over a year ago'))
    .build();
}

function buildSection(header, clients, subtitle) {
  var section = CardService.newCardSection()
    .setHeader(header + ' (' + clients.length + ')')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  if (clients.length === 0) {
    section.addWidget(CardService.newTextParagraph().setText('<i>None</i>'));
    return section;
  }

  clients.forEach(function(c) {
    var lastSeen = Utilities.formatDate(c.lastDate, Session.getScriptTimeZone(), 'MMM d, yyyy');
    section.addWidget(
      CardService.newDecoratedText()
        .setText(c.name)
        .setBottomLabel(lastSeen)
    );
  });

  return section;
}
