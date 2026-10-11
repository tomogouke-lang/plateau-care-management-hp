(function () {
  'use strict';
  const config=window.PDSCareConfig, core=window.PDSAvailability;
  let lastRecord=null, request=0, activeController=null;
  const $=id=>document.getElementById(id);
  function render(record, reason) {
    const s=core.evaluate(record,new Date(),config.staleDays);
    if(reason==='network') s.note='受付情報を読み込めませんでした。お電話で現在の状況をご確認ください。';
    $('availability').dataset.state=s.tone;
    $('status-label').textContent=s.status;
    $('status-heading').textContent=s.title;
    $('start-value').textContent=s.start;
    $('status-note').textContent=s.note;
    $('checked-value').textContent=s.checked ? `最終確認：${s.checked}` : '最終確認日：未確認';
    $('area-value').textContent=s.area;
    $('preventive-value').textContent=s.preventive;
    $('availability').setAttribute('aria-busy','false');
  }
  async function refresh() {
    const n=++request;
    activeController?.abort();
    activeController=null;
    lastRecord=null;
    render(null);
    if(!config.enabled || !/^[A-Za-z0-9_-]{20,100}$/.test(config.sheetId)) return;
    const controller=new AbortController(); activeController=controller;
    $('availability').setAttribute('aria-busy','true');
    const timeout=setTimeout(()=>{controller.abort();if(n===request)render(null,'network');},config.timeoutMs);
    const params=new URLSearchParams({sheet:config.sheetName,range:'A1:G3',headers:'1',tqx:'out:json',tq:'select A,B,C,D,E,F,G where A is not null',_ts:String(Date.now())});
    try {
      const response=await fetch(`https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq?${params}`,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('Unavailable');
      const record=core.parseResponse(await response.text());
      if(n!==request || controller.signal.aborted)return;
      lastRecord=record;render(record);
    } catch {if(n===request)render(null,'network');}
    finally {clearTimeout(timeout);}
  }
  function start() {
    refresh();
    setInterval(refresh,config.refreshMs);
    setInterval(()=>{if(lastRecord)render(lastRecord);},60000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
  }
  window.PDSCarePage={render,start};
  if(!document.body.hasAttribute('data-preview'))start();
})();
