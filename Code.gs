// ── Constants ────────────────────────────────────────────────────────────────

var SEARCH_QUERY = 'from:me subject:"session notes"';
var MAX_THREADS  = 500;   // how many threads to scan

var NOW          = new Date();
var DAYS_90      = 90  * 24 * 60 * 60 * 1000;
var DAYS_180     = 180 * 24 * 60 * 60 * 1000;
var DAYS_365     = 365 * 24 * 60 * 60 * 1000;

// ── Entry point ──────────────────────────────────────────────────────────────

function onHomepage(e) {
  var clients = getClientData();
  return buildCard(clients);
}

// ── Data layer ───────────────────────────────────────────────────────────────

/**
 * Returns a map of { email → { name, lastDate } } built from sent
 * "session notes" emails.
 */
function getClientData() {
  var threads = GmailApp.search(SEARCH_QUERY, 0, MAX_THREADS);

  // email → { name: string, lastDate: Date }
  var clients = {};

  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    messages.forEach(function(msg) {
      // Only care about messages the user actually sent
      if (!isFromMe(msg)) return;

      var date = msg.getDate();
      var recipients = parseRecipients(msg.getTo());

      recipients.forEach(function(r) {
        var key = r.email.toLowerCase();
        if (!clients[key] || clients[key].lastDate < date) {
          clients[key] = { name: r.name || r.email, lastDate: date };
        }
      });
    });
  });

  return clients;
}

function isFromMe(msg) {
  var from = msg.getFrom().toLowerCase();
  var me   = Session.getEffectiveUser().getEmail().toLowerCase();
  return from.indexOf(me) !== -1;
}

/**
 * Parses a To: header string into an array of { name, email }.
 * Handles "First Last <email@example.com>" and bare "email@example.com".
 */
function parseRecipients(toHeader) {
  if (!toHeader) return [];
  var results = [];
  var parts = toHeader.split(',');
  parts.forEach(function(part) {
    part = part.trim();
    var match = part.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
    if (match) {
      results.push({ name: match[1].trim() || match[2].trim(), email: match[2].trim() });
    } else if (part.indexOf('@') !== -1) {
      results.push({ name: part, email: part });
    }
  });
  return results;
}

// ── Categorisation ───────────────────────────────────────────────────────────

function categorise(clients) {
  var current   = [];
  var ago3mo    = [];
  var ago6mo    = [];
  var ago1yr    = [];
  var olderOrNA = [];

  Object.keys(clients).forEach(function(email) {
    var c    = clients[email];
    var diff = NOW - c.lastDate;

    if (diff < DAYS_90) {
      current.push(c);
    } else if (diff < DAYS_180) {
      ago3mo.push(c);
    } else if (diff < DAYS_365) {
      ago6mo.push(c);
    } else {
      ago1yr.push(c);
    }
  });

  // Sort each group by name
  var byName = function(a, b) { return a.name.localeCompare(b.name); };
  current.sort(byName);
  ago3mo.sort(byName);
  ago6mo.sort(byName);
  ago1yr.sort(byName);

  return { current: current, ago3mo: ago3mo, ago6mo: ago6mo, ago1yr: ago1yr };
}

// ── Card UI ──────────────────────────────────────────────────────────────────

function buildCard(clients) {
  var groups = categorise(clients);
  var card   = CardService.newCardBuilder()
    .setName('Client Check-in Tracker')
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Client Check-in Tracker')
        .setSubtitle('Based on your "session notes" emails')
    );

  card.addSection(buildSection(
    '✅  Current clients  (' + groups.current.length + ')',
    groups.current,
    'Last session within 90 days'
  ));

  card.addSection(buildSection(
    '🟡  Check in — 3 months  (' + groups.ago3mo.length + ')',
    groups.ago3mo,
    'Last session 3–6 months ago'
  ));

  card.addSection(buildSection(
    '🟠  Check in — 6 months  (' + groups.ago6mo.length + ')',
    groups.ago6mo,
    'Last session 6–12 months ago'
  ));

  card.addSection(buildSection(
    '🔴  Check in — 1 year+  (' + groups.ago1yr.length + ')',
    groups.ago1yr,
    'Last session over a year ago'
  ));

  return card.build();
}

function buildSection(header, clients, subtitle) {
  var section = CardService.newCardSection()
    .setHeader(header)
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  if (clients.length === 0) {
    section.addWidget(
      CardService.newTextParagraph().setText('<i>None</i>')
    );
    return section;
  }

  clients.forEach(function(c) {
    var lastSeen = Utilities.formatDate(c.lastDate, Session.getScriptTimeZone(), 'MMM d, yyyy');
    section.addWidget(
      CardService.newKeyValue()
        .setTopLabel(c.name)
        .setContent(lastSeen)
        .setMultiline(false)
    );
  });

  return section;
}
