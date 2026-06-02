var SEARCH_QUERY = 'from:me subject:"session notes"';
var MAX_THREADS  = 500;
var NOW          = new Date();
var DAYS_90      = 90  * 24 * 60 * 60 * 1000;
var DAYS_180     = 180 * 24 * 60 * 60 * 1000;
var DAYS_365     = 365 * 24 * 60 * 60 * 1000;

function sendWeeklyDigest() {
  var clients = {};
  var threads = GmailApp.search(SEARCH_QUERY, 0, MAX_THREADS);

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(msg) {
      var from = msg.getFrom().toLowerCase();
      var me   = Session.getEffectiveUser().getEmail().toLowerCase();
      if (from.indexOf(me) === -1) return;

      var date = msg.getDate();
      parseRecipients(msg.getTo()).forEach(function(r) {
        var key = r.email.toLowerCase();
        if (!clients[key] || clients[key].lastDate < date)
          clients[key] = { name: r.name, lastDate: date };
      });
    });
  });

  var groups = { current: [], ago3mo: [], ago6mo: [], ago1yr: [] };
  Object.keys(clients).forEach(function(key) {
    var c = clients[key], diff = NOW - c.lastDate;
    if      (diff < DAYS_90)  groups.current.push(c);
    else if (diff < DAYS_180) groups.ago3mo.push(c);
    else if (diff < DAYS_365) groups.ago6mo.push(c);
    else                      groups.ago1yr.push(c);
  });
  var byName = function(a,b){ return a.name.localeCompare(b.name); };
  Object.keys(groups).forEach(function(k){ groups[k].sort(byName); });

  var me = Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(me,
    'Client check-in — ' + Utilities.formatDate(NOW, Session.getScriptTimeZone(), 'MMM d, yyyy'),
    '',
    { htmlBody: buildHtml(groups) }
  );
}

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

function buildHtml(g) {
  var s = section, h = '';
  h += '<div style="font-family:sans-serif;max-width:580px;color:#222">';
  h += s('✅ Current clients',       g.current, 'Last session within 90 days',  '#d4edda','#155724');
  h += s('🟡 Check in — 3 months',  g.ago3mo,  'Last session 3–6 months ago',  '#fff3cd','#856404');
  h += s('🟠 Check in — 6 months',  g.ago6mo,  'Last session 6–12 months ago', '#ffe5cc','#7d3c00');
  h += s('🔴 Check in — 1 year+',   g.ago1yr,  'Last session over a year ago', '#f8d7da','#721c24');
  h += '</div>';
  return h;
}

function section(title, clients, subtitle, bg, color) {
  var h = '<div style="margin-bottom:20px">';
  h += '<h3 style="background:'+bg+';color:'+color+';padding:8px 12px;border-radius:4px;margin:0 0 4px">' + title + ' ('+clients.length+')</h3>';
  h += '<p style="margin:0 0 8px;font-size:13px;color:#666">'+subtitle+'</p>';
  if (!clients.length) { h += '<p style="color:#999;font-style:italic">None</p>'; }
  else {
    h += '<table style="width:100%;border-collapse:collapse">';
    clients.forEach(function(c) {
      h += '<tr style="border-bottom:1px solid #eee">';
      h += '<td style="padding:5px 4px">'+c.name+'</td>';
      h += '<td style="padding:5px 4px;color:#666;text-align:right;font-size:13px">'+Utilities.formatDate(c.lastDate,Session.getScriptTimeZone(),'MMM d, yyyy')+'</td>';
      h += '</tr>';
    });
    h += '</table>';
  }
  return h + '</div>';
}
