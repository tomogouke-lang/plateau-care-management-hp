(function (root) {
  'use strict';
  const DAY = 86400000;
  const labels = Object.freeze({
    '受付中': { tone: 'open', title: '新規のご相談を受付中' },
    '条件により相談可': { tone: 'limited', title: '条件によりご相談いただけます' },
    '新規受付休止中': { tone: 'closed', title: '新規の受付を休止しています' }
  });
  function today(now) {
    const p = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    return ['year','month','day'].map(k => p.find(x => x.type === k).value).join('-');
  }
  function dateValue(value) {
    if (typeof value !== 'string') return null;
    const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value.trim());
    if (!m) return null;
    const [y,mo,d] = m.slice(1).map(Number);
    if (y < 2000 || y > 2199) return null;
    const t = Date.UTC(y,mo-1,d), check = new Date(t);
    return check.getUTCFullYear()===y && check.getUTCMonth()===mo-1 && check.getUTCDate()===d ? t : null;
  }
  function shortText(value, max=160) {
    return typeof value === 'string' && value.length <= max ? value.trim() : '';
  }
  function evaluate(record, now = new Date(), staleDays = 7) {
    const fallback = { tone:'unknown', title:'最新状況はお電話でご確認ください', status:'電話で確認', start:'お電話でご確認ください', note:'ご希望の開始時期と地域を伺い、対応できるか確認します。', checked:'', reason:'missing', area:'お住まいの地域をお知らせください', preventive:'要支援のご相談は、お電話でご確認ください' };
    if (!record || record.officeId !== 'plateau-care-management') return {...fallback, reason:'office'};
    if (!Object.hasOwn(labels, record.status)) return {...fallback, reason:'status'};
    const t = dateValue(record.checkedAt), present = dateValue(today(now));
    if (t === null || t > present) return {...fallback,reason:'date'};
    if (!Number.isInteger(staleDays) || staleDays < 1 || staleDays > 30) staleDays = 7;
    if (present - t >= staleDays * DAY) return {...fallback,reason:'stale',note:'前回の確認から日数が経っています。現在の受付状況と開始時期は、お電話でご確認ください。'};
    const label = labels[record.status];
    return { ...fallback, ...label, status:record.status, checked: new Date(t).toISOString().slice(0,10).replaceAll('-','/'), reason:'current',
      start: label.tone==='closed' ? '再開時期はお電話でご確認ください' : shortText(record.start,80) || fallback.start,
      note: shortText(record.note) || (label.tone==='closed' ? '現在、新しいご依頼の受付を休止しています。再開状況はお電話でご確認ください。' : fallback.note),
      area: shortText(record.area,80) || fallback.area,
      preventive: shortText(record.preventive,80) || fallback.preventive
    };
  }
  function cellText(cell) {
    if (cell == null || cell.v == null) return '';
    return typeof cell.v==='string' ? cell.v : String(cell.v);
  }
  function parseResponse(text) {
    if (typeof text !== 'string' || text.length > 100000) throw new Error('Invalid response');
    const start=text.indexOf('{'), end=text.lastIndexOf('}');
    if(start<0 || end<start) throw new Error('Invalid JSON');
    const obj=JSON.parse(text.slice(start,end+1));
    if(obj.status !== 'ok' || !Array.isArray(obj.table?.rows) || obj.table.rows.length !== 1) throw new Error('Invalid rows');
    const row=obj.table.rows[0]?.c;
    if(!Array.isArray(row) || row.length < 5) throw new Error('Invalid columns');
    let checkedAt=cellText(row[4]);
    const dm=/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/.exec(checkedAt);
    if(dm) checkedAt=`${dm[1]}-${String(Number(dm[2])+1).padStart(2,'0')}-${dm[3].padStart(2,'0')}`;
    return {officeId:cellText(row[0]),status:cellText(row[1]),start:cellText(row[2]),note:cellText(row[3]),checkedAt,area:cellText(row[5]),preventive:cellText(row[6])};
  }
  const api = {today,dateValue,evaluate,parseResponse};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.PDSAvailability=api;
})(typeof window==='undefined'?globalThis:window);
