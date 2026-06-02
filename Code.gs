var SEARCH_QUERY = 'from:me subject:"session notes"';
var MAX_THREADS  = 500;

var NOW     = new Date();
var DAYS_90  = 90  * 24 * 60 * 60 * 1000;
var DAYS_180 = 180 * 24 * 60 * 60 * 1000;
var DAYS_365 = 365 * 24 * 60 * 60 * 1000;

// ── Run this once manually to set up the weekly trigger ──────────────────────

function createWeeklyTrigger() {
  // Delete any existing triggers first to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendWeeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
}

// ── Main ─────────────────────────────────────────────────────────────────────

function sendWeeklyDigest() {
  var clients = getClientData();
  var groups  = categorise(clients);
  var me      = Session.getEffectiveUser().getEmail();
  var subject = 'Client check-in digest — ' + formatDate(NOW);
  var body    = buildEmailBody(groups);
  GmailApp.sendEmail(me, subject, '', { htmlBody: body });
}

// ── Data ─────────────────────────────────────────────────────────────────────

function getClientData() {
  var threads = GmailApp.search(SEARCH_QUERY, 0, MAX_THREADS);
  var clients = {};

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(msg) {
      if (!isFromMe(msg)) return;
      var date       = msg.getDate();
      var recipients = parseRecipients(msg.getTo());
      recipients.forEach(function(r) {
        var key = r.email.toLowerCase();
        if (!clients[key] || clients[key].lastDate < date) {
          clients[key] = { name: r.name, email: r.email, lastDate: date };
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

function parseRecipients(toHeader) {
  if (!toHeader) return [];
  return toHeader.split(',').reduce(function(acc, part) {
    part = part.trim();
    var match = part.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
    if (match) {
      acc.push({ name: match[1].trim() || match[2].trim(), email: match[2].trim() });
    } else if (part.indexOf('@') !== -1) {
      acc.push({ name: part, email: part });
    }
    return acc;
  }, []);
}

// ── Categorise ───────────────────────────────────────────────────────────────

function categorise(clients) {
  var groups = { current: [], ago3mo: [], ago6mo: [], ago1yr: [] };

  Object.keys(clients).forEach(function(key) {
    var c    = clients[key];
    var diff = NOW - c.lastDate;
    if      (diff < DAYS_90)  groups.current.push(c);
    else if (diff < DAYS_180) groups.ago3mo.push(c);
    else if (diff < DAYS_365) groups.ago6mo.push(c);
    else                      groups.ago1yr.push(c);
  });

  var byName = function(a, b) { return a.name.localeCompare(b.name); };
  Object.keys(groups).forEach(function(k) { groups[k].sort(byName); });
  return groups;
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmailBody(groups) {
  var html = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">';
  html += '<h2 style="border-bottom:2px solid #eee;padding-bottom:8px">Client check-in digest</h2>';

  html += section('✅ Current clients',        groups.current, 'Last session within 90 days',    '#d4edda', '#155724');
  html += section('🟡 Check in — 3 months',   groups.ago3mo,  'Last session 3–6 months ago',    '#fff3cd', '#856404');
  html += section('🟠 Check in — 6 months',   groups.ago6mo,  'Last session 6–12 months ago',   '#ffe5cc', '#7d3c00');
  html += section('🔴 Check in — 1 year+',    groups.ago1yr,  'Last session over a year ago',   '#f8d7da', '#721c24');

  html += '<p style="color:#999;font-size:12px;margin-top:32px">Generated from emails matching: <code>from:me subject:"session notes"</code></p>';
  html += '</div>';
  return html;
}

function section(title, clients, subtitle, bg, color) {
  var html = '<div style="margin-bottom:24px">';
  html += '<h3 style="background:' + bg + ';color:' + color + ';padding:8px 12px;border-radius:4px;margin:0 0 4px">' + title + '</h3>';
  html += '<p style="margin:0 0 8px;font-size:13px;color:#666">' + subtitle + '</p>';

  if (clients.length === 0) {
    html += '<p style="color:#999;font-style:italic">None</p>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse">';
    clients.forEach(function(c) {
      html += '<tr style="border-bottom:1px solid #eee">';
      html += '<td style="padding:6px 4px">' + escHtml(c.name) + '</td>';
      html += '<td style="padding:6px 4px;color:#666;text-align:right;font-size:13px">' + formatDate(c.lastDate) + '</td>';
      html += '</tr>';
    });
    html += '</table>';
  }

  html += '</div>';
  return html;
}

function formatDate(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM d, yyyy');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
